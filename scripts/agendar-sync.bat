@echo off
REM Script para agendar sincronização automática de vouchers
REM Roda todo dia 1º de cada mês às 08:00

echo.
echo ========================================
echo  AGENDADOR DE SYNC AUTOMÁTICO
echo ========================================
echo.
echo Este script vai criar uma tarefa no Windows Task Scheduler
echo que executa a sincronização TODO DIA 1 às 08:00
echo.
pause

REM Criar tarefa agendada
schtasks /create /tn "Buddha Spa - Sync Vouchers" /tr "node %CD%\local-sync.js" /sc monthly /d 1 /st 08:00 /ru "%USERNAME%" /f

echo.
echo ✅ Tarefa agendada criada com sucesso!
echo.
echo A sincronização vai rodar automaticamente todo dia 1º às 08:00
echo.
echo Para ver a tarefa: Painel de Controle ^> Tarefas Agendadas
echo Para testar agora: schtasks /run /tn "Buddha Spa - Sync Vouchers"
echo.
pause
