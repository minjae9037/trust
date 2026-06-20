<#
.SYNOPSIS
  trust 저장소를 격리된 임시 폴더에 clone 해 정적(static export) 빌드 후 GitHub Pages 배포.
  실행 중 워커/파일워처의 파일 락과 무관하게 동작(깨끗한 체크아웃에서 middleware·api 제거 가능).
  결과: https://{owner}.github.io/{Repo}/
#>
param(
  [string]$Repo  = "trust-saas",
  [string]$Src   = "trust",          # 소스 저장소(monorepo) 이름
  [string]$Temp  = "D:\Claude_Cowork\_trust_deploy"
)
# Continue: git/npm 의 정상 stderr 가 PS Stop 정책에 의해 치명적 오류로 처리되는 것 방지.
# 실패 판정은 $LASTEXITCODE / Test-Path 로 명시적으로 한다.
$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:USERPROFILE\scoop\apps\gh\current\bin;$env:PATH"

if (-not $env:GH_TOKEN) { $env:GH_TOKEN = [Environment]::GetEnvironmentVariable('GH_TOKEN','User') }
if (-not $env:GH_TOKEN) { Write-Error "GH_TOKEN 필요"; exit 1 }
$owner = (gh api user --jq .login 2>$null)
if (-not $owner) { Write-Error "GitHub 계정 조회 실패"; exit 1 }

# 0) 깨끗한 임시 폴더
if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force }
New-Item -ItemType Directory $Temp | Out-Null

# 1) clone (committed snapshot = 현재 UI 전부 포함)
Write-Host "[*] clone $owner/$Src ..." -ForegroundColor Cyan
git clone --depth 1 "https://x-access-token:$($env:GH_TOKEN)@github.com/$owner/$Src.git" "$Temp\src" 2>&1 | ForEach-Object { "$_" } | Out-Null
if (-not (Test-Path "$Temp\src\.git")) { throw "clone 실패 (LASTEXITCODE=$LASTEXITCODE)" }
$app = "$Temp\src\trust-saas"
if (-not (Test-Path $app)) { throw "clone 안에 trust-saas 없음" }

# 2) 정적 export 비호환 요소 제거(클론이라 락 없음)
Remove-Item "$app\src\middleware.ts" -Force -ErrorAction SilentlyContinue
Remove-Item "$app\src\app\api" -Recurse -Force -ErrorAction SilentlyContinue

# 3) export용 next.config 덮어쓰기
@'
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/trust-saas",
  assetPrefix: "/trust-saas",
  images: { unoptimized: true },
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: "/trust-saas" },
};
export default nextConfig;
'@ | Set-Content "$app\next.config.ts" -Encoding UTF8

Set-Location $app
Write-Host "[*] npm ci ..." -ForegroundColor Cyan
& npm ci 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { & npm install 2>&1 | Out-Null }

Write-Host "[*] next build (static export) ..." -ForegroundColor Cyan
& npx next build
if ($LASTEXITCODE -ne 0) { throw "next build 실패" }
$out = "$app\out"
if (-not (Test-Path $out)) { throw "out/ 생성 안됨" }
New-Item -ItemType File "$out\.nojekyll" -Force | Out-Null

# 4) out/ 을 Pages 저장소로 push
Push-Location $out
try {
  git init -b main 2>&1 | Out-Null
  git add -A 2>&1 | Out-Null
  git -c user.email="bot@trust.local" -c user.name="trust-bot" commit -m "deploy $(Get-Random)" 2>&1 | Out-Null
  gh repo view "$owner/$Repo" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { gh repo create "$owner/$Repo" --public 2>&1 | Out-Null }
  git remote add origin "https://x-access-token:$($env:GH_TOKEN)@github.com/$owner/$Repo.git" 2>$null | Out-Null
  git push -u origin main --force 2>&1 | Out-Null
  gh api -X POST "repos/$owner/$Repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null | Out-Null
}
finally { Pop-Location }

$url = "https://$owner.github.io/$Repo/"
Write-Host ""
Write-Host "===== Done =====" -ForegroundColor Cyan
Write-Host "  Repo:  https://github.com/$owner/$Repo"
Write-Host "  Pages: $url" -ForegroundColor Green
