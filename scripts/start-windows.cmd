@echo off
setlocal

set "ROOT_DIR=%~dp0.."
set "LOG_DIR=%ROOT_DIR%\logs"
set "API_LOG=%LOG_DIR%\api.log"
set "WEB_LOG=%LOG_DIR%\web.log"
set "WEB_URL=http://127.0.0.1:18080"
set "API_URL=http://127.0.0.1:18081/api/health"
set "API_ENTRY=%ROOT_DIR%\apps\api\main.py"
set "WEB_DIR=%ROOT_DIR%\apps\web"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
pushd "%ROOT_DIR%"

start "finereport-api" cmd /c "uv run python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 18081 > \"%API_LOG%\" 2>&1"
start "finereport-web" cmd /c "pnpm --dir apps/web dev --host 127.0.0.1 --port 18080 > \"%WEB_LOG%\" 2>&1"

echo API entry: %API_ENTRY%
echo Web entry: %WEB_DIR%
echo Web URL: %WEB_URL%
echo API health: %API_URL%
echo Logs: %API_LOG% %WEB_LOG%
start "" "http://127.0.0.1:18080"

popd
endlocal
