#!/bin/sh
# install.sh — Cross-platform skill installation script for jenkins-tools-skill
# POSIX-compatible (works in bash, dash, zsh, ash, etc.)
# Exit codes:
#   0 — Success
#   1 — Validation failed (missing or malformed SKILL.md)
#   2 — Platform not detected
#   3 — Permission denied

set -eu

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SKILL_NAME="jenkins-tools-skill"
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ---------------------------------------------------------------------------
# Colors (disabled when stdout is not a terminal)
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    NC=''
fi

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
info()    { printf "${BLUE}[INFO]${NC}  %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
error()   { printf "${RED}[ERROR]${NC} %s\n" "$1" >&2; }

# ---------------------------------------------------------------------------
# Usage / help
# ---------------------------------------------------------------------------
show_help() {
    cat <<EOF
${BOLD}install.sh${NC} — Install the ${BOLD}${SKILL_NAME}${NC} skill (v${VERSION})

USAGE
    ./install.sh [OPTIONS]

OPTIONS
    --platform PLATFORM   Explicit platform selection. One of:
                          claude-code, copilot, cursor, windsurf,
                          cline, codex, gemini, kiro, trae, goose,
                          opencode, roo-code, kilo-code, factory,
                          junie, antigravity, universal
    --project             Install at project level (current directory)
    --path PATH           Custom install path (overrides detection)
    --all                 Install to ALL detected tool paths at once
    --dry-run             Show what would happen without making changes
    -h, --help            Show this help message

EXAMPLES
    ./install.sh                          # Auto-detect platform, user-level
    ./install.sh --project                # Auto-detect platform, project-level
    ./install.sh --platform cursor        # Force Cursor, user-level
    ./install.sh --path ~/my-skills/      # Custom destination
    ./install.sh --all                    # Install to every detected tool
    ./install.sh --dry-run                # Preview without installing
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
PLATFORM=""
PROJECT_LEVEL=false
CUSTOM_PATH=""
DRY_RUN=false
INSTALL_ALL=false

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --platform)
                [ $# -ge 2 ] || { error "Missing value for --platform"; exit 1; }
                PLATFORM="$2"
                shift 2
                ;;
            --project)
                PROJECT_LEVEL=true
                shift
                ;;
            --path)
                [ $# -ge 2 ] || { error "Missing value for --path"; exit 1; }
                CUSTOM_PATH="$2"
                shift 2
                ;;
            --all)
                INSTALL_ALL=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# SKILL.md validation
# ---------------------------------------------------------------------------
validate_skill_md() {
    skill_md="${SCRIPT_DIR}/SKILL.md"

    if [ ! -f "$skill_md" ]; then
        error "SKILL.md not found in ${SCRIPT_DIR}"
        error "Every skill package must contain a valid SKILL.md file."
        exit 1
    fi

    first_line="$(head -n 1 "$skill_md")"
    if [ "$first_line" != "---" ]; then
        error "SKILL.md must start with YAML frontmatter (---)"
        exit 1
    fi

    in_frontmatter=false
    found_name=false
    found_description=false
    line_num=0

    while IFS= read -r line; do
        line_num=$((line_num + 1))
        if [ "$line_num" -eq 1 ]; then in_frontmatter=true; continue; fi
        if $in_frontmatter && [ "$line" = "---" ]; then break; fi
        if $in_frontmatter; then
            case "$line" in
                name:*) found_name=true ;;
                description:*) found_description=true ;;
            esac
        fi
    done < "$skill_md"

    if ! $found_name; then
        error "SKILL.md frontmatter is missing required field: name"
        exit 1
    fi
    if ! $found_description; then
        error "SKILL.md frontmatter is missing required field: description"
        exit 1
    fi

    success "SKILL.md validated (name and description present)"
}

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
SUPPORTED_PLATFORMS="claude-code, copilot, cursor, windsurf, cline, codex, gemini, kiro, trae, goose, opencode, roo-code, kilo-code, factory, junie, antigravity, universal"

