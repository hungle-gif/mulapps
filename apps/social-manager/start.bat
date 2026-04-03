@echo off
echo ====================================
echo  Social Manager - Startup Script
echo ====================================
echo.

:: Step 1: Close existing Chrome (optional)
:: taskkill /F /IM chrome.exe 2>nul

:: Step 2: Start Chrome with debug port
echo [1/3] Starting Chrome with CDP debug port 9222...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="C:\Users\Admin\AppData\Local\Google\Chrome\User Data" ^
  --profile-directory="Default"

:: Wait for Chrome to start
timeout /t 3 /nobreak >nul

:: Step 3: Verify Chrome CDP is available
echo [2/3] Verifying Chrome connection...
curl -s http://localhost:9222/json/version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Chrome CDP not available. Make sure no other Chrome is running.
  echo TIP: Close all Chrome windows first, then run this script again.
  pause
  exit /b 1
)
echo Chrome CDP ready on port 9222

:: Step 4: Start Social Manager server
echo [3/3] Starting Social Manager server...
cd /d "%~dp0"
npx tsx src/server.ts
