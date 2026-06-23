@echo off
title Financas - Servidor local
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo.
echo Iniciando o projeto Financas em http://127.0.0.1:3000
echo Mantenha esta janela aberta enquanto estiver usando o site.
echo.
call "C:\Program Files\nodejs\npm.cmd" start
echo.
echo O servidor foi encerrado.
pause
