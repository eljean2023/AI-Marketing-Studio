import { renderBackgroundPicker } from '../components/spot-background-picker/spot-background-picker.js';
import { renderSpotPreview } from '../components/spot-preview/spot-preview.js';

export function startSpotFlow(container, { onExit }) {
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

  const form = {
    background: null, // { filePath, fileType, previewDataUrl }
    mainMessage: '',
    supportingText: '',
    cta: '',
    backgroundMusic: null, // file path string, or null
  };

  let previewPath = null;
  let generateBtnEl = null;
  let isGenerating = false;
  let generateError = null;
  let exportError = null;
  let exportedPath = null;

  renderLoading();

  async function renderLoading() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Spot Creator';
    appEl.appendChild(heading);

    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading…';
    appEl.appendChild(loadingText);

    const loaded = await window.brandAPI.get();
    brandKit = loaded.brandKit;
    form.cta = brandKit.defaultCta || '';

    renderForm();
  }

  // Editing anything after a preview exists invalidates it -- same
  // correctness rule Shorts applies to its segments, so the export can
  // never drift out of sync with what's currently shown in the form.
  function invalidatePreview() {
    previewPath = null;
    exportedPath = null;
  }

  function canGenerate() {
    return Boolean(form.background) && form.mainMessage.trim().length > 0;
  }

  function refreshGenerateButton() {
    if (generateBtnEl) generateBtnEl.disabled = !canGenerate();
  }

  function renderForm() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Spot Creator';
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = 'Turn a background photo or video into a quick promotional spot with your message, supporting text, and CTA.';
    appEl.appendChild(description);

    const wrap = document.createElement('div');
    wrap.className = 'shorts-form';

    wrap.appendChild(buildInputSection());

    if (previewPath) {
      wrap.appendChild(buildPreviewSection());
    }

    appEl.appendChild(wrap);
  }

  // --- Input section ---

  function buildInputSection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Create Your Spot'));

    const bgWrap = document.createElement('div');
    bgWrap.className = 'shorts-select-field';
    renderBackgroundPicker(bgWrap, {
      current: form.background,
      onPick: handlePickBackground,
    });
    panel.appendChild(bgWrap);

    panel.appendChild(buildBackgroundMusicField());

    panel.appendChild(buildTextareaField({
      label: 'Main Message',
      value: form.mainMessage,
      placeholder: 'Big Weekend Sale!',
      onChange: (value) => {
        form.mainMessage = value;
        invalidatePreview();
        refreshGenerateButton();
      },
    }));

    panel.appendChild(buildTextareaField({
      label: 'Supporting Text',
      value: form.supportingText,
      placeholder: 'Optional -- extra detail like dates or offer terms',
      onChange: (value) => {
        form.supportingText = value;
        invalidatePreview();
      },
    }));

    panel.appendChild(buildTextField({
      label: 'CTA',
      value: form.cta,
      placeholder: 'e.g. Book Now, Order Today, Call Us',
      onChange: (value) => {
        form.cta = value;
        invalidatePreview();
      },
    }));

    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.className = 'btn btn-primary';
    generateBtn.textContent = isGenerating ? 'Generating…' : 'Generate Preview';
    generateBtn.disabled = isGenerating || !canGenerate();
    generateBtn.addEventListener('click', handleGeneratePreview);
    generateBtnEl = generateBtn;
    panel.appendChild(generateBtn);

    if (generateError) {
      const errorEl = document.createElement('p');
      errorEl.textContent = generateError;
      panel.appendChild(errorEl);
    }

    return panel;
  }

  function buildBackgroundMusicField() {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = 'Background Music (optional)';
    wrap.appendChild(labelEl);

    const pickerWrap = document.createElement('div');
    pickerWrap.className = 'shorts-custom-overlay';

    if (form.backgroundMusic) {
      const fileNameEl = document.createElement('p');
      fileNameEl.className = 'shorts-overlay-filename';
      fileNameEl.textContent = form.backgroundMusic.split(/[\\/]/).pop();
      pickerWrap.appendChild(fileNameEl);
    }

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'shorts-global-row';

    const chooseBtn = document.createElement('button');
    chooseBtn.type = 'button';
    chooseBtn.className = 'btn btn-secondary';
    chooseBtn.textContent = form.backgroundMusic ? 'Change Audio' : 'Choose Audio';
    chooseBtn.addEventListener('click', handlePickAudio);
    buttonsRow.appendChild(chooseBtn);

    if (form.backgroundMusic) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-secondary';
      removeBtn.textContent = 'Remove Audio';
      removeBtn.addEventListener('click', () => {
        form.backgroundMusic = null;
        invalidatePreview();
        renderForm();
      });
      buttonsRow.appendChild(removeBtn);
    }

    pickerWrap.appendChild(buttonsRow);
    wrap.appendChild(pickerWrap);
    return wrap;
  }

  async function handlePickAudio() {
    const result = await window.spotsAPI.pickAudio();
    if (result.canceled) return;

    form.backgroundMusic = result.filePath;
    invalidatePreview();
    renderForm();
  }

  async function handlePickBackground() {
    const result = await window.spotsAPI.pickBackground();
    if (result.canceled) return;

    let previewDataUrl = null;
    if (result.fileType === 'image') {
      previewDataUrl = await window.spotsAPI.readImageAsDataUrl(result.filePath);
    }

    form.background = { filePath: result.filePath, fileType: result.fileType, previewDataUrl };
    invalidatePreview();
    renderForm();
  }

  async function handleGeneratePreview() {
    isGenerating = true;
    generateError = null;
    renderForm();

    try {
      const result = await window.spotsAPI.generatePreview({
        backgroundPath: form.background.filePath,
        backgroundType: form.background.fileType,
        mainMessage: form.mainMessage.trim(),
        supportingText: form.supportingText.trim(),
        cta: form.cta.trim(),
        logoPath: brandKit.logo.filePath,
        primaryColor: brandKit.colors.primary,
        musicPath: form.backgroundMusic,
      });
      previewPath = result.outputPath;
    } catch (error) {
      generateError = error.message;
    }

    isGenerating = false;
    renderForm();
  }

  // --- Preview section ---

  function buildPreviewSection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Preview'));

    const previewWrap = document.createElement('div');
    panel.appendChild(previewWrap);
    renderSpotPreview(previewWrap, { videoSrc: previewPath });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn btn-primary';
    exportBtn.textContent = 'Export MP4';
    exportBtn.addEventListener('click', handleExport);
    panel.appendChild(exportBtn);

    if (exportedPath) {
      const successEl = document.createElement('p');
      successEl.textContent = `Exported to ${exportedPath}`;
      panel.appendChild(successEl);
    }

    if (exportError) {
      const errorEl = document.createElement('p');
      errorEl.textContent = exportError;
      panel.appendChild(errorEl);
    }

    return panel;
  }

  async function handleExport() {
    exportError = null;

    try {
      const result = await window.spotsAPI.export({ tempPath: previewPath });
      if (!result.canceled) {
        exportedPath = result.outputPath;
      }
    } catch (error) {
      exportError = error.message;
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

  function buildTextField({ label, value, placeholder, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'shorts-select';
    input.placeholder = placeholder || '';
    input.value = value || '';
    input.addEventListener('input', () => onChange(input.value));
    wrap.appendChild(input);

    return wrap;
  }

  function buildTextareaField({ label, value, placeholder, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const textarea = document.createElement('textarea');
    textarea.className = 'shorts-script-input';
    textarea.placeholder = placeholder || '';
    textarea.value = value || '';
    textarea.rows = 3;
    textarea.addEventListener('input', () => onChange(textarea.value));
    wrap.appendChild(textarea);

    return wrap;
  }
}
