<p align="center">
  <img src="./logo.png" alt="Quickbook Logo" width="180">
</p>

# 📚 create-quickbook

A CLI package and template generator for building tech handbooks, books, and programming guides published on **GitHub Pages**.

---

## ⚡ Quick Start (CLI Generator)

Create a brand new Quickbook project instantly with a single command:

```bash
npm create quickbook@latest my-book
# or in the current directory:
npm create quickbook@latest ./
```

### Next Steps:

```bash
cd my-book
npm install
npm run admin      # Launches interactive Admin Panel at http://localhost:4455
npm run generate   # Generates the production HTML pages in /dist
npm run dev        # Starts local development server
```

---

## 🖥️ Interactive Admin Panel (`http://localhost:4455`)

Quickbook includes a zero-dependency local GUI Studio running on port **4455**:

```bash
npm run admin
```

Features:
* 📝 **Visual Chapter & Article Manager**: Create, rename, edit, or delete chapters and lessons visually.
* ✍️ **Markdown Editor with Live Preview**: Edit content with real-time rendered preview.
* 🎨 **Theme & Config Selector**: Switch themes (`dark`, `default`, `blue`, `red`, `green`, `coffee`) and update `settings.json` visually.
* ⚡ **1-Click Build Generator**: Trigger `npm run generate` directly from the browser UI.

---

## 🛠 Available Commands

| Command | Description |
|---|---|
| `npm run admin` | Launches local Admin Studio Dashboard at `http://localhost:4455` |
| `npm run update` | Updates Quickbook Studio & core framework files to the latest version (preserves your articles and config) |
| `npm run generate` | Generates all static HTML pages and builds the production output to `/dist` |
| `npm run dev` | Starts local development server with hot reloading |
| `npm run build` | Builds the production bundle |
| `npm run serve` | Previews the built production site locally |

---

## ⚙️ Configuration (`settings.json`)

Edit `settings.json` in your project root to customize book properties:

```json
{
  "title": "My Quickbook Handbook",
  "subtitle": "A step-by-step documentation guide",
  "author": "Your Name",
  "authorGithub": "https://github.com/your-username",
  "description": "Interactive documentation published on GitHub Pages.",
  "github": "https://github.com/your-username/my-quickbook",
  "language": "en",
  "theme": "dark"
}
```

### 🎨 Color Themes (`theme`):
- `"default"` – Classic light GitHub documentation theme (default)
- `"dark"` – Dark Mode
- `"blue"` – Soft pastel blue
- `"red"` – Soft pastel rose red
- `"green"` – Soft pastel sage green
- `"coffee"` – Warm sepia/coffee theme

---

## 🧩 Extensions & Community Themes (`quickbook.config.js`)

Quickbook supports custom JavaScript extensions and custom SCSS/CSS themes via `quickbook.config.js`:

```javascript
export default {
  // Custom SCSS/CSS Themes
  themes: {
    dracula: './src/scss/themes/dracula.scss',
    nord: './src/scss/themes/nord.scss'
  },

  // Custom JS Extensions / Plugins
  extensions: [
    {
      name: 'custom-alert',
      transform(htmlContent) {
        return htmlContent.replace(/<blockquote/g, '<blockquote class="custom-alert"');
      }
    }
  ]
};
```

---

## 📂 Content Structure (`articles/`)

Add chapters and lessons in the `articles/` directory:

```text
articles/
├── 1 Getting Started/                          <-- Chapter folder: {chapter_number} {chapter_name}
│   ├── 1 Introduction.md                       <-- Lesson file: {lesson_number} {lesson_name}.md
│   └── 2 Environment Setup.md
└── 2 Core Concepts/
    └── 1 Basics.md
```

---

## ✨ Features

* 🚀 **CLI Generator**: Run `npm create quickbook@latest` to generate a ready-to-use template.
* 🖥️ **Built-in Admin Studio**: Manage articles, settings, and themes at `http://localhost:4455`.
* 🎨 **6 Built-in Pastel & Dark Themes**.
* 🔗 **Author GitHub Link Support**: Optional `authorGithub` field in `settings.json` rendering clickable profile link.
* 📚 **Automatic Table of Contents (TOC)** with top-level articles and numbered chapters/lessons.
* ⚡ **Zero-JS Syntax Highlighting** powered by [`sugar-high`](https://github.com/huozhi/sugar-high).
* 🌐 **GitHub Pages Ready**: Out-of-the-box relative paths (`base: './'`).
