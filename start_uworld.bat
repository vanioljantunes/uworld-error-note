@echo off
title UWorld Error-Note Agent
color 0A
echo.
echo   ======================================
echo     UWorld Error-Note Agent
echo   ======================================
echo.

:: Kill any old processes on ports 3000 and 8000
echo   Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do taskkill /pid %%a /f >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING 2^>nul') do taskkill /pid %%a /f >nul 2>&1
timeout /t 2 /nobreak >nul

:: Start backend (minimized)
echo   [1/3] Starting CrewAI backend (port 8000)...
start /b "" cmd /c "%~dp0_start_backend.bat"
timeout /t 3 /nobreak >nul
echo         Done.

:: Start frontend (minimized)
echo   [2/3] Starting frontend (port 3000)...
start /b "" cmd /c "%~dp0_start_frontend.bat"
timeout /t 12 /nobreak >nul
echo         Done.

:: Open browser
echo   [3/3] Opening browser...
start http://localhost:3000
echo         Done.
echo.
echo   ======================================
echo     Servers running!
echo     Press any key to STOP all servers.
echo   ======================================
pause >nul

:: Kill everything
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do taskkill /pid %%a /f >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING 2^>nul') do taskkill /pid %%a /f >nul 2>&1
echo.
echo   Servers stopped. Goodbye!
timeout /t 2 /nobreak >nul
