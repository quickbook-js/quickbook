/**
 * Quickbook Configuration & Extension File
 *
 * Exporting paths to custom themes (SCSS/CSS) and JS extensions (.js)
 */

export default {
  /**
   * Custom SCSS/CSS themes.
   * Key: theme name, Value: path to SCSS/CSS file
   */
  themes: {
    dracula: './src/scss/themes/dracula.scss'
  },

  /**
   * Custom JavaScript extensions (.js files).
   * Array of file paths to JavaScript extensions exporting transform functions.
   */
  extensions: [
    './src/extensions/author-date.js',
    './src/extensions/socials.js'
  ]
};
