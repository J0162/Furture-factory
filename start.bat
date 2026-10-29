@echo off
start "Python API" /d "C:\Users\Jason\OneDrive\Documenten\Fontys ICT\Project furture factory\website\Bestelling ontvangen" cmd /k venv\Scripts\python.exe APIServer.py
cd /d "C:\Users\Jason\OneDrive\Documenten\Fontys ICT\Project furture factory\Dashboard\Server"
node server.js