@echo off
echo ====================================
echo Starting Repliz Auto Local Server
echo ====================================
echo.

REM Set the CF_SECRET for local development
echo Setting up local secrets...
echo **************************************************************** | wrangler secret put CF_SECRET --local

echo.
echo Starting development server...
echo Server will be available at: http://localhost:8787
echo.
echo Press Ctrl+C to stop the server
echo ====================================
echo.

npm run dev
