# อัปเดตระบบในคำสั่งเดียว: build -> commit -> push GitHub -> (ถ้ามี clasp) push + deploy Apps Script
#   .\deploy.ps1 "ข้อความ commit"        ถามยืนยันก่อน push/deploy
#   .\deploy.ps1 "ข้อความ" -Yes          ไม่ถามยืนยัน
#   .\deploy.ps1 "ข้อความ" -NoDeploy     ทำถึง push GitHub เท่านั้น
# ตั้งค่า Apps Script ครั้งเดียว: ดูหัวข้อ "อัปเดตอัตโนมัติ" ใน คู่มือติดตั้ง.md
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Message,
  [switch]$Yes,
  [switch]$NoDeploy
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Confirm-Step($q) {
  if ($Yes) { return $true }
  return ((Read-Host "$q (y/n)") -match '^[yY]')
}
function Run($exe, $argList) {
  & $exe @argList
  if ($LASTEXITCODE -ne 0) { throw "$exe ล้มเหลว (exit $LASTEXITCODE)" }
}

# 1) build
Write-Host '== 1/4 build ==' -ForegroundColor Cyan
& (Join-Path $root 'install\build.ps1')
$sh = Join-Path $env:ProgramFiles 'Git\bin\sh.exe'
if (Test-Path $sh) { Run $sh @('preview/build-artifact.sh') } else { Write-Warning 'ไม่พบ sh.exe ของ Git — ข้าม preview/docs' }

# 2) commit
Write-Host '== 2/4 commit ==' -ForegroundColor Cyan
Run 'git' @('add', '-A')
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $name = git config user.name; $mail = git config user.email
  $cfg = @()
  if (-not $name -or -not $mail) {   # ยังไม่ได้ตั้ง git user → ใช้ผู้เขียน commit ล่าสุดของ repo
    $cfg = @('-c', "user.name=$(git log -1 --format=%an)", '-c', "user.email=$(git log -1 --format=%ae)")
  }
  Run 'git' ($cfg + @('commit', '-q', '-m', $Message))
  git log --oneline -1
} else { Write-Host 'ไม่มีการเปลี่ยนแปลงให้ commit' }

# 3) push GitHub (อัปเดต GitHub Pages)
Write-Host '== 3/4 push GitHub ==' -ForegroundColor Cyan
if (Confirm-Step 'push ขึ้น GitHub (หน้าเว็บ GitHub Pages จะเปลี่ยนทันที)?') { Run 'git' @('push') } else { Write-Host 'ข้าม push' }

# 4) Apps Script: clasp push + deploy ไปที่ลิงก์ /exec เดิม
Write-Host '== 4/4 Apps Script ==' -ForegroundColor Cyan
$cfgFile = Join-Path $root 'deploy.config.json'
$ready = (-not $NoDeploy) -and (Get-Command clasp -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $root '.clasp.json')) -and (Test-Path $cfgFile)
if (-not $ready) {
  Write-Host 'ข้ามขั้น Apps Script (ยังไม่ตั้งค่า clasp หรือใช้ -NoDeploy) — วาง install\Code.gs และ install\Index.html เองแล้ว Deploy → New version' -ForegroundColor Yellow
  return
}
$depId = (Get-Content $cfgFile -Raw | ConvertFrom-Json).deploymentId
if (-not $depId) { throw 'deploy.config.json ไม่มี deploymentId' }
Copy-Item (Join-Path $root 'appsscript.json') (Join-Path $root 'install\appsscript.json') -Force
if (Confirm-Step "push โค้ดเข้า Apps Script และ deploy เวอร์ชันใหม่ไปที่ $depId (กระทบระบบที่หน่วยงานใช้อยู่)?") {
  Run 'clasp' @('push', '-f')
  Run 'clasp' @('deploy', '-i', $depId, '-d', $Message)
  Write-Host 'deploy เสร็จแล้ว' -ForegroundColor Green
} else { Write-Host 'ข้าม deploy' }
