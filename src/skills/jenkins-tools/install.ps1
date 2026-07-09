# install.ps1 — jenkins-tools skill 安装脚本（Windows PowerShell）
# 由 setup-skills.ts 调用，安装到指定平台
# 退出码: 0=成功, 1=验证失败, 2=平台无效, 3=权限不足

param(
    [Parameter(Mandatory=$true)]
    [string]$Platform
)

$SkillName = "jenkins-tools"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$userHome = $env:USERPROFILE

# ── 日志 ────────────────────────────────────────────────────────────

function Write-Info($msg) { Write-Host "[信息]  $msg" -ForegroundColor Blue }
function Write-Ok($msg)   { Write-Host "[成功]  $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[错误]  $msg" -ForegroundColor Red }

# ── SKILL.md 验证 ───────────────────────────────────────────────────

$skillMd = Join-Path $ScriptDir "SKILL.md"
if (-not (Test-Path $skillMd)) { Write-Err "未找到 SKILL.md"; exit 1 }
$firstLine = Get-Content $skillMd -TotalCount 1
if ($firstLine -ne "---") { Write-Err "SKILL.md 格式错误"; exit 1 }
Write-Ok "SKILL.md 验证通过"

# ── 安装路径解析 ────────────────────────────────────────────────────

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
    default { Write-Err "未知平台: $Platform"; exit 2 }
}

$installDir = Join-Path $base $SkillName
Write-Info "安装目录: $installDir"

# ── 文件安装 ────────────────────────────────────────────────────────

if (Test-Path $installDir) { Remove-Item $installDir -Recurse -Force -Confirm:$false }
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

$selfName = if ($MyInvocation.PSCommandPath) { Split-Path $MyInvocation.PSCommandPath -Leaf } else { "install.ps1" }
$files = Get-ChildItem $ScriptDir -Exclude $selfName
$count = 0
foreach ($f in $files) {
    Copy-Item $f.FullName -Destination $installDir -Recurse -Force
    $count++
}
Write-Ok "已复制 $count 个文件到 $installDir"

# ── Cursor .mdc 格式适配 ────────────────────────────────────────────

if ($Platform -eq "cursor") {
    $skillMdPath = Join-Path $ScriptDir "SKILL.md"
    $mdcFile = Join-Path $installDir "$SkillName.mdc"
    # 提取 description 和 body
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
    Set-Content -Path $mdcFile -Value $mdcContent -Encoding UTF8
    Write-Ok "已生成 Cursor .mdc: $mdcFile"
}

# ── 通用路径链接 ────────────────────────────────────────────────────

if ($Platform -notin @("codex", "universal")) {
    $universalDir = Join-Path "$userHome\.agents\skills" $SkillName
    New-Item -ItemType Directory -Path "$userHome\.agents\skills" -Force | Out-Null
    if (Test-Path $universalDir) { Remove-Item $universalDir -Recurse -Force -Confirm:$false }
    New-Item -ItemType Junction -Path $universalDir -Target $installDir -Force | Out-Null
    Write-Ok "通用链接: $universalDir -> $installDir"
}

Write-Ok "Skill '$SkillName' 已安装到 $Platform"
exit 0