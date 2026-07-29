const SOCIAL_PLATFORMS = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
  ['linkedin', 'LinkedIn'],
];

export function startBrandFlow(container, { onExit }) {
  container.innerHTML = '';

  const homeLink = document.createElement('button');
  homeLink.type = 'button';
  homeLink.className = 'home-link';
  homeLink.textContent = '← Home';
  homeLink.addEventListener('click', () => onExit());
  container.appendChild(homeLink);

  const appEl = document.createElement('div');
  appEl.className = 'flow-content';
  container.appendChild(appEl);

  let brandKit = null;
  let musicTracks = [];
  let logoPreviewDataUrl = null;
  let overlayPreviewDataUrl = null; // only used when overlay.fileType === 'image'
  let saveStatus = 'idle'; // 'idle' | 'saving' | 'saved' | 'error'
  let saveErrorMessage = '';
  let saveStatusEl = null;

  renderLoading();

  async function renderLoading() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Brand Kit';
    appEl.appendChild(heading);

    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading…';
    appEl.appendChild(loadingText);

    const loaded = await window.brandAPI.get();
    brandKit = loaded.brandKit;
    musicTracks = loaded.musicTracks;

    await Promise.all([refreshLogoPreview(), refreshOverlayPreview()]);

    renderForm();
  }

  async function refreshLogoPreview() {
    logoPreviewDataUrl = brandKit.logo.filePath
      ? await window.brandAPI.readImageAsDataUrl(brandKit.logo.filePath)
      : null;
  }

  async function refreshOverlayPreview() {
    overlayPreviewDataUrl = (brandKit.overlay.filePath && brandKit.overlay.fileType === 'image')
      ? await window.brandAPI.readImageAsDataUrl(brandKit.overlay.filePath)
      : null;
  }

  // Cheap way to clear a stale "Saved" badge when a field changes, without
  // a full re-render (which would steal focus out of a text field mid-edit).
  function markDirty() {
    if (saveStatus === 'idle') return;
    saveStatus = 'idle';
    if (saveStatusEl) {
      saveStatusEl.remove();
      saveStatusEl = null;
    }
  }

  function renderForm() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Brand Kit';
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = 'Store your business identity once — future modules reuse it instead of asking again.';
    appEl.appendChild(description);

    const form = document.createElement('div');
    form.className = 'shorts-form';

    form.appendChild(buildBusinessInfoSection());
    form.appendChild(buildVisualIdentitySection());
    form.appendChild(buildMusicOverlaySection());
    form.appendChild(buildIntroOutroSection());
    form.appendChild(buildSocialSection());
    form.appendChild(buildCtaSection());
    form.appendChild(buildSaveRow());

    appEl.appendChild(form);
  }

  // --- Sections ---

  function buildBusinessInfoSection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Business Information'));

    panel.appendChild(buildTextField({
      label: 'Business Name',
      value: brandKit.businessName,
      placeholder: 'Acme Studio',
      onChange: (value) => { brandKit.businessName = value; markDirty(); },
    }));

    panel.appendChild(buildTextField({
      label: 'Website',
      value: brandKit.website,
      placeholder: 'https://example.com',
      type: 'url',
      onChange: (value) => { brandKit.website = value; markDirty(); },
    }));

    const contactRow = document.createElement('div');
    contactRow.className = 'shorts-global-row';
    contactRow.appendChild(buildTextField({
      label: 'Phone',
      value: brandKit.phone,
      placeholder: '+1 555 123 4567',
      type: 'tel',
      onChange: (value) => { brandKit.phone = value; markDirty(); },
    }));
    contactRow.appendChild(buildTextField({
      label: 'Email',
      value: brandKit.email,
      placeholder: 'hello@example.com',
      type: 'email',
      onChange: (value) => { brandKit.email = value; markDirty(); },
    }));
    panel.appendChild(contactRow);

    panel.appendChild(buildTextField({
      label: 'WhatsApp',
      value: brandKit.whatsapp,
      placeholder: '+1 555 123 4567',
      type: 'tel',
      onChange: (value) => { brandKit.whatsapp = value; markDirty(); },
    }));

    return panel;
  }

  function buildVisualIdentitySection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Visual Identity'));

    panel.appendChild(buildLogoField());

    const colorRow = document.createElement('div');
    colorRow.className = 'shorts-global-row';
    colorRow.appendChild(buildColorField({
      label: 'Primary Color',
      value: brandKit.colors.primary,
      onChange: (value) => { brandKit.colors.primary = value; markDirty(); },
    }));
    colorRow.appendChild(buildColorField({
      label: 'Secondary Color',
      value: brandKit.colors.secondary,
      onChange: (value) => { brandKit.colors.secondary = value; markDirty(); },
    }));
    panel.appendChild(colorRow);

    panel.appendChild(buildTextField({
      label: 'Font',
      value: brandKit.font,
      placeholder: 'e.g. Poppins, Montserrat, Arial',
      onChange: (value) => { brandKit.font = value; markDirty(); },
    }));

    return panel;
  }

  function buildMusicOverlaySection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Music & Overlay'));

    panel.appendChild(buildSelectField({
      label: 'Favorite Music',
      options: [{ id: '', label: 'None' }, ...musicTracks],
      value: brandKit.musicTrackId || '',
      onChange: (value) => { brandKit.musicTrackId = value || null; markDirty(); },
    }));

    panel.appendChild(buildOverlayField());

    return panel;
  }

  function buildIntroOutroSection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Intro & Outro'));

    panel.appendChild(buildVideoField({
      label: 'Intro Video',
      filePath: brandKit.intro.filePath,
      onPick: async () => {
        const result = await window.brandAPI.pickIntro();
        if (result.canceled) return false;
        brandKit.intro.filePath = result.filePath;
        markDirty();
        return true;
      },
    }));

    panel.appendChild(buildVideoField({
      label: 'Outro Video',
      filePath: brandKit.outro.filePath,
      onPick: async () => {
        const result = await window.brandAPI.pickOutro();
        if (result.canceled) return false;
        brandKit.outro.filePath = result.filePath;
        markDirty();
        return true;
      },
    }));

    return panel;
  }

  function buildSocialSection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Social Media'));

    SOCIAL_PLATFORMS.forEach(([key, label]) => {
      panel.appendChild(buildTextField({
        label,
        value: brandKit.social[key],
        placeholder: 'https://...',
        type: 'url',
        onChange: (value) => { brandKit.social[key] = value; markDirty(); },
      }));
    });

    return panel;
  }

  function buildCtaSection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Default Call-To-Action'));

    panel.appendChild(buildTextField({
      label: 'Default CTA',
      value: brandKit.defaultCta,
      placeholder: 'e.g. Book Now, Order Today, Call Us',
      onChange: (value) => { brandKit.defaultCta = value; markDirty(); },
    }));

    return panel;
  }

  function buildSaveRow() {
    const row = document.createElement('div');
    row.className = 'brand-save-row';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = saveStatus === 'saving' ? 'Saving…' : 'Save Brand Kit';
    saveBtn.disabled = saveStatus === 'saving';
    saveBtn.addEventListener('click', handleSave);
    row.appendChild(saveBtn);

    saveStatusEl = null;
    if (saveStatus === 'saved' || saveStatus === 'error') {
      saveStatusEl = document.createElement('span');
      saveStatusEl.className = 'brand-save-status';
      if (saveStatus === 'error') {
        saveStatusEl.style.color = 'var(--danger)';
        saveStatusEl.textContent = saveErrorMessage || 'Could not save';
      } else {
        saveStatusEl.textContent = '✓ Saved';
      }
      row.appendChild(saveStatusEl);
    }

    return row;
  }

  async function handleSave() {
    saveStatus = 'saving';
    renderForm();

    try {
      await window.brandAPI.save(brandKit);
      saveStatus = 'saved';
    } catch (error) {
      saveStatus = 'error';
      saveErrorMessage = error.message;
    }

    renderForm();
  }

  // --- Shared field builders ---

  function sectionHeading(text) {
    const heading = document.createElement('p');
    heading.className = 'shorts-section-heading';
    heading.textContent = text;
    return heading;
  }

  function buildTextField({ label, value, placeholder, type, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = type || 'text';
    input.className = 'shorts-select';
    input.placeholder = placeholder || '';
    input.value = value || '';
    input.addEventListener('input', () => onChange(input.value));
    wrap.appendChild(input);

    return wrap;
  }

  function buildSelectField({ label, options, value, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const select = document.createElement('select');
    select.className = 'shorts-select';
    options.forEach((choice) => {
      const opt = document.createElement('option');
      opt.value = choice.id;
      opt.textContent = choice.label;
      opt.selected = choice.id === value;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => onChange(select.value));
    wrap.appendChild(select);

    return wrap;
  }

  function buildColorField({ label, value, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const row = document.createElement('div');
    row.className = 'brand-color-row';

    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'brand-color-swatch';
    input.value = value || '#000000';

    const hexEl = document.createElement('span');
    hexEl.className = 'brand-color-hex';
    hexEl.textContent = input.value;

    input.addEventListener('input', () => {
      hexEl.textContent = input.value;
      onChange(input.value);
    });

    row.appendChild(input);
    row.appendChild(hexEl);
    wrap.appendChild(row);

    return wrap;
  }

  function buildLogoField() {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';
    wrap.appendChild(fieldLabel('Logo'));

    const pickerWrap = document.createElement('div');
    pickerWrap.className = 'shorts-custom-overlay';

    if (brandKit.logo.filePath) {
      const preview = document.createElement('img');
      preview.className = 'shorts-overlay-preview';
      preview.src = logoPreviewDataUrl || '';
      pickerWrap.appendChild(preview);
      pickerWrap.appendChild(fileNameText(brandKit.logo.filePath));
    }

    const browseBtn = document.createElement('button');
    browseBtn.type = 'button';
    browseBtn.className = 'btn btn-secondary';
    browseBtn.textContent = brandKit.logo.filePath ? 'Change Logo' : 'Browse…';
    browseBtn.addEventListener('click', async () => {
      const result = await window.brandAPI.pickLogo();
      if (result.canceled) return;
      brandKit.logo.filePath = result.filePath;
      markDirty();
      await refreshLogoPreview();
      renderForm();
    });
    pickerWrap.appendChild(browseBtn);

    wrap.appendChild(pickerWrap);
    return wrap;
  }

  function buildOverlayField() {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';
    wrap.appendChild(fieldLabel('Favorite Overlay'));

    const pickerWrap = document.createElement('div');
    pickerWrap.className = 'shorts-custom-overlay';

    if (brandKit.overlay.filePath) {
      const isImage = brandKit.overlay.fileType === 'image';
      const preview = document.createElement(isImage ? 'img' : 'video');
      preview.className = 'shorts-overlay-preview';
      preview.src = isImage ? (overlayPreviewDataUrl || '') : `file://${brandKit.overlay.filePath}`;
      if (!isImage) {
        preview.controls = true;
        preview.muted = true;
      }
      pickerWrap.appendChild(preview);
      pickerWrap.appendChild(fileNameText(brandKit.overlay.filePath));
    }

    const browseBtn = document.createElement('button');
    browseBtn.type = 'button';
    browseBtn.className = 'btn btn-secondary';
    browseBtn.textContent = brandKit.overlay.filePath ? 'Change Overlay' : 'Browse…';
    browseBtn.addEventListener('click', async () => {
      const result = await window.brandAPI.pickOverlay();
      if (result.canceled) return;
      brandKit.overlay.filePath = result.filePath;
      brandKit.overlay.fileType = result.fileType;
      markDirty();
      await refreshOverlayPreview();
      renderForm();
    });
    pickerWrap.appendChild(browseBtn);

    wrap.appendChild(pickerWrap);
    return wrap;
  }

  function buildVideoField({ label, filePath, onPick }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';
    wrap.appendChild(fieldLabel(label));

    const pickerWrap = document.createElement('div');
    pickerWrap.className = 'shorts-custom-overlay';

    if (filePath) {
      const preview = document.createElement('video');
      preview.className = 'shorts-overlay-preview';
      preview.src = `file://${filePath}`;
      preview.controls = true;
      preview.muted = true;
      pickerWrap.appendChild(preview);
      pickerWrap.appendChild(fileNameText(filePath));
    }

    const browseBtn = document.createElement('button');
    browseBtn.type = 'button';
    browseBtn.className = 'btn btn-secondary';
    browseBtn.textContent = filePath ? `Change ${label}` : 'Browse…';
    browseBtn.addEventListener('click', async () => {
      const picked = await onPick();
      if (picked) renderForm();
    });
    pickerWrap.appendChild(browseBtn);

    wrap.appendChild(pickerWrap);
    return wrap;
  }

  function fieldLabel(text) {
    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = text;
    return labelEl;
  }

  function fileNameText(filePath) {
    const fileNameEl = document.createElement('p');
    fileNameEl.className = 'shorts-overlay-filename';
    fileNameEl.textContent = filePath.split(/[\\/]/).pop();
    return fileNameEl;
  }
}
