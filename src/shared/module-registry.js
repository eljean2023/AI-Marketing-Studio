// Central catalog of Home Screen modules. Each module owns its own
// logic/components/ipc/renderer flow (see CLAUDE.md) and is listed here
// with the metadata the Home Screen needs to render its card. Adding a
// future module means adding one entry here (plus wiring its flow starter
// in app.js once the module actually exists) -- the Home Screen itself
// requires no changes.

const ICON_STROKE = 'stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';

const cameraIcon = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><rect x="3" y="6" width="12" height="12" rx="2"></rect><path d="M15 9.5l6-3v11l-6-3z"></path></svg>`;
const scissorsIcon = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><circle cx="6" cy="6" r="2.5"></circle><circle cx="6" cy="18" r="2.5"></circle><line x1="8.3" y1="7.5" x2="19" y2="18"></line><line x1="19" y1="6" x2="8.3" y2="16.5"></line></svg>`;
const phoneIcon = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><rect x="7" y="2" width="10" height="20" rx="2.5"></rect><path d="M10.5 9.3v5.4l4.5-2.7z" fill="white" stroke="none"></path></svg>`;
const megaphoneIcon = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><path d="M3 10v4h3l5 4V6l-5 4H3z"></path><path d="M16 9a4 4 0 010 6"></path><path d="M18.5 6.5a8 8 0 010 11"></path></svg>`;
const penIcon = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><path d="M4 20l4.5-1.2L19.5 7.8a1.8 1.8 0 000-2.5l-1.6-1.6a1.8 1.8 0 00-2.5 0L4.4 14.7 4 20z"></path><path d="M14 5.5l3.5 3.5"></path></svg>`;
const paletteIcon = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><path d="M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h1.6A4.4 4.4 0 0021 9.9 8.98 8.98 0 0012 3z"></path><circle cx="7.5" cy="10.5" r="1"></circle><circle cx="11.5" cy="7.5" r="1"></circle><circle cx="15.5" cy="9" r="1"></circle></svg>`;
const shareIcon = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><circle cx="6" cy="12" r="2.2"></circle><circle cx="17" cy="5.5" r="2.2"></circle><circle cx="17" cy="18.5" r="2.2"></circle><line x1="8" y1="11" x2="15" y2="6.5"></line><line x1="8" y1="13" x2="15" y2="17.5"></line></svg>`;

const MODULE_ACCENT = '#22C55E';

// enabled/comingSoon are kept as separate flags (rather than derived from
// one another) so a module can in principle be listed without being
// offered yet, even once it's technically wired up.
export const MODULE_REGISTRY = [
  {
    id: 'recorder',
    title: 'Record a New Demo',
    tag: 'Screen Recording',
    description: 'Record your screen with professional quality.',
    icon: cameraIcon,
    accent: MODULE_ACCENT,
    enabled: true,
    comingSoon: false,
  },
  {
    id: 'snip',
    title: 'Video Snipping Tool',
    tag: 'Video Editing',
    description: 'Select exactly what you want to keep.',
    icon: scissorsIcon,
    accent: MODULE_ACCENT,
    enabled: true,
    comingSoon: false,
  },
  {
    id: 'shorts',
    title: 'Shorts Creator',
    tag: 'Shorts Creator',
    description: 'Turn a script into a narrated, captioned vertical video.',
    icon: phoneIcon,
    accent: MODULE_ACCENT,
    enabled: true,
    comingSoon: false,
  },
  {
    id: 'spots',
    title: 'Spot Creator',
    tag: 'Promo Videos',
    description: 'Template-driven promotional videos for businesses.',
    icon: megaphoneIcon,
    accent: MODULE_ACCENT,
    enabled: true,
    comingSoon: false,
  },
  {
    id: 'copywriter',
    title: 'AI Copywriter',
    tag: 'Copywriting',
    description: 'Generate hooks, titles, descriptions, CTAs and hashtags.',
    icon: penIcon,
    accent: MODULE_ACCENT,
    enabled: true,
    comingSoon: false,
  },
  {
    id: 'brand',
    title: 'Brand Kit',
    tag: 'Branding',
    description: 'Store your logo, colors, fonts, music and business info.',
    icon: paletteIcon,
    accent: MODULE_ACCENT,
    enabled: true,
    comingSoon: false,
  },
  {
    id: 'social',
    title: 'Social Export',
    tag: 'Distribution',
    description: 'Export presets for YouTube, TikTok, Reels and more.',
    icon: shareIcon,
    accent: MODULE_ACCENT,
    enabled: false,
    comingSoon: true,
  },
];
