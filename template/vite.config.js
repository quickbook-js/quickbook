import { defineConfig } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import { resolve, extname } from 'node:path';
import fs from 'node:fs';
import { buildArticles, bookConfig, authorHtml } from './build-articles.js';

// Initial build before starting Vite
buildArticles();

function getHandlebarsContext() {
  return {
    bookTitle: bookConfig.title,
    bookSubtitle: bookConfig.subtitle,
    author: bookConfig.author,
    authorGithub: bookConfig.authorGithub || '',
    authorHtml,
    description: bookConfig.description,
    github: bookConfig.github,
    language: bookConfig.language || 'en',
    theme: bookConfig.theme,
  };
}

function findHtmlFiles(dir, files = {}) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, item.name);
    if (item.isDirectory()) {
      findHtmlFiles(fullPath, files);
    } else if (extname(item.name) === '.html') {
      const rel = fullPath.replace(resolve(import.meta.dirname, 'pages/'), '').replace('.html', '');
      files[`article_${rel.replace(/\//g, '_')}`] = fullPath;
    }
  }
  return files;
}

// Clean Watcher plugin for Quickbook source files (ignores generated outputs to prevent infinite loops)
function quickbookWatchPlugin() {
  let isBuilding = false;
  let debounceTimer = null;

  return {
    name: 'vite-plugin-quickbook-watcher',
    configureServer(server) {
      const watchPaths = [
        resolve(import.meta.dirname, 'articles'),
        resolve(import.meta.dirname, 'settings.json'),
        resolve(import.meta.dirname, 'quickbook.config.js'),
        resolve(import.meta.dirname, 'extensions.config.json'),
        resolve(import.meta.dirname, 'src')
      ];

      server.watcher.add(watchPaths);

      const triggerRebuild = (file) => {
        // Ignore build outputs to prevent infinite loops
        if (file && (file.includes('partials/') || file.includes('pages/articles/'))) {
          return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (isBuilding) return;
          isBuilding = true;
          try {
            buildArticles();
            server.ws.send({ type: 'full-reload', path: '*' });
          } catch (err) {
            console.error('[quickbook-watcher] Rebuild error:', err.message);
          } finally {
            isBuilding = false;
          }
        }, 300);
      };

      server.watcher.on('change', triggerRebuild);
      server.watcher.on('add', triggerRebuild);
      server.watcher.on('unlink', triggerRebuild);
    }
  };
}

export default defineConfig({
  base: './', // Relative asset paths for GitHub Pages
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        ...findHtmlFiles(resolve(import.meta.dirname, 'pages/articles')),
      },
    },
  },
  plugins: [
    quickbookWatchPlugin(),
    handlebars({
      partialDirectory: resolve(import.meta.dirname, 'partials'),
      reloadOnPartialChange: false,
      context(pagePath) {
        return getHandlebarsContext();
      },
    }),
  ],
});
