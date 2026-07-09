#!/bin/sh
# install.sh — jenkins-tools skill 安装脚本（macOS/Linux）
# 由 setup-skills.ts 调用，安装到指定平台
# 退出码: 0=成功, 1=验证失败, 2=平台无效, 3=权限不足

set -eu

SKILL_NAME="jenkins-tools"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 颜色 ────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
else
    RED=''; GREEN=''; BLUE=''; BOLD=''; NC=''
fi
info()    { printf "${BLUE}[信息]${NC}  %s\n" "$1"; }
success() { printf "${GREEN}[成功]${NC}  %s\n" "$1"; }
error()   { printf "${RED}[错误]${NC} %s\n" "$1" >&2; }

# ── 参数 ────────────────────────────────────────────────────────────
PLATFORM=""
if [ $# -ge 1 ]; then PLATFORM="$1"; fi

if [ -z "$PLATFORM" ]; then
    error "用法: install.sh <平台名>"
    error "支持: claude-code, copilot, cursor, windsurf, cline, codex, gemini, kiro, trae, goose, opencode, roo-code, kilo-code, factory, junie, antigravity, universal"
    exit 2
fi

# ── SKILL.md 验证 ───────────────────────────────────────────────────
skill_md="${SCRIPT_DIR}/SKILL.md"
if [ ! -f "$skill_md" ]; then error "未找到 SKILL.md"; exit 1; fi
first_line="$(head -n 1 "$skill_md")"
if [ "$first_line" != "---" ]; then error "SKILL.md 格式错误"; exit 1; fi
success "SKILL.md 验证通过"

# ── 安装路径解析 ────────────────────────────────────────────────────
base=""
case "$PLATFORM" in
    claude-code)   base="${HOME}/.claude/skills" ;;
    copilot)       base="${HOME}/.copilot/skills" ;;
    cursor)        base="${HOME}/.cursor/rules" ;;
    windsurf)      base="${HOME}/.codeium/windsurf/skills" ;;
    cline)         base="${HOME}/.cline/skills" ;;
    codex)         base="${HOME}/.agents/skills" ;;
    gemini)        base="${HOME}/.gemini/skills" ;;
    kiro)          base="${HOME}/.kiro/skills" ;;
    trae)          base="${HOME}/.trae/rules" ;;
    goose)         base="${HOME}/.config/goose/skills" ;;
    opencode)      base="${HOME}/.config/opencode/skills" ;;
    roo-code)      base="${HOME}/.roo/skills" ;;
    kilo-code)     base="${HOME}/.kilocode/skills" ;;
    factory)       base="${HOME}/.factory/skills" ;;
    junie)         base="${HOME}/.junie/skills" ;;
    antigravity)   base="${HOME}/.gemini/antigravity/skills" ;;
    universal)     base="${HOME}/.agents/skills" ;;
    *) error "未知平台: ${PLATFORM}"; exit 2 ;;
esac
INSTALL_DIR="${base}/${SKILL_NAME}"
info "安装目录: ${INSTALL_DIR}"

# ── 文件安装 ────────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR" ]; then rm -rf "$INSTALL_DIR"; fi
if ! mkdir -p "$INSTALL_DIR" 2>/dev/null; then
    error "无法创建目录: ${INSTALL_DIR}"; exit 3
fi

install_script_name="$(basename "$0")"
file_count=0
for file in "${SCRIPT_DIR}"/*; do
    [ -e "$file" ] || continue
    fname="$(basename "$file")"
    [ "$fname" = "$install_script_name" ] && continue
    cp -R "$file" "${INSTALL_DIR}/" 2>/dev/null || { error "复制 ${fname} 失败"; exit 3; }
    file_count=$((file_count + 1))
done
success "已复制 ${file_count} 个文件到 ${INSTALL_DIR}"

# ── Cursor .mdc 格式适配 ────────────────────────────────────────────
if [ "$PLATFORM" = "cursor" ]; then
    desc=""
    in_fm=false; lnum=0
    while IFS= read -r line; do
        lnum=$((lnum + 1))
        [ "$lnum" -eq 1 ] && { in_fm=true; continue; }
        $in_fm && [ "$line" = "---" ] && break
        $in_fm && case "$line" in description:*) desc="$(echo "$line" | sed 's/^description:[[:space:]]*//')" ;; esac
    done < "$skill_md"

    body="$(awk 'BEGIN{c=0} /^---$/{c++;next} c>=2{print}' "$skill_md")"
    mdc_file="${INSTALL_DIR}/${SKILL_NAME}.mdc"
    cat > "$mdc_file" <<MDCEOF
---
description: ${desc}
globs:
alwaysApply: true
---
${body}
MDCEOF
    success "已生成 Cursor .mdc: ${mdc_file}"
fi

# ── Cline/Roo Code/Kilo Code/Trae 规则文件 ───────────────────────────
case "$PLATFORM" in
    cline|roo-code|kilo-code|trae)
        plain_file="${INSTALL_DIR}/${SKILL_NAME}.md"
        awk 'BEGIN{c=0} /^---$/{c++;next} c>=2{print}' "$skill_md" > "$plain_file"
        success "已生成规则文件: ${plain_file}"
        ;;
esac

# ── 通用路径链接 ────────────────────────────────────────────────────
if [ "$PLATFORM" != "codex" ] && [ "$PLATFORM" != "universal" ]; then
    universal_dir="${HOME}/.agents/skills/${SKILL_NAME}"
    mkdir -p "${HOME}/.agents/skills"
    [ -e "$universal_dir" ] || [ -L "$universal_dir" ] && rm -rf "$universal_dir"
    if ln -s "$INSTALL_DIR" "$universal_dir" 2>/dev/null; then
        success "通用链接: ${universal_dir} -> ${INSTALL_DIR}"
    elif cp -R "$INSTALL_DIR" "$universal_dir" 2>/dev/null; then
        success "通用复制: ${universal_dir}"
    else
        printf "${YELLOW}[警告]${NC}  无法创建通用路径: ${universal_dir}\n"
    fi
fi

success "Skill '${SKILL_NAME}' 已安装到 ${PLATFORM}"
exit 0