import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';

console.log('🔧 WhatsApp Authentication Diagnostic Tool');
console.log('==========================================');

const sessionId = `debug-${Date.now()}`;
const sessionPath = path.join(process.cwd(), 'sessions', sessionId);

console.log(`Session ID: ${sessionId}`);
console.log(`Session Path: ${sessionPath}`);

// Create session directory
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
    console.log('✅ Session directory created');
}

try {
    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    console.log('✅ Auth state loaded');

    // Create socket with minimal configuration
    const logger = {
        level: 'silent',
        fatal: () => {},
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        child: () => logger
    };

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger,
        browser: ['WhatsApp Business', 'Desktop', '2.2413.51'],
        connectTimeoutMs: 90000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        shouldSyncHistoryMessage: () => false,
        getMessage: async () => null
    });

    console.log('✅ WhatsApp socket created');

    let qrCodeGenerated = false;
    let connectionEstablished = false;

    // Handle credentials update
    sock.ev.on('creds.update', async () => {
        try {
            await saveCreds();
            console.log('🔐 Credentials saved');
        } catch (error) {
            console.log('❌ Error saving credentials:', error.message);
        }
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;
        
        console.log(`📡 Connection Update: ${connection}`);
        
        if (qr && !qrCodeGenerated) {
            qrCodeGenerated = true;
            try {
                const qrCodeData = await qrcode.toDataURL(qr);
                console.log('📱 QR Code generated successfully!');
                console.log(`   QR Data Length: ${qrCodeData.length} characters`);
                console.log('   Ready for scanning!');
                
                // Show QR in terminal for testing
                qrcode.toString(qr, { type: 'terminal' }, (err, qrString) => {
                    if (!err) {
                        console.log('\n📱 QR Code (scan with WhatsApp):');
                        console.log(qrString);
                    }
                });
                
            } catch (error) {
                console.log('❌ Error generating QR code:', error);
            }
        }
        
        if (connection === 'connecting') {
            console.log('🔄 Connecting to WhatsApp...');
        }
        
        if (connection === 'open') {
            connectionEstablished = true;
            console.log('🎉 WhatsApp connection established!');
            console.log('📱 User info:', {
                id: sock.user?.id,
                name: sock.user?.name,
                phone: sock.user?.id?.split(':')[0]
            });
            
            console.log('✅ Authentication successful!');
            console.log('✅ Device should now appear in WhatsApp Linked Devices');
            
            // Test sending presence
            try {
                await sock.sendPresenceUpdate('available');
                console.log('✅ Presence update sent');
            } catch (error) {
                console.log('⚠️ Error sending presence:', error.message);
            }
            
            process.exit(0);
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message;
            
            console.log(`❌ Connection closed. Reason: ${reason} - ${errorMessage}`);
            
            // Handle specific error codes
            switch (reason) {
                case 400:
                    console.log('❌ Bad Request - QR code might be invalid');
                    break;
                case 401:
                    console.log('❌ Unauthorized - Session expired');
                    break;
                case 403:
                    console.log('❌ Forbidden - Account might be banned');
                    break;
                case 428:
                    console.log('🔄 Connection restart needed - This is normal after QR scan');
                    // Try to reconnect after brief delay
                    setTimeout(() => {
                        console.log('🔄 Attempting reconnection...');
                        // The auth state should have the credentials now
                        // This will trigger a new connection attempt
                    }, 3000);
                    return;
                case 515:
                    console.log('🔄 Normal reconnection after pairing');
                    return;
                default:
                    console.log(`❌ Unknown error code: ${reason}`);
            }
            
            if (reason !== DisconnectReason.loggedOut && !connectionEstablished) {
                console.log('🔄 Will attempt to reconnect...');
                return;
            }
            
            console.log('🚪 Disconnected permanently');
            process.exit(1);
        }
    });

    // Handle messages (for testing)
    sock.ev.on('messages.upsert', ({ messages }) => {
        console.log(`📨 Received ${messages.length} message(s)`);
    });

    console.log('🚀 Waiting for QR code generation...');
    console.log('📱 Scan the QR code with your phone when it appears');
    console.log('⏱️  Timeout in 2 minutes if no activity...');

    // Timeout after 2 minutes
    setTimeout(() => {
        if (!connectionEstablished) {
            console.log('⏰ Timeout reached - no connection established');
            console.log('❌ Diagnostic failed');
            process.exit(1);
        }
    }, 120000);

} catch (error) {
    console.log('❌ Fatal error:', error.message);
    console.log('❌ Full error:', error);
    process.exit(1);
}
