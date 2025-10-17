@echo off
echo =======================================
echo Local Testing Script for Repliz Auto
echo =======================================
echo.

set BASE_URL=http://localhost:8787

echo [1] Testing Security Headers...
echo -------------------------------
curl -I %BASE_URL% 2>nul | findstr /C:"X-Frame-Options" /C:"X-Content-Type-Options" /C:"X-XSS-Protection"
echo.

echo [2] Testing Register Endpoint...
echo --------------------------------
curl -X POST %BASE_URL%/api/register -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"Test123456\"}"
echo.
echo.

echo [3] Testing Login Endpoint...
echo -----------------------------
curl -X POST %BASE_URL%/api/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"Test123456\"}"
echo.
echo.

echo [4] Testing XSS Prevention...
echo -----------------------------
echo Trying to inject script tag in email...
curl -X POST %BASE_URL%/api/register -H "Content-Type: application/json" -d "{\"email\":\"^<script^>alert(1)^</script^>test2@example.com\",\"password\":\"Test123456\"}"
echo.
echo.

echo [5] Testing Rate Limiting...
echo ---------------------------
echo Making 7 login attempts (should block after 5)...
for /L %%i in (1,1,7) do (
    echo Attempt %%i:
    curl -X POST %BASE_URL%/api/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"wrongpassword\"}" 2>nul
    echo.
)
echo.

echo =======================================
echo Testing Complete!
echo =======================================
pause
