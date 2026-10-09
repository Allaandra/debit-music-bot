@echo off
echo Starting TTRPG SoundBot...
echo The web remote will open in your browser automatically.

:: Запускаем таймер в фоне, чтобы браузер открылся после того как запустится сервер
start "" /b cmd /c "ping localhost -n 4 >nul & start http://localhost:3001"

:: Запускаем самого бота
npm start
pause
