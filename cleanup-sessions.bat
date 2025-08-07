@echo off
echo.
echo ================================
echo   WhatsApp Session Cleanup
echo ================================
echo.
echo Cleaning up WhatsApp sessions...
echo.

cd /d "D:\WhatsApp"
node cleanup-sessions.js

echo.
echo Cleanup completed. Press any key to exit...
pause >nul
