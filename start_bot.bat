@echo off
echo ==============================================
echo TTRPG SoundBot - Starting server...
echo ==============================================

cd /d "%~dp0"

echo Checking dependencies...
if not exist "node_modules\" (
    echo Installing backend libraries... This will take a moment.
    call npm install
)

if not exist "frontend\node_modules\" (
    echo Installing frontend libraries...
    cd frontend
    call npm install
    cd ..
)

echo Building React frontend...
cd frontend
call npm run build
cd ..

echo Starting bot...
start http://localhost:3001
npm start

pause
