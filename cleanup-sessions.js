#!/usr/bin/env node

import SessionManager from './src/services/SessionManager.js';
import { connectDB } from './src/config/db.js';
import mongoose from 'mongoose';
import logger from './src/utils/logger.js';
import fs from 'fs';
import path from 'path';

console.log('\n🧹 ===== SESSION CLEANUP UTILITY =====\n');

async function cleanupSessions() {
  try {
    // Connect to database
    console.log('📦 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get current session stats
    const stats = SessionManager.getStats();
    console.log('📊 Current Session Stats:');
    console.log(`   Active Sessions: ${stats.activeSessions}/${stats.maxSessions}`);
    console.log(`   QR Timers: ${stats.qrTimers}`);
    console.log(`   Session Timers: ${stats.sessionTimers}\n`);

    // List all active sessions
    const activeSessions = SessionManager.getAllSessions();
    console.log('🔍 Active Sessions:');
    if (activeSessions.length === 0) {
      console.log('   No active sessions found');
    } else {
      activeSessions.forEach((session, index) => {
        const age = Math.round((Date.now() - session.createdAt) / 1000 / 60); // minutes
        console.log(`   ${index + 1}. ${session.sessionId}`);
        console.log(`      Status: ${session.status}`);
        console.log(`      Age: ${age} minutes`);
        console.log(`      Last Activity: ${session.lastActivity.toLocaleTimeString()}`);
      });
    }
    console.log('');

    // Check session directories
    const sessionsDir = path.join(process.cwd(), 'sessions');
    let sessionDirs = [];
    if (fs.existsSync(sessionsDir)) {
      sessionDirs = fs.readdirSync(sessionsDir).filter(dir => 
        fs.statSync(path.join(sessionsDir, dir)).isDirectory()
      );
    }
    
    console.log(`📁 Session Directories Found: ${sessionDirs.length}`);
    if (sessionDirs.length > 0) {
      sessionDirs.forEach((dir, index) => {
        const dirPath = path.join(sessionsDir, dir);
        const stats = fs.statSync(dirPath);
        const age = Math.round((Date.now() - stats.mtime) / 1000 / 60); // minutes
        console.log(`   ${index + 1}. ${dir} (${age} minutes old)`);
      });
    }
    console.log('');

    // Perform cleanup
    console.log('🧹 Starting cleanup process...');
    
    // Force cleanup of all sessions
    await SessionManager.performCleanup();
    
    // Clean up additional orphaned sessions if needed
    const sessionsToRemoveFromMemory = [];
    activeSessions.forEach(session => {
      const age = Date.now() - session.createdAt;
      if (age > 30 * 60 * 1000) { // Older than 30 minutes
        sessionsToRemoveFromMemory.push(session.sessionId);
      }
    });
    
    // Remove old sessions
    let removedCount = 0;
    for (const sessionId of sessionsToRemoveFromMemory) {
      try {
        await SessionManager.removeSession(sessionId, 'manual-cleanup');
        removedCount++;
        console.log(`   ✅ Removed session: ${sessionId}`);
      } catch (error) {
        console.log(`   ❌ Failed to remove session ${sessionId}: ${error.message}`);
      }
    }

    // Clean up old session directories (older than 1 hour)
    let directoriesRemoved = 0;
    for (const dirName of sessionDirs) {
      const dirPath = path.join(sessionsDir, dirName);
      const stats = fs.statSync(dirPath);
      const age = Date.now() - stats.mtime;
      
      if (age > 10 * 60 * 1000) { // Older than 10 minutes (more aggressive cleanup)
        try {
          fs.rmSync(dirPath, { recursive: true, force: true });
          directoriesRemoved++;
          console.log(`   🗑️  Removed directory: ${dirName}`);
        } catch (error) {
          console.log(`   ❌ Failed to remove directory ${dirName}: ${error.message}`);
        }
      }
    }

    // Show final stats
    console.log('\n📊 Cleanup Results:');
    console.log(`   Memory sessions removed: ${removedCount}`);
    console.log(`   Directories cleaned: ${directoriesRemoved}`);
    
    const finalStats = SessionManager.getStats();
    console.log(`   Final active sessions: ${finalStats.activeSessions}/${finalStats.maxSessions}`);
    
    console.log('\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error(error.stack);
  } finally {
    // Disconnect from database
    try {
      await mongoose.connection.close();
      console.log('📦 Disconnected from database');
    } catch (error) {
      console.log('⚠️  Error disconnecting from database:', error.message);
    }
    
    console.log('\n🏁 Session cleanup utility finished\n');
    process.exit(0);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Cleanup interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught exception:', error.message);
  process.exit(1);
});

// Run cleanup
cleanupSessions();
