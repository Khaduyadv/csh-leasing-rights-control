@echo off
cd /d "%~dp0"
set PORT=8876
where py >nul 2>nul
if %errorlevel%==0 (
  start "CSH Preview Server" cmd /k "cd /d "%~dp0" && py -m http.server %PORT% --bind 127.0.0.1"
) else (
  start "CSH Preview Server" cmd /k "cd /d "%~dp0" && python -m http.server %PORT% --bind 127.0.0.1"
)
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:%PORT%/?app=CSH
exit
