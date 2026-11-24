@echo off
if "%~1"=="" (echo Drag an image onto this file. & pause & exit /b 2)
"%~dp0TravnyAIUpscale.exe" "%~1" 2
pause
