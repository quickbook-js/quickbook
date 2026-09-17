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

function getSettings() {
  const settingsPath = path.join(projectRoot, 'settings.json');
  const legacyPath = path.join(projectRoot, 'book.config.json');
  const p = fs.existsSync(settingsPath) ? settingsPath : legacyPath;
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {}
  }
  return {
    title: 'My Quickbook Handbook',
    subtitle: 'A step-by-step documentation guide',
    author: 'Author Name',
    authorGithub: '',
    description: '',
    github: '',
    language: 'en',
    theme: 'dark'
  };
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

  // 1. GET /api/config & POST /api/config
  if (pathname === '/api/config') {
    if (method === 'GET') {
      return jsonResponse(getSettings());
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        saveSettings(body);
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
