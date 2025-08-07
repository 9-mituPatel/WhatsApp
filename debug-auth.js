#!/usr/bin/env node

import WhatsAppService from './src/services/WhatsAppService.js';
import { connectDB } from './src/config/db.js';
import logger from './src/utils/logger.js';

console.log('\n🔍 ===== AUTHENTICATION DEBUG =====\n');

async function debugAuth() {
  try {
    console.log('📦 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to database\n');

    // Check active connections
    const activeSessions = await WhatsAppService.getAllActiveSessions();
    console.log('📊 Active Sessions:', activeSessions.length);
    
    if (activeSessions.length > 0) {
      console.log('🔍 Session Details:');
      activeSessions.forEach((session, index) => {
        console.log(`   ${index + 1}. ${session.sessionId}`);
        console.log(`      Phone: ${session.phoneNumber}`);
        console.log(`      Name: ${session.name}`);
        console.log(`      Connected: ${session.isConnected}`);
      });
    }

    // Check WhatsApp service internals
    console.log('\n🔧 WhatsApp Service Internal State:');
    console.log(`   Active connections in map: ${WhatsAppService.activeConnections.size}`);
    
    // List all connection IDs
    if (WhatsAppService.activeConnections.size > 0) {
      console.log('🗂️  Connection IDs:');
      for (const [sessionId, connection] of WhatsAppService.activeConnections.entries()) {
        console.log(`   - ${sessionId}`);
        console.log(`     User: ${connection.user?.name || 'N/A'}`);
        console.log(`     Phone: ${connection.user?.id?.split(':')[0] || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
  } finally {
    console.log('\n🏁 Debug completed\n');
    process.exit(0);
  }
}

debugAuth();
