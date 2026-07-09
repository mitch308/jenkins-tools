# install.ps1 — Cross-platform skill installation script for jenkins-tools-skill
# PowerShell version (Windows)
# Exit codes:
#   0 — Success
#   1 — Validation failed
#   2 — Platform not detected
#   3 — Permission denied

param(
    [string]$Platform = "",
    [switch]$Project = $false,
    [string]$Path = "",
    [switch]$All = $false,
    [switch]$DryRun = $false
)

$SkillName = "jenkins-tools-skill"
$Version = "1.0.0"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ErrorActionPreference = "Stop"

# ── Logging helpers ────────────────────────────────────────────────

function Write-Info($msg)    { Write-Host "[INFO]  $msg" -ForegroundColor Blue }
function Write-Ok($msg)      { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# ── SKILL.md validation ───────────────────────────────────────────

function Validate-SkillMd {
    $skillMd = Join-Path $ScriptDir "SKILL.md"
    if (-not (Test-Path $skillMd)) {
        Write-Err "SKILL.md not found in $ScriptDir"
        exit 1
    }
    $firstLine = Get-Content $skillMd -TotalCount 1
    if ($firstLine -ne "---") {
        Write-Err "SKILL.md must start with YAML frontmatter (---)"
        exit 1
    }
    Write-Ok "SKILL.md validated"
}

# ── Platform detection ─────────────────────────────────────────────

$SupportedPlatforms = "claude-code, copilot, cursor, windsurf, cline, codex, gemini, kiro, trae, goose, opencode, roo-code, kilo-code, factory, junie, antigravity, universal"

function Detect-Platform {
    if ($Platform -ne "") {
        $valid = $SupportedPlatforms -split ", " | Where-Object { $_ -eq $Platform }
        if ($valid.Count -eq 0) {
            Write-Err "Unknown platform: $Platform"
            Write-Err "Supported: $SupportedPlatforms"
            exit 2
        }
        Write-Info "Platform explicitly set to: $Platform"
        return
    }

    $userHome = $env:USERPROFILE
    if (Test-Path "$userHome\.claude") { $Script:Platform = "claude-code" }
    elseif (Test-Path "$userHome\.copilot") { $Script:Platform = "copilot" }
    elseif (Test-Path ".cursor") { $Script:Platform = "cursor" }
    elseif (Test-Path "$userHome\.codeium\windsurf") { $Script:Platform = "windsurf" }
    elseif (Test-Path "$userHome\.cline") { $Script:Platform = "cline" }
    elseif (Test-Path "$userHome\.gemini") { $Script:Platform = "gemini" }
    elseif (Test-Path ".kiro") { $Script:Platform = "kiro" }
    elseif (Test-Path ".trae") { $Script:Platform = "trae" }
    elseif (Test-Path "$userHome\.roo") { $Script:Platform = "roo-code" }
    elseif (Test-Path "$userHome\.kilocode") { $Script:Platform = "kilo-code" }
    elseif (Test-Path "$userHome\.factory") { $Script:Platform = "factory" }
    elseif (Test-Path ".junie") { $Script:Platform = "junie" }
    elseif (Test-Path "$userHome\.config\goose") { $Script:Platform = "goose" }
    elseif (Test-Path "$userHome\.config\opencode") { $Script:Platform = "opencode" }
    elseif (Test-Path "$userHome\.agents") { $Script:Platform = "universal" }
    else {
        Write-Err "Could not auto-detect any supported AI coding platform."
        Write-Err "Use -Platform to specify one explicitly."
        exit 2
    }
    Write-Info "Auto-detected platform: $Platform"
}

# ── Install path resolution ────────────────────────────────────────

function Resolve-InstallPath {
    $userHome = $env:USERPROFILE
    $base = ""

    if ($Path -ne "") {
        $Script:InstallDir = $Path
        Write-Info "Using custom install path: $InstallDir"
        return
    }

    if ($Project) {
        switch ($Platform) {
            "claude-code"   { $base = ".claude\skills" }
            "copilot"       { $base = ".github\skills" }
            "cursor"        { $base = ".cursor\rules" }
            "windsurf"      { $base = ".windsurf\rules" }
            "cline"         { $base = ".clinerules\skills" }
            "codex"         { $base = ".agents\skills" }
            "gemini"        { $base = ".gemini\skills" }
            "kiro"          { $base = ".kiro\skills" }
            "trae"          { $base = ".trae\rules" }
            "goose"         { $base = ".goose\skills" }
            "opencode"      { $base = ".opencode\skills" }
            "roo-code"      { $base = ".roo\skills" }
            "kilo-code"     { $base = ".kilocode\skills" }
            "factory"       { $base = ".factory\skills" }
            "junie"         { $base = ".junie\skills" }
            "antigravity"   { $base = ".agent\skills" }
            "universal"     { $base = ".agents\skills" }
        }
        $Script:InstallDir = Join-Path (Get-Location) "$base\$SkillName"
    } else {
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
        }
        $Script:InstallDir = Join-Path $base $SkillName
    }
    Write-Info "Install directory: $InstallDir"
}

