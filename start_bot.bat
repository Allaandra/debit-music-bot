@echo off
title TTRPG SoundBot Launcher
chcp 65001 >nul
cls

echo ===================================================
echo            TTRPG SoundBot Launcher
echo ===================================================
echo.

REM 1. Проверяем наличие Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден на вашем компьютере!
    echo Для работы бота необходимо установить Node.js - рекомендуется LTS версия:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 2. Проверяем наличие файла настроек .env
if not exist ".env" (
    echo [ВНИМАНИЕ] Файл .env не найден в папке бота!
    echo Убедитесь, что токен бота указан внутри файла .env.
    echo.
)

REM 3. Проверяем установку серверных библиотек
if not exist "node_modules" (
    echo [INFO] Первый запуск: устанавливаем серверные библиотеки...
    call npm install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось установить серверные библиотеки.
        pause
        exit /b %errorlevel%
    )
    echo [INFO] Генерируем клиент базы данных Prisma...
    call npx prisma generate
    echo.
)

REM 4. Проверяем и инициализируем базу данных
if not exist "database.sqlite" (
    echo [INFO] Инициализируем базу данных SQLite...
    call npx prisma db push
    echo.
)

REM 5. Проверяем наличие скомпилированного интерфейса
if not exist "frontend\dist" (
    if not exist "frontend\node_modules" (
        echo [INFO] Первый запуск: устанавливаем библиотеки интерфейса...
        call npm --prefix frontend install
        if %errorlevel% neq 0 (
            echo [ОШИБКА] Не удалось установить библиотеки интерфейса.
            pause
            exit /b %errorlevel%
        )
        echo.
    )
    echo [INFO] Первый запуск: компилируем веб-пульт ДМа...
    call npm --prefix frontend run build
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось собрать фронтенд.
        pause
        exit /b %errorlevel%
    )
    echo.
)

echo ===================================================
echo [OK] Бот запускается!
echo Веб-пульт откроется в браузере через пару секунд...
echo ===================================================
echo.

REM Автоматически открываем браузер через 4 секунды
start "" /b cmd /c "ping localhost -n 4 >nul & start http://localhost:3001"

REM Запуск сервера бота
call npm start

REM При завершении работы
echo.
echo ===================================================
echo Бот остановил свою работу.
echo ===================================================
pause