detect_platform() {
    if [ -n "$PLATFORM" ]; then
        case "$PLATFORM" in
            claude-code|copilot|cursor|windsurf|cline|codex|gemini|\
            kiro|trae|goose|opencode|roo-code|kilo-code|factory|\
            junie|antigravity|universal)
                info "Platform explicitly set to: ${PLATFORM}"
                return 0
                ;;
            *)
                error "Unknown platform: ${PLATFORM}"
                error "Supported: ${SUPPORTED_PLATFORMS}"
                exit 2
                ;;
        esac
    fi

    # Auto-detection: check user-level config directories
    if [ -d "${HOME}/.claude" ]; then
        PLATFORM="claude-code"
    elif [ -d "${HOME}/.copilot" ] || [ -d ".github" ]; then
        PLATFORM="copilot"
    elif [ -d "${HOME}/.cursor" ] || [ -d ".cursor" ]; then
        PLATFORM="cursor"
    elif [ -d "${HOME}/.codeium/windsurf" ] || [ -d ".windsurf" ]; then
        PLATFORM="windsurf"
    elif [ -d "${HOME}/.cline" ] || [ -d ".clinerules" ]; then
        PLATFORM="cline"
    elif [ -d "${HOME}/.gemini" ]; then
        PLATFORM="gemini"
    elif [ -d "${HOME}/.kiro" ] || [ -d ".kiro" ]; then
        PLATFORM="kiro"
    elif [ -d ".trae" ]; then
        PLATFORM="trae"
    elif [ -d "${HOME}/.roo" ] || [ -d ".roo" ]; then
        PLATFORM="roo-code"
    elif [ -d "${HOME}/.kilocode" ] || [ -d ".kilocode" ]; then
        PLATFORM="kilo-code"
    elif [ -d "${HOME}/.factory" ] || [ -d ".factory" ]; then
        PLATFORM="factory"
    elif [ -d ".junie" ]; then
        PLATFORM="junie"
    elif [ -d "${HOME}/.config/goose" ]; then
        PLATFORM="goose"
    elif [ -d "${HOME}/.config/opencode" ]; then
        PLATFORM="opencode"
    elif [ -d "${HOME}/.agents" ]; then
        PLATFORM="universal"
    else
        error "Could not auto-detect any supported AI coding platform."
        error "Use --platform PLATFORM to specify one explicitly."
        error "Supported: ${SUPPORTED_PLATFORMS}"
        exit 2
    fi

    info "Auto-detected platform: ${PLATFORM}"
}

# ---------------------------------------------------------------------------
# Detect all installed platforms (for --all)
# ---------------------------------------------------------------------------
detect_all_platforms() {
    ALL_PLATFORMS=""
    if [ -d "${HOME}/.claude" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} claude-code"; fi
    if [ -d "${HOME}/.copilot" ] || [ -d ".github" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} copilot"; fi
    if [ -d "${HOME}/.cursor" ] || [ -d ".cursor" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} cursor"; fi
    if [ -d "${HOME}/.codeium/windsurf" ] || [ -d ".windsurf" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} windsurf"; fi
    if [ -d "${HOME}/.cline" ] || [ -d ".clinerules" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} cline"; fi
    if [ -d "${HOME}/.gemini" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} gemini"; fi
    if [ -d "${HOME}/.kiro" ] || [ -d ".kiro" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} kiro"; fi
    if [ -d ".trae" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} trae"; fi
    if [ -d "${HOME}/.roo" ] || [ -d ".roo" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} roo-code"; fi
    if [ -d "${HOME}/.kilocode" ] || [ -d ".kilocode" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} kilo-code"; fi
    if [ -d "${HOME}/.factory" ] || [ -d ".factory" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} factory"; fi
    if [ -d ".junie" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} junie"; fi
    if [ -d "${HOME}/.config/goose" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} goose"; fi
    if [ -d "${HOME}/.config/opencode" ]; then ALL_PLATFORMS="${ALL_PLATFORMS} opencode"; fi
    ALL_PLATFORMS="${ALL_PLATFORMS} universal"

    ALL_PLATFORMS="$(printf '%s' "$ALL_PLATFORMS" | sed 's/^ //')"
    if [ -z "$ALL_PLATFORMS" ]; then ALL_PLATFORMS="universal"; fi
}

