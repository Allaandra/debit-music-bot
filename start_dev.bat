@echo off
title TTRPG SoundBot [DEV SERVER]
chcp 65001 >nul
cd /d "%~dp0"
cls

echo ===================================================
echo       TTRPG SoundBot — Dev Server Launcher
echo ===================================================
echo.

REM 1. Проверяем наличие Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден на вашем компьютере!
    echo Для работы бота необходимо установить Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 2. Проверяем наличие .env
if not exist ".env" (
    echo [ВНИМАНИЕ] Файл .env не найден в папке бота!
    echo Убедитесь, что токен бота указан внутри файла .env.
    echo.
)

REM 3. Проверяем серверные библиотеки
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

REM 4. Проверяем базу данных
if not exist "database.sqlite" (
    echo [INFO] Инициализируем базу данных SQLite...
    call npx prisma db push
    echo.
)

REM 5. Проверяем библиотеки фронтенда
if not exist "frontend\node_modules" (
    echo [INFO] Первый запуск: устанавливаем библиотеки фронтенда...
    call npm --prefix frontend install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось установить библиотеки фронтенда.
        pause
        exit /b %errorlevel%
    )
    echo.
)

echo ===================================================
echo [OK] Запуск серверов с поддержкой Hot-Reload!
echo.
echo   * БЭКЕНД:  tsx watch (порт 3001)
echo     Авто-перезапуск сервера при правке src/*.ts
echo.
echo   * ФРОНТЕНД: Vite Dev Server (порт 5180+)
echo     Мгновенный HMR (обновление UI без перезагрузки)
echo     Если порт 5180 занят — Vite сам выберет свободный
echo.
echo   * БРАУЗЕР: откроется автоматически на порту Vite
echo ===================================================
echo.

REM 6. Запускаем Бэкенд и Фронтенд в отдельных окнах
echo [1/2] Запуск бэкенда (tsx watch)...
start "SoundBot Backend" /d "%~dp0" cmd /k "npm run dev"
echo Ожидание инициализации API сервера (3 сек)...
ping 127.0.0.1 -n 4 >nul
echo [2/2] Запуск фронтенда (Vite HMR)...
start "SoundBot Frontend" /d "%~dp0frontend" cmd /k "npm run dev -- --open --port 5180"

echo Окна серверов запущены в фоне.
echo Вы можете редактировать код прямо сейчас, изменения применятся на лету.
echo.
echo Чтобы остановить серверы, закройте открывшиеся окна терминалов.
echo.
pause
