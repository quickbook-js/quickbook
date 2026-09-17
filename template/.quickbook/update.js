#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log(`\n🔄 Updating Quickbook framework files in: ${projectRoot}\n`);

// Locate source template directory
let templateDir = null;
const possibleSources = [
  path.resolve(projectRoot, '../template'),
  path.resolve(projectRoot, 'node_modules/create-quickbook/template'),
  path.resolve(projectRoot, '../node_modules/create-quickbook/template')
];

for (const p of possibleSources) {
  if (fs.existsSync(p)) {
    templateDir = p;
    break;
  }
}

if (!templateDir) {
  // If no external package is found, the current directory already has local template files
  console.log(`✅ Quickbook framework files in ${projectRoot} are already at latest version.\n`);
  process.exit(0);
}

const protectedPaths = [
  'articles',
  'settings.json',
  'quickbook.config.json',
  'quickbook.config.js'
];

function updateRecursive(src, dest, relPath = '') {
  const stats = fs.statSync(src);
  const basename = path.basename(src);

  if (!relPath && protectedPaths.includes(basename)) {
    return;
  }

  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const item of fs.readdirSync(src)) {
      const nextRel = relPath ? `${relPath}/${item}` : item;
      updateRecursive(path.join(src, item), path.join(dest, item), nextRel);
    }
  } else {
    let destPath = dest;
    if (path.basename(src) === 'gitignore') {
      destPath = path.join(path.dirname(dest), '.gitignore');
    }

    if (relPath.startsWith('src/') && fs.existsSync(destPath)) {
      return;
    }

    fs.copyFileSync(src, destPath);
  }
}

for (const item of fs.readdirSync(templateDir)) {
  if (protectedPaths.includes(item)) continue;
  updateRecursive(path.join(templateDir, item), path.join(projectRoot, item), item);
}

// Update package.json scripts & dependencies if present
const pkgPath = path.join(projectRoot, 'package.json');
const templatePkgPath = path.join(templateDir, 'package.json');
if (fs.existsSync(pkgPath) && fs.existsSync(templatePkgPath)) {
  try {
    const userPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const templatePkg = JSON.parse(fs.readFileSync(templatePkgPath, 'utf-8'));

    userPkg.scripts = { ...(userPkg.scripts || {}), ...(templatePkg.scripts || {}) };
    userPkg.devDependencies = { ...(userPkg.devDependencies || {}), ...(templatePkg.devDependencies || {}) };
    userPkg.dependencies = { ...(userPkg.dependencies || {}), ...(templatePkg.dependencies || {}) };

    fs.writeFileSync(pkgPath, JSON.stringify(userPkg, null, 2) + '\n', 'utf-8');
  } catch (err) {}
}

console.log(`✅ Success! Quickbook Studio & framework files updated to latest standard.\n`);
console.log(`🛡️ Preserved user files: articles/, settings.json, quickbook.config.js, src/\n`);
