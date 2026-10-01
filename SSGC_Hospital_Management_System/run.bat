@echo off
TITLE SSGC Hospital Management System Launcher
COLOR 0B

echo =========================================================================
echo             SSGC HOSPITAL MANAGEMENT SYSTEM (HMS)
echo =========================================================================
echo.
echo Starting local web server on port 8080...
cd /d "%~dp0"
start "SSGC HMS Web Server (Port 8080)" python -m http.server 8080

timeout /t 2 >nul

echo.
echo Opening SSGC Hospital Management System in your default browser...
start http://localhost:8080/home.html

echo.
echo =========================================================================
echo  [ONLINE] Server running at http://localhost:8080/
echo  - Home Page:        http://localhost:8080/home.html
echo  - Staff Login:      http://localhost:8080/login.html
echo  - Dashboard:        http://localhost:8080/dashboard.html
echo  - Bed & Ward:       http://localhost:8080/admission-bed.html
echo  - Appointments:     http://localhost:8080/appointment-management.html
echo  - Patients:         http://localhost:8080/patient-management.html
echo =========================================================================
echo.
pause
