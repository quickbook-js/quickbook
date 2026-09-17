import { defineConfig } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import { resolve, extname } from 'node:path';
import fs from 'node:fs';
import { buildArticles, bookConfig, authorHtml } from './build-articles.js';

// Generate articles & TOC before starting Vite
buildArticles();

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
    handlebars({
      partialDirectory: resolve(import.meta.dirname, 'partials'),
      context: {
        bookTitle: bookConfig.title,
        bookSubtitle: bookConfig.subtitle,
        author: bookConfig.author,
        authorGithub: bookConfig.authorGithub || '',
        authorHtml,
        description: bookConfig.description,
        github: bookConfig.github,
        language: bookConfig.language || 'en',
        theme: bookConfig.theme,
      },
    }),
  ],
});
