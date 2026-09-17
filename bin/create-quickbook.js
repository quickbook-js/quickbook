#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetArg = process.argv[2] || './';
const targetDir = path.resolve(process.cwd(), targetArg);
const projectName = targetArg === './' || targetArg === '.' 
  ? path.basename(process.cwd()) 
  : path.basename(targetDir);

console.log(`\n📚 Creating a new Quickbook project in: ${targetDir}\n`);

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const templateDir = path.resolve(__dirname, '../template');

if (!fs.existsSync(templateDir)) {
  console.error(`❌ Template directory not found at: ${templateDir}`);
  process.exit(1);
}

// Helper to copy files recursively
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
    // Rename 'gitignore' to '.gitignore'
    let destPath = dest;
    if (path.basename(src) === 'gitignore') {
      destPath = path.join(path.dirname(dest), '.gitignore');
    }
    fs.copyFileSync(src, destPath);
  }
}

// Copy template files
copyRecursive(templateDir, targetDir);

// Customize package.json in target directory if present
const pkgPath = path.join(targetDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkgData.name = projectName.toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf-8');
  } catch (err) {
    // Ignore error if package.json read/write fails
  }
}

const isCurrentDir = targetArg === './' || targetArg === '.';

console.log(`✅ Success! Quickbook template created.\n`);
console.log(`👉 Next steps:\n`);
if (!isCurrentDir) {
  console.log(`   cd ${targetArg}`);
}
console.log(`   npm install`);
console.log(`   npm run generate   # Generates /dist directory`);
console.log(`   npm run dev        # Starts local dev server\n`);
