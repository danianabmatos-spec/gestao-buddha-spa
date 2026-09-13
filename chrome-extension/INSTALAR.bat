@echo off
echo.
echo ========================================
echo  INSTALADOR - Extensao Buddha Spa
echo ========================================
echo.
echo PASSOS:
echo.
echo 1. Abrir Chrome em: chrome://extensions/
echo 2. Ativar "Modo do desenvolvedor" (canto superior direito)
echo 3. Clicar "Carregar sem compactacao"
echo 4. Selecionar ESTA pasta: %CD%
echo.
echo Pressione qualquer tecla para abrir o Chrome...
pause > nul

start chrome chrome://extensions/

echo.
echo Agora:
echo 1. Ative o "Modo do desenvolvedor"
echo 2. Clique "Carregar sem compactacao"
echo 3. Selecione a pasta que acabou de abrir
echo.
pause
