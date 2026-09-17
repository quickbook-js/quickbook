import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.dirname ? import.meta.url : `file://${process.argv[1]}`);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 4455;
const projectRoot = path.resolve(__dirname, '..');
const articlesDir = path.join(projectRoot, 'articles');
const publicDir = path.join(__dirname, 'public');

// Ensure articles dir exists
if (!fs.existsSync(articlesDir)) {
  fs.mkdirSync(articlesDir, { recursive: true });
}

// Helper: Frontmatter parsing
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw };
  }
  const yaml = match[1];
  const content = match[2];
  const data = {};
  yaml.split(/\r?\n/).forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      data[key] = value;
    }
  });
  return { data, content };
}

function stringifyFrontmatter(data, content) {
  let yaml = '---\n';
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null && val !== '') {
      yaml += `${key}: "${String(val).replace(/"/g, '\\"')}"\n`;
    }
  }
  yaml += '---\n\n';
  return yaml + content.trimStart();
}

function getAvailableThemes() {
  const builtin = ['default', 'dark', 'blue', 'red', 'green', 'coffee'];
  const configPath = path.join(projectRoot, 'quickbook.config.js');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const match = content.match(/themes\s*:\s*\{([\s\S]*?)\}/);
      if (match) {
        const themeKeys = match[1].match(/([a-zA-Z0-9_-]+)\s*:/g);
        if (themeKeys) {
          themeKeys.forEach(k => {
            const name = k.replace(':', '').trim();
            if (name && !builtin.includes(name)) {
              builtin.push(name);
            }
          });
        }
      }
    } catch (e) {}
  }
  return builtin;
}

function getSettings() {
  const settingsPath = path.join(projectRoot, 'settings.json');
  const legacyPath = path.join(projectRoot, 'book.config.json');
  const p = fs.existsSync(settingsPath) ? settingsPath : legacyPath;
  let data = {
    title: 'My Quickbook Handbook',
    subtitle: 'A step-by-step documentation guide',
    author: 'Author Name',
    authorGithub: '',
    description: '',
    github: '',
    language: 'en',
    theme: 'dark'
  };
  if (fs.existsSync(p)) {
    try {
      data = { ...data, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
    } catch (e) {}
  }
  data.availableThemes = getAvailableThemes();
  return data;
}

function saveSettings(settings) {
  const settingsPath = path.join(projectRoot, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

function getArticlesTree() {
  const topLevel = [];
  const chaptersMap = new Map();

  if (fs.existsSync(articlesDir)) {
    const items = fs.readdirSync(articlesDir, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile() && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))) {
        const fullPath = path.join(articlesDir, item.name);
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const { data } = parseFrontmatter(raw);

        topLevel.push({
          type: 'toplevel',
          name: item.name,
          relativePath: item.name,
          title: data.title || item.name.replace(/\.mdx?$/, ''),
          description: data.description || ''
        });

      } else if (item.isDirectory()) {
        const dirMatch = item.name.match(/^(\d+)\s+(.+)$/);
        const chapterNum = dirMatch ? parseInt(dirMatch[1], 10) : 99;
        const chapterName = dirMatch ? dirMatch[2] : item.name;

        const chapterObj = {
          number: chapterNum,
          name: chapterName,
          dirName: item.name,
          lessons: []
        };

        const chapterPath = path.join(articlesDir, item.name);
        const files = fs.readdirSync(chapterPath, { withFileTypes: true });

        for (const file of files) {
          if (file.isFile() && (file.name.endsWith('.md') || file.name.endsWith('.mdx'))) {
            const fileMatch = file.name.match(/^(\d+)\s+(.+)\.(md|mdx)$/i);
            const lessonNum = fileMatch ? parseInt(fileMatch[1], 10) : 99;
            const lessonNameRaw = fileMatch ? fileMatch[2] : file.name.replace(/\.mdx?$/, '');

            const raw = fs.readFileSync(path.join(chapterPath, file.name), 'utf-8');
            const { data } = parseFrontmatter(raw);

            chapterObj.lessons.push({
              type: 'lesson',
              number: lessonNum,
              name: file.name,
              relativePath: path.join(item.name, file.name),
              title: data.title || lessonNameRaw,
              description: data.description || ''
            });
          }
        }

        chapterObj.lessons.sort((a, b) => a.number - b.number);
        chaptersMap.set(chapterNum, chapterObj);
      }
    }
  }

  const sortedChapters = Array.from(chaptersMap.values()).sort((a, b) => a.number - b.number);
  return { topLevel, chapters: sortedChapters };
}

