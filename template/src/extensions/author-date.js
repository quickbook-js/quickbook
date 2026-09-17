/**
 * Author Date Badge Extension for Quickbook
 *
 * Injects author & publication date badge at the top of article content.
 */

export default {
  name: 'author-date-badge',
  title: 'Author & Date Badge',
  description: 'Displays author name and publication date header at the top of articles.',
  configSchema: {
    enabled: { type: 'boolean', default: true, label: 'Enable Extension' },
    showAuthor: { type: 'boolean', default: true, label: 'Show Author' },
    showDate: { type: 'boolean', default: true, label: 'Show Date' }
  },
  /**
   * Transform function called during article processing.
   * @param {string} htmlContent - Rendered HTML of the Markdown body
   * @param {object} context - Article metadata & extension options ({ data, slug, bookConfig, options })
   */
  transform(htmlContent, { data, bookConfig, options = {} }) {
    const opts = { enabled: true, showAuthor: true, showDate: true, ...options };
    if (opts.enabled === false) {
      return htmlContent;
    }

    const dateStr = data.date || new Date().toISOString().slice(0, 10);
    const authorName = bookConfig.author || 'Author';
    const authorLink = bookConfig.authorGithub
      ? `<a href="${bookConfig.authorGithub}" target="_blank" rel="noopener noreferrer">${authorName}</a>`
      : authorName;

    const parts = [];
    if (opts.showAuthor) {
      parts.push(`<span>✍️ Author: <strong>${authorLink}</strong></span>`);
    }
    if (opts.showDate) {
      parts.push(`<span>📅 Published: <strong><time datetime="${dateStr}">${dateStr}</time></strong></span>`);
    }

    if (parts.length === 0) {
      return htmlContent;
    }

    const metaHeader = `
<div class="article-meta-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px dashed var(--border-color, rgba(255,255,255,0.1)); font-size: 0.9rem; color: var(--muted-color, #8b949e);">
  ${parts.join(' <span>•</span> ')}
</div>
`;

    return metaHeader + htmlContent;
  }
};
