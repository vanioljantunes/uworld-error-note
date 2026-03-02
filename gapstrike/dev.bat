@echo off
setlocal enabledelayedexpansion

REM Add Node.js to PATH
set "PATH=C:\Program Files\nodejs;!PATH!"

REM Run the Next.js dev server
npm run dev
