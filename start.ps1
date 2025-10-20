# Healthcare Supply Chain - Simple Startup
Write-Host "Starting Healthcare Supply Chain..." -ForegroundColor Green

# Start Hardhat
Write-Host "Starting blockchain..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Command", "npx hardhat node" -WindowStyle Normal
Start-Sleep 5

# Deploy contracts
Write-Host "Deploying contracts..." -ForegroundColor Yellow
npx hardhat run scripts/deploy.js --network localhost

# Start backend
Write-Host "Starting backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Command", "cd backend; python -m uvicorn main:app --host 0.0.0.0 --port 8005" -WindowStyle Normal
Start-Sleep 3

# Start frontend
Write-Host "Starting frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Command", "cd frontend; python -m http.server 8080" -WindowStyle Normal

Write-Host "All services started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:8005" -ForegroundColor Cyan

# Open browser
Start-Process "http://localhost:8080"