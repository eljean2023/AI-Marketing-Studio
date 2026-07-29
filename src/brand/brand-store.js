const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getStorePath() {
  return path.join(app.getPath('userData'), 'brand-kit.json');
}

const DEFAULT_BRAND_KIT = {
  businessName: '',
  website: '',
  phone: '',
  email: '',
  whatsapp: '',
  logo: { filePath: null },
  colors: { primary: '#000000', secondary: '#000000' },
  font: '',
  musicTrackId: null,
  overlay: { filePath: null, fileType: null },
  intro: { filePath: null },
  outro: { filePath: null },
  social: { instagram: '', facebook: '', tiktok: '', youtube: '', linkedin: '' },
  defaultCta: '',
};

function getBrandKit() {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_BRAND_KIT,
      ...parsed,
      logo: { ...DEFAULT_BRAND_KIT.logo, ...parsed.logo },
      colors: { ...DEFAULT_BRAND_KIT.colors, ...parsed.colors },
      overlay: { ...DEFAULT_BRAND_KIT.overlay, ...parsed.overlay },
      intro: { ...DEFAULT_BRAND_KIT.intro, ...parsed.intro },
      outro: { ...DEFAULT_BRAND_KIT.outro, ...parsed.outro },
      social: { ...DEFAULT_BRAND_KIT.social, ...parsed.social },
    };
  } catch (error) {
    return { ...DEFAULT_BRAND_KIT };
  }
}

function saveBrandKit(brandKit) {
  fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
  fs.writeFileSync(getStorePath(), JSON.stringify(brandKit, null, 2));
}

module.exports = { getBrandKit, saveBrandKit };