# ---------------------------------------------------------------------------
# Install path resolution
# ---------------------------------------------------------------------------
resolve_install_path() {
    if [ -n "$CUSTOM_PATH" ]; then
        INSTALL_DIR="${CUSTOM_PATH}"
        info "Using custom install path: ${INSTALL_DIR}"
        return 0
    fi

    base=""
    if $PROJECT_LEVEL; then
        case "$PLATFORM" in
            claude-code)   base=".claude/skills" ;;
            copilot)       base=".github/skills" ;;
            cursor)        base=".cursor/rules" ;;
            windsurf)      base=".windsurf/rules" ;;
            cline)         base=".clinerules/skills" ;;
            codex)         base=".agents/skills" ;;
            gemini)        base=".gemini/skills" ;;
            kiro)          base=".kiro/skills" ;;
            trae)          base=".trae/rules" ;;
            goose)         base=".goose/skills" ;;
            opencode)      base=".opencode/skills" ;;
            roo-code)      base=".roo/skills" ;;
            kilo-code)     base=".kilocode/skills" ;;
            factory)       base=".factory/skills" ;;
            junie)         base=".junie/skills" ;;
            antigravity)   base=".agent/skills" ;;
            universal)     base=".agents/skills" ;;
        esac
        INSTALL_DIR="$(pwd)/${base}/${SKILL_NAME}"
    else
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
        esac
        INSTALL_DIR="${base}/${SKILL_NAME}"
    fi

    info "Install directory: ${INSTALL_DIR}"
}

# ---------------------------------------------------------------------------
# Format adapters — convert SKILL.md to platform-native formats
# ---------------------------------------------------------------------------
generate_cursor_mdc() {
    target_dir="$1"
    skill_md="${SCRIPT_DIR}/SKILL.md"

    desc=""
    in_fm=false
    lnum=0
    while IFS= read -r line; do
        lnum=$((lnum + 1))
        if [ "$lnum" -eq 1 ]; then in_fm=true; continue; fi
        if $in_fm && [ "$line" = "---" ]; then break; fi
        if $in_fm; then
            case "$line" in
                description:*) desc="$(echo "$line" | sed 's/^description:[[:space:]]*//')" ;;
            esac
        fi
    done < "$skill_md"

    mdc_file="${target_dir}/${SKILL_NAME}.mdc"

    if $DRY_RUN; then
        info "Would generate Cursor .mdc: ${mdc_file}"
        return 0
    fi

    body="$(awk 'BEGIN{c=0} /^---$/{c++;next} c>=2{print}' "$skill_md")"

    cat > "$mdc_file" <<MDCEOF
---
description: ${desc}
globs:
alwaysApply: true
---
${body}
MDCEOF
    success "Generated Cursor .mdc: ${mdc_file}"
}

generate_plain_rule() {
    target_dir="$1"
    filename="$2"
    skill_md="${SCRIPT_DIR}/SKILL.md"

    plain_file="${target_dir}/${filename}"

    if $DRY_RUN; then
        info "Would generate plain rule: ${plain_file}"
        return 0
    fi

    mkdir -p "$target_dir"
    awk 'BEGIN{c=0} /^---$/{c++;next} c>=2{print}' "$skill_md" > "$plain_file"
    success "Generated plain rule: ${plain_file}"
}

# ---------------------------------------------------------------------------
# Universal .agents/skills/ secondary install (symlink or copy)
# ---------------------------------------------------------------------------
install_universal_secondary() {
    case "$PLATFORM" in
        codex|universal) return 0 ;;
    esac

    universal_dir="${HOME}/.agents/skills/${SKILL_NAME}"

    if $DRY_RUN; then
        info "Would create universal symlink: ${universal_dir} -> ${INSTALL_DIR}"
        return 0
    fi

    mkdir -p "${HOME}/.agents/skills"

    if [ -e "$universal_dir" ] || [ -L "$universal_dir" ]; then
        rm -rf "$universal_dir"
    fi

    if ln -s "$INSTALL_DIR" "$universal_dir" 2>/dev/null; then
        success "Universal symlink: ${universal_dir} -> ${INSTALL_DIR}"
    elif cp -R "$INSTALL_DIR" "$universal_dir" 2>/dev/null; then
        success "Universal copy: ${universal_dir}"
    else
        warn "Could not create universal path at ${universal_dir}"
    fi
}

