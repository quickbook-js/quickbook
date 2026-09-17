import fs from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { highlight } from 'sugar-high';
import Handlebars from 'handlebars';

// Loading options from settings.json (or fallback to book.config.json)
const settingsPath = resolve(import.meta.dirname, 'settings.json');
const legacyConfigPath = resolve(import.meta.dirname, 'book.config.json');

export let bookConfig = {
  title: 'My Quickbook Handbook',
  subtitle: 'Practical Programming Guide',
  author: 'Author Name',
  authorGithub: '',
  description: 'Programmer Guide',
  github: 'https://github.com',
  language: 'en',
  theme: 'default',
};

const configPathToUse = fs.existsSync(settingsPath)
  ? settingsPath
  : fs.existsSync(legacyConfigPath)
    ? legacyConfigPath
    : null;

if (configPathToUse) {
  try {
    const rawConfig = fs.readFileSync(configPathToUse, 'utf-8');
    Object.assign(bookConfig, JSON.parse(rawConfig));
  } catch (err) {
    console.warn('[build-articles] Error reading config:', err.message);
  }
}

bookConfig.theme = (bookConfig.theme || 'default').toLowerCase().trim();

export function getAuthorHtml() {
  return bookConfig.authorGithub
    ? `<a href="${bookConfig.authorGithub}" target="_blank" rel="noopener noreferrer" class="author-link">${bookConfig.author}</a>`
    : bookConfig.author;
}
export const authorHtml = getAuthorHtml();

// Loading optional quickbook.config.js for extensions (JS) and themes (SCSS)
const quickbookConfigPath = resolve(import.meta.dirname, 'quickbook.config.js');
const extensionsConfigPath = resolve(import.meta.dirname, 'extensions.config.json');

export let extensionConfig = { themes: {}, extensions: [] };
export let loadedExtensions = [];
export let extensionsSettings = {};

if (fs.existsSync(extensionsConfigPath)) {
  try {
    extensionsSettings = JSON.parse(fs.readFileSync(extensionsConfigPath, 'utf-8'));
  } catch (err) {
    console.warn('[build-articles] Error reading extensions.config.json:', err.message);
  }
}

if (fs.existsSync(quickbookConfigPath)) {
  try {
    const userConfigModule = await import(`file://${quickbookConfigPath}`);
    extensionConfig = { ...extensionConfig, ...(userConfigModule.default || {}) };

    const extList = Array.isArray(extensionConfig.extensions)
      ? extensionConfig.extensions
      : Object.values(extensionConfig.extensions || {});

    for (const item of extList) {
      if (typeof item === 'string') {
        const extPath = resolve(import.meta.dirname, item);
        if (fs.existsSync(extPath)) {
          try {
            const extModule = await import(`file://${extPath}`);
            const extObj = extModule.default || extModule;
            if (extObj) loadedExtensions.push(extObj);
          } catch (err) {
            console.warn(`[build-articles] Error loading extension file ${item}:`, err.message);
          }
        } else {
          console.warn(`[build-articles] Extension file not found: ${item}`);
        }
      } else if (typeof item === 'object' && item !== null) {
        loadedExtensions.push(item);
      }
    }
  } catch (err) {
    console.warn('[build-articles] Warning loading quickbook.config.js:', err.message);
  }
}

