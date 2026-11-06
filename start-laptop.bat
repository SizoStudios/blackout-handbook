@echo off
rem Double-click to run the Blackout Handbook from this folder (works from a flash drive).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
