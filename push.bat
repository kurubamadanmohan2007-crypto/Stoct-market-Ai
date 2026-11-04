@echo off
echo ========================================================
echo  Pushing Stock Market AI to GitHub
echo  Repository: https://github.com/kurubamadanmohan2007-crypto/Stoct-market-Ai.git
echo ========================================================
cd /d "%~dp0"
set PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%PATH%
git push -u origin main
echo.
pause
