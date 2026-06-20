<#
.SYNOPSIS
  trust-saas 를 정적(static export)으로 빌드해 GitHub Pages 에 배포한다 (renewaide 방식).
  계약서 자동화(클라이언트 전용)는 동작; 서버 라우트(/api/*)·미들웨어는 정적 빌드 호환을 위해
  빌드 동안만 잠시 비활성(항상 원복) → 그 링크에서는 AI 상담/대화입력 비활성.
  결과: https://{owner}.github.io/{Repo}/
.NOTES
  사전: gh 인증, $env:GH_TOKEN(repo PAT). basePath 는 next.config.ts(DEPLOY_TARGET=pages) 에서 /trust-saas.
#>
param([string]$Repo = "trust-saas")

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:USERPROFILE\scoop\apps\gh\current\bin;$env:PATH"

$root = Split-Path $PSScriptRoot -Parent          # trust-saas
$mw   = Join-Path $root "src\middleware.ts"
$mwB  = "$mw.deploybak"
$api  = Join-Path $root "src\app\api"
$apiB = Join-Path $root "src\app\__api_deploybak"
$out  = Join-Path $root "out"

if (-not $env:GH_TOKEN) { $env:GH_TOKEN = [Environment]::GetEnvironmentVariable('GH_TOKEN','User') }
if (-not $env:GH_TOKEN) { Write-Error "GH_TOKEN 필요"; exit 1 }
$owner = (gh api user --jq .login 2>$null)
if (-not $owner) { Write-Error "GitHub 계정 조회 실패"; exit 1 }

Set-Location $root
try {
  # 1) 정적 export 비호환 요소 잠시 비활성
  if (Test-Path $mw)  { Move-Item $mw  $mwB  -Force }
  if (Test-Path $api) { Move-Item $api $apiB -Force }

  # 2) 정적 빌드
  $env:DEPLOY_TARGET = "pages"
  Write-Host "[*] next build (static export) ..." -ForegroundColor Cyan
  & npx next build
  if ($LASTEXITCODE -ne 0) { throw "next build 실패" }
  if (-not (Test-Path $out)) { throw "out/ 생성 안됨" }

  # 3) Pages 보정: Jekyll 비활성(_next 폴더 보존), SPA 404
  New-Item -ItemType File (Join-Path $out ".nojekyll") -Force | Out-Null
  if (Test-Path (Join-Path $out "404.html")) { } # next export가 생성
}
finally {
  # 4) 항상 원복
  if (Test-Path $mwB)  { Move-Item $mwB  $mw  -Force }
  if (Test-Path $apiB) { Move-Item $apiB $api -Force }
  Remove-Item Env:\DEPLOY_TARGET -ErrorAction SilentlyContinue
}

# 5) out/ 을 Pages 저장소로 push (격리된 git, 토큰 내장 remote)
Push-Location $out
try {
  if (-not (Test-Path ".git")) { git init -b main 2>&1 | Out-Null }
  "" | Set-Content ".nojekyll" -NoNewline -ErrorAction SilentlyContinue
  git add -A 2>&1 | Out-Null
  git -c user.email="bot@trust.local" -c user.name="trust-bot" commit -m "deploy $(Get-Random)" 2>&1 | Out-Null
  gh repo view "$owner/$Repo" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { gh repo create "$owner/$Repo" --public 2>&1 | Out-Null }
  git remote remove origin 2>$null | Out-Null
  git remote add origin "https://x-access-token:$($env:GH_TOKEN)@github.com/$owner/$Repo.git"
  git push -u origin main --force 2>&1 | Out-Null
  gh api -X POST "repos/$owner/$Repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null | Out-Null
}
finally { Pop-Location }

$url = "https://$owner.github.io/$Repo/"
Write-Host ""
Write-Host "===== Done =====" -ForegroundColor Cyan
Write-Host "  Repo:  https://github.com/$owner/$Repo"
Write-Host "  Pages: $url" -ForegroundColor Green
Write-Host "  (Pages 최초 빌드 수 분 소요. /app 계약서 자동화 동작, AI 상담/대화입력 비활성)"
