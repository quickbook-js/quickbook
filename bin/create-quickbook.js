#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firstArg = (process.argv[2] || '').trim();
const isUpdate = firstArg === 'update' || firstArg === 'u' || firstArg === '--update';

const templateDir = path.resolve(__dirname, '../template');

if (!fs.existsSync(templateDir)) {
  console.error(`❌ Template directory not found at: ${templateDir}`);
  process.exit(1);
}

// --------------------------------------------------------------------------
// 1. UPDATE MODE: npx quickbook update
// --------------------------------------------------------------------------
if (isUpdate) {
  const targetDir = process.cwd();
  console.log(`\n🔄 Updating Quickbook framework files in: ${targetDir}\n`);

  const protectedPaths = [
    'articles',
    'settings.json',
    'quickbook.config.json',
    'quickbook.config.js'
  ];

  function updateRecursive(src, dest, relPath = '') {
    const stats = fs.statSync(src);
    const basename = path.basename(src);

    // Skip root-level protected user paths
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

      // Do not overwrite user custom src files if they already exist
      if (relPath.startsWith('src/') && fs.existsSync(destPath)) {
        return;
      }

      fs.copyFileSync(src, destPath);
    }
  }

  // Copy framework updates from template
  for (const item of fs.readdirSync(templateDir)) {
    if (protectedPaths.includes(item)) continue;
    updateRecursive(path.join(templateDir, item), path.join(targetDir, item), item);
  }

  // Merge package.json scripts & dependencies if present
  const pkgPath = path.join(targetDir, 'package.json');
  const templatePkgPath = path.join(templateDir, 'package.json');
  if (fs.existsSync(pkgPath) && fs.existsSync(templatePkgPath)) {
    try {
      const userPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const templatePkg = JSON.parse(fs.readFileSync(templatePkgPath, 'utf-8'));

      userPkg.scripts = { ...(userPkg.scripts || {}), ...(templatePkg.scripts || {}) };
      userPkg.devDependencies = { ...(userPkg.devDependencies || {}), ...(templatePkg.devDependencies || {}) };
      userPkg.dependencies = { ...(userPkg.dependencies || {}), ...(templatePkg.dependencies || {}) };

      fs.writeFileSync(pkgPath, JSON.stringify(userPkg, null, 2) + '\n', 'utf-8');
    } catch (err) {
      // Ignore package update error
    }
  }

  console.log(`✅ Success! Quickbook Studio & framework files updated to latest standard.\n`);
  console.log(`🛡️ Preserved user files: articles/, settings.json, quickbook.config.js, src/\n`);
  process.exit(0);
}

// --------------------------------------------------------------------------
// 2. CREATE MODE: npx create-quickbook my-book
// --------------------------------------------------------------------------
const targetArg = firstArg || './';
const targetDir = path.resolve(process.cwd(), targetArg);
const projectName = targetArg === './' || targetArg === '.' 
  ? path.basename(process.cwd()) 
  : path.basename(targetDir);

console.log(`\n📚 Creating a new Quickbook project in: ${targetDir}\n`);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    let destPath = dest;
    if (path.basename(src) === 'gitignore') {
      destPath = path.join(path.dirname(dest), '.gitignore');
    }
    fs.copyFileSync(src, destPath);
  }
}

copyRecursive(templateDir, targetDir);

const pkgPath = path.join(targetDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkgData.name = projectName.toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf-8');
  } catch (err) {}
}

const isCurrentDir = targetArg === './' || targetArg === '.';

console.log(`✅ Success! Quickbook template created.\n`);
console.log(`👉 Next steps:\n`);
if (!isCurrentDir) {
  console.log(`   cd ${targetArg}`);
}
console.log(`   npm install`);
console.log(`   npm run admin      # Launches interactive Admin Panel at http://localhost:4455`);
console.log(`   npm run generate   # Generates /dist directory`);
console.log(`   npm run dev        # Starts local dev server\n`);
