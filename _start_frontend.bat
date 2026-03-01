@echo off
set PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%
cd /d "%~dp0obsidian-chat"
rmdir /s /q .next 2>nul
npm run dev
