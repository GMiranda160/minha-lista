@echo off
REM Roda o Minha Lista em modo desenvolvimento em http://localhost:3000
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e tente de novo.
    pause
    exit /b 1
)

if not exist ".env.local" (
    echo [ERRO] Arquivo .env.local nao encontrado.
    echo Copie o .env.example para .env.local e preencha com os dados do seu projeto Supabase.
    pause
    exit /b 1
)

if not exist "node_modules\next" (
    echo Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo [ERRO] Falha no npm install.
        pause
        exit /b 1
    )
)

echo Abrindo o navegador em alguns segundos...
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"

call npm run dev
if errorlevel 1 pause