# ── File installation ──────────────────────────────────────────────

function Install-Files {
    if ($DryRun) {
        Write-Host ""
        Write-Host "Dry-run mode - no files will be copied." -ForegroundColor Cyan
        Write-Host ""
        Write-Info "Would create directory: $InstallDir"
        $files = Get-ChildItem $ScriptDir -Exclude (Split-Path $MyInvocation.PSCommandPath -Leaf)
        foreach ($f in $files) {
            Write-Info "Would copy: $($f.Name)"
        }
        return
    }

    if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    $files = Get-ChildItem $ScriptDir -Exclude (Split-Path $MyInvocation.PSCommandPath -Leaf)
    $count = 0
    foreach ($f in $files) {
        Copy-Item $f.FullName -Destination $InstallDir -Recurse -Force
        $count++
    }
    Write-Ok "Copied $count file(s) to $InstallDir"
}

# ── Universal secondary install ────────────────────────────────────

function Install-UniversalSecondary {
    if ($Platform -in @("codex", "universal")) { return }
    $userHome = $env:USERPROFILE
    $universalDir = Join-Path "$userHome\.agents\skills" $SkillName

    if ($DryRun) {
        Write-Info "Would create universal link: $universalDir -> $InstallDir"
        return
    }

    New-Item -ItemType Directory -Path "$userHome\.agents\skills" -Force | Out-Null
    if (Test-Path $universalDir) { Remove-Item $universalDir -Recurse -Force }

    # Use directory junction (Windows symlink alternative)
    New-Item -ItemType Junction -Path $universalDir -Target $InstallDir -Force | Out-Null
    Write-Ok "Universal junction: $universalDir -> $InstallDir"
}

# ── Activation instructions ────────────────────────────────────────

function Print-Activation {
    if ($DryRun) { return }
    Write-Host ""
    Write-Host "Installation complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Skill installed at: $InstallDir" -ForegroundColor White
    Write-Host ""
    Write-Host "To use the skill:"
    Write-Host "  1. Open a new session in your AI tool."
    Write-Host "  2. Invoke with /jenkins-tools or use trigger phrases:"
    Write-Host "     - 'trigger Jenkins build', 'check build status', 'abort Jenkins job'"
    Write-Host "  3. Ensure jkt CLI is installed: npm install -g jenkins-tools-cli"
    Write-Host ""
}

# ── Main ───────────────────────────────────────────────────────────

Write-Host "Installing skill: $SkillName" -ForegroundColor White
Write-Host "----------------------------------------"

Validate-SkillMd
Detect-Platform
Resolve-InstallPath
Install-Files
Install-UniversalSecondary
Print-Activation

if ($DryRun) {
    Write-Info "Dry run complete. No changes were made."
} else {
    Write-Ok "Skill '$SkillName' installed successfully for $Platform."
}

exit 0