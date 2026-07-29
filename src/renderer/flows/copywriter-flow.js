import { generateCopy } from '../../copywriter/generate.js';

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'exciting', label: 'Exciting' },
];

export function startCopywriterFlow(container, { onExit }) {
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

  const form = {
    businessName: '',
    topic: '',
    tone: 'professional',
    cta: '',
  };
  let result = null;
  let generateBtnEl = null;

  renderLoading();

  async function renderLoading() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'AI Copywriter';
    appEl.appendChild(heading);

    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading…';
    appEl.appendChild(loadingText);

    const { brandKit } = await window.brandAPI.get();
    form.businessName = brandKit.businessName || '';
    form.cta = brandKit.defaultCta || '';

    renderForm();
  }

  function renderForm() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'AI Copywriter';
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = 'Generate hooks, titles, descriptions, CTAs, hashtags, and a short video script from a topic -- pulling your business name and default CTA from Brand Kit.';
    appEl.appendChild(description);

    const wrap = document.createElement('div');
    wrap.className = 'shorts-form';

    wrap.appendChild(buildInputSection());

    if (result) {
      wrap.appendChild(buildListResultSection('Hooks', result.hooks));
      wrap.appendChild(buildListResultSection('Titles', result.titles));
      wrap.appendChild(buildListResultSection('Descriptions', result.descriptions));
      wrap.appendChild(buildListResultSection('Call-To-Action', result.ctas));
      wrap.appendChild(buildHashtagsSection(result.hashtags));
      wrap.appendChild(buildVideoScriptSection(result.videoScript));
    }

    appEl.appendChild(wrap);
  }

  // --- Input section ---

  function buildInputSection() {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('What are we writing about?'));

    panel.appendChild(buildTextField({
      label: 'Business Name',
      value: form.businessName,
      placeholder: 'Acme Studio',
      onChange: (value) => { form.businessName = value; },
    }));

    panel.appendChild(buildTextField({
      label: 'Topic -- what are you promoting?',
      value: form.topic,
      placeholder: 'Weekend brunch specials',
      onChange: (value) => {
        form.topic = value;
        refreshGenerateButton();
      },
    }));

    panel.appendChild(buildSelectField({
      label: 'Tone',
      options: TONES,
      value: form.tone,
      onChange: (value) => { form.tone = value; },
    }));

    panel.appendChild(buildTextField({
      label: 'Default CTA',
      value: form.cta,
      placeholder: 'e.g. Book Now, Order Today, Call Us',
      onChange: (value) => { form.cta = value; },
    }));

    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.className = 'btn btn-primary';
    generateBtn.textContent = 'Generate Copy';
    generateBtn.disabled = form.topic.trim().length === 0;
    generateBtn.addEventListener('click', handleGenerate);
    generateBtnEl = generateBtn;
    panel.appendChild(generateBtn);

    return panel;
  }

  // Cheap way to keep Generate's disabled state in sync while typing,
  // without a full re-render (which would steal focus out of the input).
  function refreshGenerateButton() {
    if (generateBtnEl) generateBtnEl.disabled = form.topic.trim().length === 0;
  }

  function handleGenerate() {
    result = generateCopy({
      businessName: form.businessName,
      topic: form.topic,
      tone: form.tone,
      cta: form.cta,
    });
    renderForm();
  }

  // --- Results sections ---

  function buildListResultSection(title, items) {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading(title));

    const list = document.createElement('div');
    list.className = 'copywriter-result-list';
    items.forEach((text) => list.appendChild(buildResultItem(text)));
    panel.appendChild(list);

    return panel;
  }

  function buildHashtagsSection(hashtags) {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Hashtags'));

    const list = document.createElement('div');
    list.className = 'copywriter-result-list';
    list.appendChild(buildResultItem(hashtags.join(' ')));
    panel.appendChild(list);

    return panel;
  }

  function buildVideoScriptSection(script) {
    const panel = document.createElement('div');
    panel.className = 'shorts-global-panel';
    panel.appendChild(sectionHeading('Video Script'));

    const pre = document.createElement('pre');
    pre.className = 'copywriter-video-script';
    pre.textContent = script;
    panel.appendChild(pre);

    panel.appendChild(buildCopyButton(script));

    return panel;
  }

  function buildResultItem(text) {
    const row = document.createElement('div');
    row.className = 'copywriter-result-item';

    const textEl = document.createElement('p');
    textEl.className = 'copywriter-result-text';
    textEl.textContent = text;
    row.appendChild(textEl);

    row.appendChild(buildCopyButton(text));

    return row;
  }

  function buildCopyButton(text) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
    return btn;
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
}
