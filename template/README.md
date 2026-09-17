<p align="center">
  <img src="https://raw.githubusercontent.com/mariusz/create-quickbook/main/logo.png" alt="Quickbook Logo" width="160">
</p>

# 📚 My Quickbook Handbook

Generated with `npm create quickbook@latest`.

## 🚀 Available Commands

In your project directory, you can run:

### `npm run admin`
Launches the interactive Admin Panel at **`http://localhost:4455`** where you can visually manage chapters, edit articles with live Markdown preview, change themes, and trigger builds.

### `npm run update`
Updates QuickBook Studio (`.quickbook/`), generator scripts (`build-articles.js`), and core configs to the latest QuickBook version while protecting your articles, `settings.json`, and `quickbook.config.js`.

### `npm run dev`
Starts the local development server with hot reloading.

### `npm run generate`
Generates the HTML pages from your Markdown files and builds the static website into the `/dist` directory for production deployment.

### `npm run serve`
Previews the generated production build locally.

---

## ⚙️ Configuration (`settings.json`)

Edit `settings.json` in the root directory to customize your book title, author, optional GitHub link, language, and theme:

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

---

## 🧩 Extensions & Community Themes (`quickbook.config.js`)

Edit `quickbook.config.js` to add custom JavaScript extensions and custom SCSS/CSS themes:

```javascript
export default {
  themes: {
    // dracula: './src/scss/themes/dracula.scss'
  },
  extensions: [
    // { name: 'my-plugin', transform(html) { return html; } }
  ]
};
```

---

## ✍️ Writing Articles

Place your Markdown files in the `articles/` directory (or use the Admin Panel at `http://localhost:4455`):
- Chapters are folders starting with a number (e.g. `articles/1 Getting Started/`)
- Lessons are Markdown files starting with a number (e.g. `1 Introduction.md`)
