# install.ps1 — jenkins-tools skill installer (Windows PowerShell)
# Called by setup-skills.ts to install to specified platform
# Exit codes: 0=success, 1=validation failed, 2=invalid platform, 3=permission denied

param(
    [Parameter(Mandatory=$true)]
    [string]$Platform
)

$SkillName = "jenkins-tools"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$userHome = $env:USERPROFILE

# ── Logging ─────────────────────────────────────────────────────────

function Write-Info($msg) { Write-Host "[INFO]   $msg" -ForegroundColor Blue }
function Write-Ok($msg)   { Write-Host "[OK]     $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[ERROR]  $msg" -ForegroundColor Red }

# ── SKILL.md validation ─────────────────────────────────────────────

$skillMd = Join-Path $ScriptDir "SKILL.md"
if (-not (Test-Path $skillMd)) { Write-Err "SKILL.md not found"; exit 1 }
$firstLine = Get-Content $skillMd -TotalCount 1
if ($firstLine -ne "---") { Write-Err "Invalid SKILL.md format"; exit 1 }
Write-Ok "SKILL.md validated"

# ── Install path resolution ─────────────────────────────────────────

$base = ""
switch ($Platform) {
    "claude-code"   { $base = "$userHome\.claude\skills" }
    "copilot"       { $base = "$userHome\.copilot\skills" }
    "cursor"        { $base = "$userHome\.cursor\rules" }
    "windsurf"      { $base = "$userHome\.codeium\windsurf\skills" }
    "cline"         { $base = "$userHome\.cline\skills" }
    "codex"         { $base = "$userHome\.agents\skills" }
    "gemini"        { $base = "$userHome\.gemini\skills" }
    "kiro"          { $base = "$userHome\.kiro\skills" }
    "trae"          { $base = "$userHome\.trae\rules" }
    "goose"         { $base = "$userHome\.config\goose\skills" }
    "opencode"      { $base = "$userHome\.config\opencode\skills" }
    "roo-code"      { $base = "$userHome\.roo\skills" }
    "kilo-code"     { $base = "$userHome\.kilocode\skills" }
    "factory"       { $base = "$userHome\.factory\skills" }
    "junie"         { $base = "$userHome\.junie\skills" }
    "antigravity"   { $base = "$userHome\.gemini\antigravity\skills" }
    "universal"     { $base = "$userHome\.agents\skills" }
    default { Write-Err "Unknown platform: $Platform"; exit 2 }
}

$installDir = Join-Path $base $SkillName
Write-Info "Install dir: $installDir"

# ── File installation ───────────────────────────────────────────────

if (Test-Path $installDir) { Remove-Item $installDir -Recurse -Force -Confirm:$false }
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

$selfName = if ($MyInvocation.PSCommandPath) { Split-Path $MyInvocation.PSCommandPath -Leaf } else { "install.ps1" }
$files = Get-ChildItem $ScriptDir -Exclude $selfName
$count = 0
foreach ($f in $files) {
    Copy-Item $f.FullName -Destination $installDir -Recurse -Force
    $count++
}
Write-Ok "Copied $count files to $installDir"

# ── Cursor .mdc format adapter ──────────────────────────────────────

if ($Platform -eq "cursor") {
    $skillMdPath = Join-Path $ScriptDir "SKILL.md"
    $mdcFile = Join-Path $installDir "$SkillName.mdc"
    # Extract description and body
    $lines = Get-Content $skillMdPath
    $desc = ""
    $bodyLines = @()
    $inFm = $false
    $fmCount = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -eq "---") {
            $fmCount++
            if ($fmCount -eq 1) { $inFm = $true; continue }
            if ($fmCount -eq 2) { $inFm = $false; continue }
        }
        if ($inFm -and $lines[$i] -match "^description:\s*(.+)") {
            $desc = $Matches[1]
        }
        if ($fmCount -ge 2) {
            $bodyLines += $lines[$i]
        }
    }
    $mdcContent = @"
---
description: $desc
globs:
alwaysApply: true
---
$($bodyLines -join "`n")
"@
    Set-Content -Path $mdcFile -Value $mdcContent -Encoding UTF8 -NoNewline
    Write-Ok "Generated Cursor .mdc: $mdcFile"
}

# ── Universal path link ─────────────────────────────────────────────

if ($Platform -notin @("codex", "universal")) {
    $universalDir = Join-Path "$userHome\.agents\skills" $SkillName
    New-Item -ItemType Directory -Path "$userHome\.agents\skills" -Force | Out-Null
    if (Test-Path $universalDir) { Remove-Item $universalDir -Recurse -Force -Confirm:$false }
    New-Item -ItemType Junction -Path $universalDir -Target $installDir -Force | Out-Null
    Write-Ok "Universal link: $universalDir -> $installDir"
}

Write-Ok "Skill '$SkillName' installed to $Platform"
exit 0