# ---------------------------------------------------------------------------
# File installation
# ---------------------------------------------------------------------------
install_files() {
    file_count=0
    install_script_name="$(basename "$0")"

    if $DRY_RUN; then
        printf "\n${BOLD}Dry-run mode — no files will be copied.${NC}\n\n"
        info "Would create directory: ${INSTALL_DIR}"
        for file in "${SCRIPT_DIR}"/*; do
            [ -e "$file" ] || continue
            fname="$(basename "$file")"
            [ "$fname" = "$install_script_name" ] && continue
            info "Would copy: ${fname}"
            file_count=$((file_count + 1))
        done
        printf "\n"
        info "Total files: ${file_count}"
        return 0
    fi

    if [ -d "$INSTALL_DIR" ]; then rm -rf "$INSTALL_DIR"; fi

    if ! mkdir -p "$INSTALL_DIR" 2>/dev/null; then
        error "Cannot create directory: ${INSTALL_DIR}"
        exit 3
    fi

    for file in "${SCRIPT_DIR}"/*; do
        [ -e "$file" ] || continue
        fname="$(basename "$file")"
        [ "$fname" = "$install_script_name" ] && continue

        if ! cp -R "$file" "${INSTALL_DIR}/" 2>/dev/null; then
            error "Failed to copy ${fname}"
            exit 3
        fi
        file_count=$((file_count + 1))
    done

    success "Copied ${file_count} file(s) to ${INSTALL_DIR}"
}

# ---------------------------------------------------------------------------
# Run format adapters based on platform
# ---------------------------------------------------------------------------
run_adapters() {
    case "$PLATFORM" in
        cursor) generate_cursor_mdc "$INSTALL_DIR" ;;
        cline|roo-code|kilo-code|trae) generate_plain_rule "$INSTALL_DIR" "${SKILL_NAME}.md" ;;
    esac
}

# ---------------------------------------------------------------------------
# Activation instructions
# ---------------------------------------------------------------------------
print_activation_instructions() {
    if $DRY_RUN; then return 0; fi

    printf "\n${GREEN}${BOLD}Installation complete!${NC}\n\n"

    printf "Skill installed at: ${BOLD}${INSTALL_DIR}${NC}\n\n"
    printf "To use the skill:\n"
    printf "  1. Open a new session in your AI tool.\n"
    printf "  2. Invoke with /jenkins-tools or use trigger phrases:\n"
    printf "     - 'trigger Jenkins build', 'check build status', 'abort Jenkins job'\n"
    printf "  3. Ensure jkt CLI is installed: npm install -g jenkins-tools-cli\n"
    printf "\n"
}

# ---------------------------------------------------------------------------
# Install for a single platform
# ---------------------------------------------------------------------------
install_single() {
    detect_platform
    resolve_install_path
    install_files
    run_adapters
    install_universal_secondary
    print_activation_instructions

    if $DRY_RUN; then
        info "Dry run complete. No changes were made."
    else
        success "Skill '${SKILL_NAME}' installed successfully for ${PLATFORM}."
    fi
}

# ---------------------------------------------------------------------------
# Install for all detected platforms (--all)
# ---------------------------------------------------------------------------
install_all() {
    detect_all_platforms
    info "Installing to all detected platforms: ${ALL_PLATFORMS}"

    installed_count=0
    first_non_agents_dir=""
    for plat in $ALL_PLATFORMS; do
        printf "\n"
        info "--- Installing for: ${plat} ---"
        PLATFORM="$plat"
        resolve_install_path
        install_files
        run_adapters
        installed_count=$((installed_count + 1))
        if [ -z "$first_non_agents_dir" ]; then
            case "$plat" in
                codex|universal) ;;
                *) first_non_agents_dir="$INSTALL_DIR" ;;
            esac
        fi
    done

    if [ -n "$first_non_agents_dir" ]; then
        INSTALL_DIR="$first_non_agents_dir"
        install_universal_secondary
    fi

    printf "\n"
    if $DRY_RUN; then
        info "Dry run complete. No changes were made."
    else
        success "Skill '${SKILL_NAME}' installed to ${installed_count} platform(s)."
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    printf "${BOLD}Installing skill: ${SKILL_NAME}${NC}\n"
    printf "%-40s\n" "----------------------------------------"

    parse_args "$@"
    validate_skill_md

    if $INSTALL_ALL; then
        install_all
    else
        install_single
    fi

    exit 0
}

main "$@"