// Request Body Body Parser Helper
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function getExtensionsConfig() {
  const extConfigPath = path.join(projectRoot, 'extensions.config.json');
  if (fs.existsSync(extConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(extConfigPath, 'utf-8'));
    } catch (e) {}
  }
  return {};
}

function saveExtensionsConfig(config) {
  const extConfigPath = path.join(projectRoot, 'extensions.config.json');
  fs.writeFileSync(extConfigPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

async function getExtensionsList() {
  const currentConfig = getExtensionsConfig();
  const extensions = [];

  const quickbookConfigPath = path.join(projectRoot, 'quickbook.config.js');
  if (fs.existsSync(quickbookConfigPath)) {
    try {
      const userConfigModule = await import(`file://${quickbookConfigPath}`);
      const extConfig = userConfigModule.default || {};
      const extList = Array.isArray(extConfig.extensions)
        ? extConfig.extensions
        : Object.values(extConfig.extensions || {});

      for (const item of extList) {
        if (typeof item === 'string') {
          const extPath = path.resolve(projectRoot, item);
          if (fs.existsSync(extPath)) {
            try {
              const extModule = await import(`file://${extPath}?t=${Date.now()}`);
              const extObj = extModule.default || extModule;
              if (extObj && extObj.name) {
                extensions.push({
                  name: extObj.name,
                  title: extObj.title || extObj.name,
                  description: extObj.description || '',
                  configSchema: extObj.configSchema || {
                    enabled: { type: 'boolean', default: true, label: 'Enable Extension' }
                  },
                  options: { enabled: true, ...(currentConfig[extObj.name] || {}) }
                });
              }
            } catch (e) {}
          }
        } else if (typeof item === 'object' && item !== null && item.name) {
          extensions.push({
            name: item.name,
            title: item.title || item.name,
            description: item.description || '',
            configSchema: item.configSchema || {
              enabled: { type: 'boolean', default: true, label: 'Enable Extension' }
            },
            options: { enabled: true, ...(currentConfig[item.name] || {}) }
          });
        }
      }
    } catch (e) {}
  }

  return extensions;
}

function triggerBuild() {
  exec('node build-articles.js', { cwd: projectRoot }, (err, stdout, stderr) => {
    if (err) {
      console.error('[admin-server] Auto-build error:', stderr || err.message);
    } else {
      console.log('[admin-server] Auto-build success:', stdout.trim());
    }
  });
}

function getLayoutsList() {
  const layoutsDir = path.join(projectRoot, 'layouts');
  const layouts = [];

  if (fs.existsSync(layoutsDir)) {
    const items = fs.readdirSync(layoutsDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const dirPath = path.join(layoutsDir, item.name);
        const configPath = path.join(dirPath, 'layout.json');
        const legacyPath = path.join(dirPath, 'config.json');
        const p = fs.existsSync(configPath) ? configPath : (fs.existsSync(legacyPath) ? legacyPath : null);

        let meta = {
          id: item.name,
          name: item.name,
          description: 'Custom Quickbook layout plugin.',
          target: 'toc',
          version: '1.0.0',
          author: 'Custom'
        };

        if (p) {
          try {
            meta = { ...meta, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
          } catch (e) {}
        }

        const cssPath = path.join(dirPath, 'styles.css');
        const tplPath = path.join(dirPath, 'template.hbs');
        meta.hasStyles = fs.existsSync(cssPath);
        meta.hasTemplate = fs.existsSync(tplPath);

        layouts.push(meta);
      }
    }
  }

  const settings = getSettings();
  const activeTocLayout = settings.tocLayout || 'grid-cards';
  return { layouts, activeTocLayout };
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const method = req.method;

  const jsonResponse = (data, status = 200) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  };

  // CORS handling
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API ENDPOINTS ---

  // 0. GET /api/layouts
  if (pathname === '/api/layouts' && method === 'GET') {
    return jsonResponse(getLayoutsList());
  }

  // 0. GET /api/extensions & POST /api/extensions
  if (pathname === '/api/extensions') {
    if (method === 'GET') {
      const exts = await getExtensionsList();
      return jsonResponse({ extensions: exts, config: getExtensionsConfig() });
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        saveExtensionsConfig(body);
        triggerBuild();
        return jsonResponse({ success: true, config: getExtensionsConfig() });
      } catch (err) {
        return jsonResponse({ error: err.message }, 400);
      }
    }
  }

  // 1. GET /api/config & POST /api/config
  if (pathname === '/api/config') {
    if (method === 'GET') {
      return jsonResponse(getSettings());
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        saveSettings(body);
        triggerBuild();
        return jsonResponse({ success: true, settings: getSettings() });
      } catch (err) {
        return jsonResponse({ error: err.message }, 400);
      }
    }
  }

  // 2. GET /api/articles
  if (pathname === '/api/articles' && method === 'GET') {
    return jsonResponse(getArticlesTree());
  }

  // 3. GET /api/article & POST /api/article & DELETE /api/article
  if (pathname === '/api/article') {
    if (method === 'GET') {
      const relPath = urlObj.searchParams.get('path');
      if (!relPath) return jsonResponse({ error: 'Missing path' }, 400);

      const targetPath = path.join(articlesDir, relPath);
      if (!fs.existsSync(targetPath)) return jsonResponse({ error: 'File not found' }, 404);

      const raw = fs.readFileSync(targetPath, 'utf-8');
      const { data, content } = parseFrontmatter(raw);
      return jsonResponse({
        relativePath: relPath,
        title: data.title || '',
        description: data.description || '',
        content: content
      });
    }

    if (method === 'POST') {
      try {
        const body = await readBody(req);
        const { relativePath, title, description, content } = body;
        if (!relativePath) return jsonResponse({ error: 'Missing relativePath' }, 400);

        const targetPath = path.join(articlesDir, relativePath);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const rawMarkdown = stringifyFrontmatter({ title, description }, content || '');
        fs.writeFileSync(targetPath, rawMarkdown, 'utf-8');
        triggerBuild();
        return jsonResponse({ success: true, relativePath });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    if (method === 'DELETE') {
      try {
        const body = await readBody(req);
        const { relativePath } = body;
        if (!relativePath) return jsonResponse({ error: 'Missing relativePath' }, 400);

        const targetPath = path.join(articlesDir, relativePath);
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        triggerBuild();
        return jsonResponse({ success: true });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }
  }

  // 4. POST /api/chapter & DELETE /api/chapter
  if (pathname === '/api/chapter') {
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        const { number, name } = body;
        if (!number || !name) return jsonResponse({ error: 'Missing number or name' }, 400);

        const folderName = `${number} ${name}`;
        const targetPath = path.join(articlesDir, folderName);
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
        triggerBuild();
        return jsonResponse({ success: true, folderName });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    if (method === 'DELETE') {
      try {
        const body = await readBody(req);
        const { folderName } = body;
        if (!folderName) return jsonResponse({ error: 'Missing folderName' }, 400);

        const targetPath = path.join(articlesDir, folderName);
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
        triggerBuild();
        return jsonResponse({ success: true });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }
  }

  // 5. POST /api/generate
  if (pathname === '/api/generate' && method === 'POST') {
    exec('node build-articles.js', { cwd: projectRoot }, (err, stdout, stderr) => {
      if (err) {
        return jsonResponse({ error: stderr || err.message }, 500);
      }
      return jsonResponse({ success: true, message: stdout.trim() });
    });
    return;
  }

  // --- SERVE PUBLIC ADMIN DASHBOARD ---
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`\n🚀 Quickbook Admin Panel is running at: http://localhost:${PORT}\n`);
});
