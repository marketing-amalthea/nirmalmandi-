# NirmalMandi - One-click local startup
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   NirmalMandi - Starting Local Dev     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Port map (matches .env):
# 3001 auth | 3002 inventory | 3003 order | 3004 payment
# 3005 notification | 3006 invoice | 3007 logistics
# 3008 analytics | 3009 dispute | 3012 search
# 3000 admin-panel | 3010 web-portal

$services = @(
  @{ name = "auth-service";         cmd = "dev:auth";         port = 3001; color = "Cyan"    },
  @{ name = "inventory-service";    cmd = "dev:inventory";    port = 3002; color = "Magenta" },
  @{ name = "order-service";        cmd = "dev:order";        port = 3003; color = "Yellow"  },
  @{ name = "payment-service";      cmd = "dev:payment";      port = 3004; color = "Green"   },
  @{ name = "notification-service"; cmd = "dev:notification"; port = 3005; color = "Blue"    },
  @{ name = "analytics-service";    cmd = "dev:analytics";    port = 3008; color = "White"   }
)

foreach ($svc in $services) {
  $script = "Set-Location '$root'; npm run $($svc.cmd)"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $script
  Write-Host "  Started $($svc.name) on port $($svc.port)" -ForegroundColor $svc.color
  Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "  Starting admin panel on port 3000..." -ForegroundColor White
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; npm run dev:admin"

Write-Host "  Starting web portal on port 3010..." -ForegroundColor White
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; npm run dev:web"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services starting up!            " -ForegroundColor Green
Write-Host "  Wait 20 seconds then open:           " -ForegroundColor Green
Write-Host "  Admin:  http://localhost:3000/login  " -ForegroundColor Cyan
Write-Host "  Web:    http://localhost:3010/login  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