// Configure marked with sugar-high
marked.use({
  renderer: {
    code({ text }) {
      const highlightedHtml = highlight(text);
      return `<pre><code class="sugar-high">${highlightedHtml}</code></pre>`;
    }
  }
});

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export function buildArticles() {
  const articlesDir = resolve(import.meta.dirname, 'articles');
  const outputDir = resolve(import.meta.dirname, 'pages/articles');
  const templatePath = resolve(import.meta.dirname, 'partials/article-template.html');
  const partialsDir = resolve(import.meta.dirname, 'partials');

  // Re-read latest settings.json and extensions.config.json
  if (configPathToUse && fs.existsSync(configPathToUse)) {
    try {
      const rawConfig = fs.readFileSync(configPathToUse, 'utf-8');
      Object.assign(bookConfig, JSON.parse(rawConfig));
    } catch (err) {}
  }
  bookConfig.theme = (bookConfig.theme || 'default').toLowerCase().trim();

  const extensionsConfigPath = resolve(import.meta.dirname, 'extensions.config.json');
  if (fs.existsSync(extensionsConfigPath)) {
    try {
      extensionsSettings = JSON.parse(fs.readFileSync(extensionsConfigPath, 'utf-8'));
    } catch (err) {}
  }

  const readPartial = (name) => {
    const p = resolve(partialsDir, name);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
  };

  const renderNavbar = (isArticle) => {
    let raw = readPartial('navbar.hbs');
    if (isArticle) {
      raw = raw.replace(/\{\{#if isArticle\}\}(.*?)\{\{else\}\}(.*?)\{\{\/if\}\}/g, '$1');
    } else {
      raw = raw.replace(/\{\{#if isArticle\}\}(.*?)\{\{else\}\}(.*?)\{\{\/if\}\}/g, '$2');
    }
    return raw
      .replace(/\{\{bookTitle\}\}/g, bookConfig.title)
      .replace(/\{\{author\}\}/g, bookConfig.author)
      .replace(/\{\{\{authorHtml\}\}\}/g, authorHtml);
  };

  const getSocialsFooterHtml = () => {
    const socialsExt = loadedExtensions.find(e => e && e.name === 'socials');
    const socialsOpts = extensionsSettings['socials'] || {};
    if (socialsOpts.enabled === true && socialsOpts.showOnFooter !== false && socialsExt && typeof socialsExt.renderIcons === 'function') {
      return socialsExt.renderIcons(socialsOpts);
    }
    return '';
  };

  const renderFooter = () => {
    return readPartial('footer.hbs')
      .replace('{{{socialsFooterHtml}}}', getSocialsFooterHtml())
      .replace(/\{\{bookTitle\}\}/g, bookConfig.title)
      .replace(/\{\{author\}\}/g, bookConfig.author)
      .replace(/\{\{\{authorHtml\}\}\}/g, authorHtml);
  };

  const navbarArticleHtml = renderNavbar(true);
  const footerHtml = renderFooter();

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const template = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf-8') : '';

  const topLevelArticles = [];
  const chaptersMap = new Map();

  const processMarkdown = (content, data, slug) => {
    let htmlContent = marked.parse(content);
    if (loadedExtensions.length > 0) {
      for (const ext of loadedExtensions) {
        if (typeof ext.transform === 'function') {
          const extName = ext.name || 'plugin';
          const extOpts = extensionsSettings[extName] || {};
          if (extOpts.enabled === false) continue;
          try {
            htmlContent = ext.transform(htmlContent, { data, slug, bookConfig, options: extOpts });
          } catch (e) {
            console.warn(`[extension:${extName}] Transform error:`, e.message);
          }
        }
      }
    }
    return htmlContent;
  };

  if (fs.existsSync(articlesDir)) {
    const items = fs.readdirSync(articlesDir, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile() && (extname(item.name) === '.md' || extname(item.name) === '.mdx')) {
        const slug = slugify(basename(item.name, extname(item.name)));
        const raw = fs.readFileSync(resolve(articlesDir, item.name), 'utf-8');
        const { data, content } = matter(raw);
        const htmlContent = processMarkdown(content, data, slug);

        const articleObj = {
          type: 'toplevel',
          slug,
          title: data.title || basename(item.name, extname(item.name)),
          displayTitle: data.title || basename(item.name, extname(item.name)),
          description: data.description || '',
          order: data.order || 0,
          htmlContent,
          url: `./pages/articles/${slug}.html`,
          outputFilename: `${slug}.html`,
        };

        topLevelArticles.push(articleObj);

      } else if (item.isDirectory()) {
        const dirMatch = item.name.match(/^(\d+)\s+(.+)$/);
        const chapterNum = dirMatch ? parseInt(dirMatch[1], 10) : 99;
        const chapterName = dirMatch ? dirMatch[2] : item.name;

        const chapterObj = {
          number: chapterNum,
          name: chapterName,
          dirName: item.name,
          lessons: [],
        };

        const chapterPath = resolve(articlesDir, item.name);
        const files = fs.readdirSync(chapterPath, { withFileTypes: true });

        for (const file of files) {
          if (file.isFile() && (extname(file.name) === '.md' || extname(file.name) === '.mdx')) {
            const fileMatch = file.name.match(/^(\d+)\s+(.+)\.(md|mdx)$/i);
            const lessonNum = fileMatch ? parseInt(fileMatch[1], 10) : 99;
            const lessonNameRaw = fileMatch ? fileMatch[2] : basename(file.name, extname(file.name));

            const raw = fs.readFileSync(resolve(chapterPath, file.name), 'utf-8');
            const { data, content } = matter(raw);
            const slug = `${chapterNum}-${lessonNum}-${slugify(lessonNameRaw)}`;
            const htmlContent = processMarkdown(content, data, slug);

            const lessonTitle = data.title || lessonNameRaw;

            const lessonObj = {
              type: 'lesson',
              chapterNum,
              lessonNum,
              slug,
              title: `Chapter ${chapterNum}.${lessonNum}: ${lessonTitle}`,
              displayTitle: `Lesson ${chapterNum}.${lessonNum}: ${lessonTitle}`,
              description: data.description || '',
              htmlContent,
              url: `./pages/articles/${slug}.html`,
              outputFilename: `${slug}.html`,
            };

            chapterObj.lessons.push(lessonObj);
          }
        }

        chapterObj.lessons.sort((a, b) => a.lessonNum - b.lessonNum);
        chaptersMap.set(chapterNum, chapterObj);
      }
    }
  }

  topLevelArticles.sort((a, b) => a.order - b.order);
  const sortedChapters = Array.from(chaptersMap.values()).sort((a, b) => a.number - b.number);

  const allOrderedPages = [...topLevelArticles];
  for (const chap of sortedChapters) {
    allOrderedPages.push(...chap.lessons);
  }

  for (let i = 0; i < allOrderedPages.length; i++) {
    const page = allOrderedPages[i];
    const prevPage = i > 0 ? allOrderedPages[i - 1] : null;
    const nextPage = i < allOrderedPages.length - 1 ? allOrderedPages[i + 1] : null;

    const prevLessonHtml = prevPage
      ? `<a href="./${prevPage.slug}.html" class="nav-link-prev">← ${prevPage.displayTitle}</a>`
      : '';

    const nextLessonHtml = nextPage
      ? `<a href="./${nextPage.slug}.html" class="nav-link-next">Next lesson: ${nextPage.displayTitle} →</a>`
      : '';

    let result = template
      .replace('{{> navbar}}', navbarArticleHtml)
      .replace('{{> footer}}', footerHtml)
      .replace(/\{\{bookTitle\}\}/g, bookConfig.title)
      .replace(/\{\{author\}\}/g, bookConfig.author)
      .replace(/\{\{\{authorHtml\}\}\}/g, authorHtml)
      .replace(/\{\{language\}\}/g, bookConfig.language || 'en')
      .replace(/\{\{theme\}\}/g, bookConfig.theme)
      .replace(/\{\{pageTitle\}\}/g, page.title)
      .replace(/\{\{pageDesc\}\}/g, page.description)
      .replace('{{{articleBody}}}', page.htmlContent)
      .replace('{{{prevLessonHtml}}}', prevLessonHtml)
      .replace('{{{nextLessonHtml}}}', nextLessonHtml);

    fs.writeFileSync(resolve(outputDir, page.outputFilename), result, 'utf-8');
  }

  // Layout Plugins Handling
  const layoutsDir = resolve(import.meta.dirname, 'layouts');
  const activeTocLayout = (bookConfig.tocLayout || 'grid-cards').toLowerCase().trim();

  let activeLayoutDir = resolve(layoutsDir, activeTocLayout);
  if (!fs.existsSync(activeLayoutDir)) {
    activeLayoutDir = resolve(layoutsDir, 'grid-cards');
  }

  let layoutStylesContent = '';
  let layoutScriptContent = '';
  let tocHtml = '';

  if (fs.existsSync(activeLayoutDir)) {
    const cssPath = resolve(activeLayoutDir, 'styles.css');
    const jsPath = resolve(activeLayoutDir, 'script.js');
    const tplPath = resolve(activeLayoutDir, 'template.hbs');

    if (fs.existsSync(cssPath)) {
      layoutStylesContent = fs.readFileSync(cssPath, 'utf-8');
    }
    if (fs.existsSync(jsPath)) {
      layoutScriptContent = fs.readFileSync(jsPath, 'utf-8');
    }

    if (fs.existsSync(tplPath)) {
      const rawTpl = fs.readFileSync(tplPath, 'utf-8');
      
      sortedChapters.forEach(ch => {
        ch.lessons.forEach(les => {
          les.displayTitleClean = les.displayTitle.replace(/^(Lesson|Lekcja|Chapter|Rozdział)\s+\d+(\.\d+)?:\s*/i, '');
        });
      });

      try {
        const templateFn = Handlebars.compile(rawTpl);
        tocHtml = templateFn({ topLevelArticles, sortedChapters });
      } catch (err) {
        console.warn('[build-articles] Error compiling layout template:', err.message);
      }
    }
  }

  if (!tocHtml.trim()) {
    if (topLevelArticles.length > 0) {
      tocHtml += `<div class="toc-toplevel"><ul class="book-toc-list">` +
        topLevelArticles.map(a => `<li class="book-toc-item"><a href="${a.url}"><strong>${a.title}</strong></a><p class="toc-desc">${a.description}</p></li>`).join('') +
        `</ul></div>`;
    }
    if (sortedChapters.length > 0) {
      tocHtml += `<div class="toc-chapters">` +
        sortedChapters.map(c => `<div class="toc-chapter-block"><h3>Chapter ${c.number}: ${c.name}</h3><ol>` +
          c.lessons.map(l => `<li><a href="${l.url}"><strong>Lesson ${c.number}.${l.lessonNum}:</strong> ${l.title}</a></li>`).join('') +
          `</ol></div>`).join('') +
        `</div>`;
    }
  }

  let layoutHeadHtml = '';
  if (layoutStylesContent) {
    layoutHeadHtml += `<style>\n/* Layout Headless CSS: ${activeTocLayout} */\n${layoutStylesContent}\n</style>\n`;
  }
  if (layoutScriptContent) {
    layoutHeadHtml += `<script>\n${layoutScriptContent}\n</script>\n`;
  }

  fs.writeFileSync(resolve(partialsDir, 'toc.hbs'), tocHtml, 'utf-8');
  fs.writeFileSync(resolve(partialsDir, 'layoutHead.hbs'), layoutHeadHtml, 'utf-8');
  console.log(`[build-articles] Generated book "${bookConfig.title}" (theme: ${bookConfig.theme}, layout: ${activeTocLayout}, ${allOrderedPages.length} pages).`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'build-articles.js')) {
  buildArticles();
}
