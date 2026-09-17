/**
 * Author Date Badge Extension for Quickbook
 *
 * Injects author & publication date badge at the top of article content.
 */

export default {
  name: 'author-date-badge',
  /**
   * Transform function called during article processing.
   * @param {string} htmlContent - Rendered HTML of the Markdown body
   * @param {object} context - Article metadata ({ data, slug, bookConfig })
   */
  transform(htmlContent, { data, bookConfig }) {
    const dateStr = data.date || new Date().toISOString().slice(0, 10);
    const authorName = bookConfig.author || 'Author';
    const authorLink = bookConfig.authorGithub
      ? `<a href="${bookConfig.authorGithub}" target="_blank" rel="noopener noreferrer">${authorName}</a>`
      : authorName;

    const metaHeader = `
<div class="article-meta-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px rgba(255,255,255,0.1) dashed; font-size: 0.9rem; color: var(--muted-color, #8b949e);">
  <span>✍️ Author: <strong>${authorLink}</strong></span>
  <span>•</span>
  <span>📅 Published: <strong><time datetime="${dateStr}">${dateStr}</time></strong></span>
</div>
`;

    return metaHeader + htmlContent;
  }
};
