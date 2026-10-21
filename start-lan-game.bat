@echo off
chcp 65001 > nul
title Космические Крестики-Нолики 3D - LAN Сервер
echo ========================================================
echo   Запуск локального сервера Космических Крестиков-Ноликов
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден в системе!
    echo Пожалуйста, установите Node.js с официального сайта: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [ИНФО] Папка node_modules не найдена. Установка зависимостей проекта...
    call npm install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось установить зависимости npm!
        pause
        exit /b 1
    )
    echo [УСПЕХ] Зависимости успешно установлены.
    echo.
)

node server.js
pause
