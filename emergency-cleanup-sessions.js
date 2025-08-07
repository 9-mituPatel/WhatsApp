#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('\n🚨 ===== EMERGENCY SESSION CLEANUP =====\n');

async function emergencyCleanup() {
  try {
    const sessionsDir = path.join(process.cwd(), 'sessions');
    
    if (!fs.existsSync(sessionsDir)) {
      console.log('❌ Sessions directory not found');
      return;
    }

    // Get all session directories
    const sessionDirs = fs.readdirSync(sessionsDir).filter(dir => {
      const dirPath = path.join(sessionsDir, dir);
      return fs.statSync(dirPath).isDirectory();
    });

    console.log(`📁 Found ${sessionDirs.length} session directories`);

    if (sessionDirs.length === 0) {
      console.log('✅ No session directories to clean up');
      return;
    }

    // Remove all session directories
    let removedCount = 0;
    let failedCount = 0;

    for (const dirName of sessionDirs) {
      const dirPath = path.join(sessionsDir, dirName);
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
        removedCount++;
        console.log(`   🗑️  Removed: ${dirName}`);
      } catch (error) {
        failedCount++;
        console.log(`   ❌ Failed to remove ${dirName}: ${error.message}`);
      }
    }

    console.log(`\n📊 Cleanup Results:`);
    console.log(`   ✅ Directories removed: ${removedCount}`);
    console.log(`   ❌ Failed removals: ${failedCount}`);
    console.log(`   📁 Remaining directories: ${sessionDirs.length - removedCount}`);

    if (removedCount > 0) {
      console.log('\n✅ Emergency cleanup completed successfully!');
      console.log('💡 You can now start new WhatsApp sessions without hitting the limit.');
    } else {
      console.log('\n⚠️  No directories were removed. Check permissions.');
    }

  } catch (error) {
    console.error('\n❌ Emergency cleanup failed:', error.message);
    console.error(error.stack);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Emergency cleanup interrupted by user');
  process.exit(1);
});

// Run emergency cleanup
emergencyCleanup().then(() => {
  console.log('\n🏁 Emergency cleanup finished\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
