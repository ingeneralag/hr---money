@echo off
echo Starting HR System - Both Servers...
echo.

REM Start Backend Server
echo Starting Backend Server...
start "HR Backend" cmd /c "cd backend && set MONGODB_URI=mongodb://127.0.0.1:27017/hr-system && set PORT=5001 && set JWT_SECRET=hr_time_tracker_secret_key_2024_production_secure && npm start"

REM Wait for backend to start
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

REM Start Frontend Server  
echo Starting Frontend Server...
start "HR Frontend" cmd /c "cd frontend && npm start"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5001
echo Frontend: http://localhost:3000
echo.
echo Press any key to close this window...
pause 