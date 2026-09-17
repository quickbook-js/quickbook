/**
 * Social Media Links Extension for Quickbook
 *
 * Displays minimalist square icon buttons for social media profiles.
 * Default state: DISABLED (enabled = false).
 */

export function renderIcons(options = {}) {
  const platforms = [
    { key: 'github', title: 'GitHub', icon: 'bxl-github', bg: '#24292e', color: '#ffffff' },
    { key: 'linkedin', title: 'LinkedIn', icon: 'bxl-linkedin', bg: '#0a66c2', color: '#ffffff' },
    { key: 'twitter', title: 'Twitter / X', icon: 'bxl-twitter', bg: '#1da1f2', color: '#ffffff' },
    { key: 'youtube', title: 'YouTube', icon: 'bxl-youtube', bg: '#ff0000', color: '#ffffff' },
    { key: 'instagram', title: 'Instagram', icon: 'bxl-instagram', bg: '#e4405f', color: '#ffffff' },
    { key: 'discord', title: 'Discord', icon: 'bxl-discord', bg: '#5865f2', color: '#ffffff' },
    { key: 'twitch', title: 'Twitch', icon: 'bxl-twitch', bg: '#9146ff', color: '#ffffff' },
    { key: 'website', title: 'Website', icon: 'bx-globe', bg: '#0070f3', color: '#ffffff' }
  ];

  const squareIcons = [];

  for (const p of platforms) {
    const url = (options[p.key] || '').trim();
    if (url) {
      squareIcons.push(`
        <a href="${url}" target="_blank" rel="noopener noreferrer" title="${p.title}" class="qb-social-square" style="
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: ${p.bg};
          color: ${p.color};
          text-decoration: none;
          transition: transform 0.15s ease, opacity 0.15s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.12);
        ">
          <i class="bx ${p.icon}" style="font-size: 1.25rem; line-height: 1;"></i>
        </a>
      `);
    }
  }

  if (squareIcons.length === 0) return '';

  return `
<div class="qb-socials-row" style="
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0.85rem 0;
">
  ${squareIcons.join('')}
</div>
`;
}

export default {
  name: 'socials',
  title: 'Social Media Icons',
  description: 'Minimalist square social icon buttons without text labels.',
  configSchema: {
    enabled: { type: 'boolean', default: false, label: 'Enable Extension (Disabled by Default)' },
    showOnFooter: { type: 'boolean', default: true, label: 'Show in Site Footer (bottom of site)' },
    showOnHomepage: { type: 'boolean', default: false, label: 'Show on Homepage' },
    showOnArticles: { type: 'boolean', default: false, label: 'Show in Articles' },
    github: { type: 'text', default: '', label: 'GitHub URL' },
    linkedin: { type: 'text', default: '', label: 'LinkedIn URL' },
    twitter: { type: 'text', default: '', label: 'Twitter / X URL' },
    youtube: { type: 'text', default: '', label: 'YouTube URL' },
    instagram: { type: 'text', default: '', label: 'Instagram URL' },
    discord: { type: 'text', default: '', label: 'Discord URL' },
    twitch: { type: 'text', default: '', label: 'Twitch URL' },
    website: { type: 'text', default: '', label: 'Website URL' }
  },

  renderIcons,

  /**
   * Transform function called during article processing.
   * @param {string} htmlContent - Rendered HTML of the Markdown body
   * @param {object} context - Article metadata & extension options ({ data, slug, bookConfig, options })
   */
  transform(htmlContent, { slug, options = {} }) {
    const opts = {
      enabled: false,
      showOnFooter: true,
      showOnHomepage: false,
      showOnArticles: false,
      github: '',
      linkedin: '',
      twitter: '',
      youtube: '',
      instagram: '',
      discord: '',
      twitch: '',
      website: '',
      ...options
    };

    if (opts.enabled !== true) {
      return htmlContent;
    }

    const iconsHtml = renderIcons(opts);
    if (!iconsHtml) return htmlContent;

    const isTopLevel = !slug || slug === 'index' || slug === 'home' || !slug.includes('-');

    if (opts.showOnHomepage && isTopLevel) {
      htmlContent = htmlContent + iconsHtml;
    }

    if (opts.showOnArticles && !isTopLevel) {
      htmlContent = htmlContent + iconsHtml;
    }

    return htmlContent;
  }
};
