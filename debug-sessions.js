import fs from 'fs';
import path from 'path';

console.log('🔍 WhatsApp Session Debug Helper');
console.log('================================');

const sessionsPath = path.join(process.cwd(), 'sessions');

// Check if sessions directory exists
if (!fs.existsSync(sessionsPath)) {
    console.log('❌ Sessions directory does not exist');
    process.exit(1);
}

// List all sessions
const sessions = fs.readdirSync(sessionsPath);
console.log(`📁 Found ${sessions.length} sessions:`);

sessions.forEach((session, index) => {
    const sessionPath = path.join(sessionsPath, session);
    const stats = fs.statSync(sessionPath);
    
    console.log(`\n${index + 1}. Session: ${session}`);
    console.log(`   📅 Created: ${stats.birthtime.toLocaleString()}`);
    console.log(`   📅 Modified: ${stats.mtime.toLocaleString()}`);
    
    // Check for credentials file
    const credsPath = path.join(sessionPath, 'creds.json');
    if (fs.existsSync(credsPath)) {
        console.log('   ✅ Has credentials file');
        try {
            const credsContent = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            console.log(`   📱 Account: ${credsContent.me?.id || 'Unknown'}`);
        } catch (error) {
            console.log('   ⚠️  Credentials file corrupted');
        }
    } else {
        console.log('   ❌ No credentials file');
    }
    
    // Check session size
    const sessionFiles = fs.readdirSync(sessionPath);
    console.log(`   📊 Files: ${sessionFiles.length}`);
});

// Option to clean old sessions
console.log('\n🧹 Cleanup Options:');
console.log('1. Keep sessions (recommended for development)');
console.log('2. Clean sessions older than 1 hour');
console.log('3. Clean all sessions (fresh start)');

// Get command line argument for cleanup
const cleanupOption = process.argv[2];

if (cleanupOption === 'clean-old') {
    console.log('\n🧹 Cleaning sessions older than 1 hour...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    let cleaned = 0;
    sessions.forEach(session => {
        const sessionPath = path.join(sessionsPath, session);
        const stats = fs.statSync(sessionPath);
        
        if (stats.mtime < oneHourAgo) {
            try {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`   ✅ Cleaned: ${session}`);
                cleaned++;
            } catch (error) {
                console.log(`   ❌ Failed to clean: ${session}`);
            }
        }
    });
    
    console.log(`\n🎉 Cleaned ${cleaned} old sessions`);
} else if (cleanupOption === 'clean-all') {
    console.log('\n🧹 Cleaning ALL sessions...');
    
    let cleaned = 0;
    sessions.forEach(session => {
        const sessionPath = path.join(sessionsPath, session);
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`   ✅ Cleaned: ${session}`);
            cleaned++;
        } catch (error) {
            console.log(`   ❌ Failed to clean: ${session}`);
        }
    });
    
    console.log(`\n🎉 Cleaned ${cleaned} sessions`);
} else {
    console.log('\n💡 Usage:');
    console.log('  node debug-sessions.js                 # List sessions only');
    console.log('  node debug-sessions.js clean-old       # Clean sessions older than 1 hour');
    console.log('  node debug-sessions.js clean-all       # Clean all sessions');
}

console.log('\n✅ Debug complete!');
