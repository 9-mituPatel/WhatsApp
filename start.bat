@echo off
echo Starting WhatsApp Backend Server...
echo.
echo Checking Redis connection...
docker exec whatsapp-redis redis-cli ping
if %ERRORLEVEL% neq 0 (
    echo Redis is not running. Starting Redis...
    docker-compose up -d
    timeout /t 3 /nobreak >nul
)

echo.
echo Starting Node.js server...
npm run dev
