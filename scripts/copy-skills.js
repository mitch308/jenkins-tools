#!/usr/bin/env node

/**
 * Copy skill files from src/skills/ to dist/skills/.
 * TypeScript compiler only processes .ts files, so skill files
 * (.md, .sh, .json) must be copied separately.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcSkillsDir = path.resolve(__dirname, '..', 'src', 'skills');
const distSkillsDir = path.resolve(__dirname, '..', 'dist', 'skills');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.log('copy-skills: source directory not found:', src);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('copy-skills: copying skill files...');
copyRecursive(srcSkillsDir, distSkillsDir);

// Ensure install.sh is executable on Unix-like systems
const installSh = path.join(distSkillsDir, 'jenkins-tools-skill', 'install.sh');
if (fs.existsSync(installSh) && process.platform !== 'win32') {
  try {
    fs.chmodSync(installSh, 0o755);
  } catch {
    // Ignore chmod errors (e.g., on Windows or restricted filesystems)
  }
}

console.log('copy-skills: done.');