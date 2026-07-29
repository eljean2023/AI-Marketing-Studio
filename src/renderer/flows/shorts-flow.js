const ICON_STROKE = 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const EYE_ICON = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const MINUS_ICON = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 24 24" ${ICON_STROKE}><line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></svg>`;

export function startShortsFlow(container, { onExit }) {
  container.innerHTML = '';

  const homeLink = document.createElement('button');
  homeLink.type = 'button';
  homeLink.className = 'home-link';
  homeLink.textContent = '← Home';
  homeLink.addEventListener('click', () => {
    closeSegmentPreviewModal();
    onExit();
  });
  container.appendChild(homeLink);

  const appEl = document.createElement('div');
  appEl.className = 'flow-content';
  container.appendChild(appEl);

  const DEFAULT_MUSIC_VOLUME = 60;

  let options = null;
  let globalVoiceId = null;
  let globalMusicTrackId = null;
  let globalMusicVolume = DEFAULT_MUSIC_VOLUME;
  let segments = [];
  let nextSegmentId = 1;
  let finalPreviewPath = null;

  // Preview Modal state -- the modal element itself lives as a sibling of
  // appEl (see openSegmentPreviewModal), not inside it, since renderEdit()
  // wipes appEl's contents on many unrelated interactions.
  let modalBackdropEl = null;
  let modalBodyEl = null;
  let modalSegment = null;

  renderLoadingOptions();

  async function renderLoadingOptions() {
    appEl.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Shorts Creator';
    appEl.appendChild(heading);

    options = await window.shortsAPI.getOptions();
    globalVoiceId = options.voices[0].id;
    globalMusicTrackId = options.musicTracks[0].id;
    segments = [createSegment()];

    renderEdit();
  }

  function createSegment() {
    return {
      id: nextSegmentId++,
      scriptText: '',
      useCustomVoice: false,
      voiceId: options.voices[0].id,
      useCustomMusic: false,
      musicTrackId: options.musicTracks[0].id,
      overlayMode: 'builtin',
      overlayId: options.overlays[0].id,
      customOverlay: null,
      previewStatus: 'idle', // 'idle' | 'generating' | 'ready' | 'error'
      previewPath: null,
      previewError: null,
      approved: false,
      optionsExpanded: false,
    };
  }

  function invalidateSegment(segment) {
    segment.previewStatus = 'idle';
    segment.previewPath = null;
    segment.previewError = null;
    segment.approved = false;
  }

  function effectiveVoiceId(segment) {
    return segment.useCustomVoice ? segment.voiceId : globalVoiceId;
  }

  function effectiveMusicTrackId(segment) {
    return segment.useCustomMusic ? segment.musicTrackId : globalMusicTrackId;
  }

  // --- The single render path. Both manual Preview and the Generate Final
  // Video auto-render step call this and only this -- there is no second
  // way to turn a segment's script into a rendered clip.
  async function renderSegmentClip(segment) {
    segment.previewStatus = 'generating';
    segment.previewPath = null;
    segment.previewError = null;
    segment.approved = false;

    try {
      const result = await window.shortsAPI.generate({
        scriptText: segment.scriptText.trim(),
        voiceId: effectiveVoiceId(segment),
        musicTrackId: effectiveMusicTrackId(segment),
        musicVolume: globalMusicVolume,
        overlayId: segment.overlayMode === 'builtin' ? segment.overlayId : null,
        customOverlay: segment.overlayMode === 'custom' ? segment.customOverlay : null,
      });
      segment.previewStatus = 'ready';
      segment.previewPath = result.outputPath;
      return true;
    } catch (error) {
      segment.previewStatus = 'error';
      segment.previewError = error.message;
      return false;
    }
  }

  // Shared by the segment card's "Browse…/Change Overlay" button and the
  // Preview Modal's "Choose another overlay" button -- the exact same
  // window.shortsAPI.pickOverlay() call and result handling either way.
  async function pickAndAssignOverlay(segment, { switchToCustomMode }) {
    const result = await window.shortsAPI.pickOverlay();
    if (result.canceled) return false;
    segment.customOverlay = { filePath: result.filePath, fileType: result.fileType };
    if (switchToCustomMode) segment.overlayMode = 'custom';
    invalidateSegment(segment);
    return true;
  }

  // --- Edit screen: global defaults + the segment list ---

  function renderEdit() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Shorts Creator';
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = "Build your video from segments. Write each segment's script, optionally preview it, then generate the final video whenever you're ready.";
    appEl.appendChild(description);

    const form = document.createElement('div');
    form.className = 'shorts-form';

    const globalPanel = document.createElement('div');
    globalPanel.className = 'shorts-global-panel';

    const globalHeading = document.createElement('p');
    globalHeading.className = 'shorts-section-heading';
    globalHeading.textContent = 'Project Defaults';
    globalPanel.appendChild(globalHeading);

    const globalRow = document.createElement('div');
    globalRow.className = 'shorts-global-row';

    globalRow.appendChild(buildSelectField({
      label: 'Voice',
      options: options.voices,
      value: globalVoiceId,
      onChange: (value) => {
        globalVoiceId = value;
        segments.forEach((segment) => { if (!segment.useCustomVoice) invalidateSegment(segment); });
        renderEdit();
      },
    }));

    globalRow.appendChild(buildSelectField({
      label: 'Music',
      options: options.musicTracks,
      value: globalMusicTrackId,
      onChange: (value) => {
        globalMusicTrackId = value;
        segments.forEach((segment) => { if (!segment.useCustomMusic) invalidateSegment(segment); });
        renderEdit();
      },
    }));

    globalPanel.appendChild(globalRow);

    globalPanel.appendChild(buildVolumeSlider({
      label: 'Music Volume',
      value: globalMusicVolume,
      onChange: (value) => {
        globalMusicVolume = value;
        segments.forEach(invalidateSegment);
      },
    }));

    form.appendChild(globalPanel);

    const segmentsHeading = document.createElement('p');
    segmentsHeading.className = 'shorts-section-heading';
    segmentsHeading.textContent = 'Segments';
    form.appendChild(segmentsHeading);

    const segmentsList = document.createElement('div');
    segmentsList.className = 'shorts-segments-list';
    segments.forEach((segment, index) => {
      segmentsList.appendChild(buildSegmentCard(segment, index));
    });
    form.appendChild(segmentsList);

    const generateFinalBtn = document.createElement('button');
    generateFinalBtn.type = 'button';
    generateFinalBtn.className = 'btn btn-primary';
    generateFinalBtn.textContent = 'Generate Final Video';
    generateFinalBtn.disabled = !segments.every((segment) => segment.scriptText.trim().length > 0);
    generateFinalBtn.addEventListener('click', handleGenerateFinal);
    form.appendChild(generateFinalBtn);

    appEl.appendChild(form);
  }

  // --- One segment card ---

  function buildSegmentCard(segment, index) {
    const card = document.createElement('div');
    card.className = 'shorts-segment-card';

    const header = document.createElement('div');
    header.className = 'shorts-segment-header';

    const title = document.createElement('p');
    title.className = 'shorts-segment-title';
    title.textContent = `Segment ${index + 1}`;
    header.appendChild(title);

    const headerRight = document.createElement('div');
    headerRight.className = 'shorts-segment-header-right';

    const statusBadge = document.createElement('span');
    statusBadge.className = `shorts-segment-status shorts-segment-status-${segment.previewStatus === 'ready' && segment.approved ? 'approved' : segment.previewStatus}`;
    statusBadge.textContent = segmentStatusLabel(segment);
    headerRight.appendChild(statusBadge);

    const controls = document.createElement('div');
    controls.className = 'shorts-segment-controls';

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'shorts-icon-btn';
    previewBtn.innerHTML = EYE_ICON;
    previewBtn.title = 'Preview this segment';
    previewBtn.disabled = segment.scriptText.trim().length === 0 || segment.previewStatus === 'generating';
    previewBtn.addEventListener('click', () => handlePreviewSegment(segment));
    controls.appendChild(previewBtn);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'shorts-icon-btn';
    addBtn.innerHTML = PLUS_ICON;
    addBtn.title = 'Add another segment below';
    addBtn.addEventListener('click', () => {
      segments.splice(index + 1, 0, createSegment());
      renderEdit();
    });
    controls.appendChild(addBtn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'shorts-icon-btn';
    removeBtn.innerHTML = MINUS_ICON;
    removeBtn.title = 'Remove this segment';
    removeBtn.disabled = segments.length === 1;
    removeBtn.addEventListener('click', () => {
      segments.splice(index, 1);
      renderEdit();
    });
    controls.appendChild(removeBtn);

    headerRight.appendChild(controls);
    header.appendChild(headerRight);
    card.appendChild(header);

    const scriptLabel = document.createElement('label');
    scriptLabel.className = 'shorts-field-label';
    scriptLabel.textContent = 'Script';
    card.appendChild(scriptLabel);

    const scriptInput = document.createElement('textarea');
    scriptInput.className = 'shorts-script-input';
    scriptInput.placeholder = 'Introducing our new dashboard...';
    scriptInput.value = segment.scriptText;
    scriptInput.rows = 4;
    scriptInput.addEventListener('input', () => {
      segment.scriptText = scriptInput.value;
      invalidateSegment(segment);
      statusBadge.className = `shorts-segment-status shorts-segment-status-${segment.previewStatus}`;
      statusBadge.textContent = segmentStatusLabel(segment);
      previewBtn.disabled = segment.scriptText.trim().length === 0;
      generateFinalRefreshHook();
    });
    card.appendChild(scriptInput);

    card.appendChild(buildSegmentOptions(segment));

    if (segment.previewStatus === 'error') {
      const errorEl = document.createElement('p');
      errorEl.textContent = segment.previewError;
      card.appendChild(errorEl);
    }

    return card;
  }

  function segmentStatusLabel(segment) {
    if (segment.previewStatus === 'generating') return 'Generating…';
    if (segment.previewStatus === 'error') return 'Preview failed';
    if (segment.previewStatus === 'ready' && segment.approved) return '✓ Approved';
    if (segment.previewStatus === 'ready') return 'Preview ready';
    return 'Not previewed';
  }

  // Voice/Music overrides and the Overlay picker live in a collapsed-by-
  // default disclosure so a default segment stays compact -- it only opens
  // automatically when an override is already active.
  function buildSegmentOptions(segment) {
    const details = document.createElement('details');
    details.className = 'shorts-segment-options';
    details.open = segment.optionsExpanded
      || segment.useCustomVoice
      || segment.useCustomMusic
      || segment.overlayMode === 'custom';
    details.addEventListener('toggle', () => {
      segment.optionsExpanded = details.open;
    });

    const summary = document.createElement('summary');
    summary.textContent = 'Options';
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'shorts-segment-options-body';
    body.appendChild(buildVoiceOverrideField(segment));
    body.appendChild(buildMusicOverrideField(segment));
    body.appendChild(buildSegmentOverlayField(segment));
    details.appendChild(body);

    return details;
  }

  function buildVoiceOverrideField(segment) {
    const wrap = document.createElement('div');

    const checkboxRow = document.createElement('label');
    checkboxRow.className = 'checkbox-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = segment.useCustomVoice;
    checkbox.addEventListener('change', () => {
      segment.useCustomVoice = checkbox.checked;
      invalidateSegment(segment);
      renderEdit();
    });
    checkboxRow.appendChild(checkbox);
    checkboxRow.appendChild(document.createTextNode('Use a different voice for this segment'));
    wrap.appendChild(checkboxRow);

    if (segment.useCustomVoice) {
      wrap.appendChild(buildSelectField({
        label: 'Segment Voice',
        options: options.voices,
        value: segment.voiceId,
        onChange: (value) => {
          segment.voiceId = value;
          invalidateSegment(segment);
        },
      }));
    }

    return wrap;
  }

  function buildMusicOverrideField(segment) {
    const wrap = document.createElement('div');

    const checkboxRow = document.createElement('label');
    checkboxRow.className = 'checkbox-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = segment.useCustomMusic;
    checkbox.addEventListener('change', () => {
      segment.useCustomMusic = checkbox.checked;
      invalidateSegment(segment);
      renderEdit();
    });
    checkboxRow.appendChild(checkbox);
    checkboxRow.appendChild(document.createTextNode('Use different music for this segment'));
    wrap.appendChild(checkboxRow);

    if (segment.useCustomMusic) {
      wrap.appendChild(buildSelectField({
        label: 'Segment Music',
        options: options.musicTracks,
        value: segment.musicTrackId,
        onChange: (value) => {
          segment.musicTrackId = value;
          invalidateSegment(segment);
        },
      }));
    }

    return wrap;
  }

  // --- Per-segment overlay picker (Built-in Library / Choose from my PC) ---

  function buildSegmentOverlayField(segment) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = 'Overlay';
    wrap.appendChild(labelEl);

    const radioGroup = document.createElement('div');
    radioGroup.className = 'shorts-radio-group';
    radioGroup.appendChild(buildOverlayModeRadio(segment, 'Built-in Library', 'builtin'));
    radioGroup.appendChild(buildOverlayModeRadio(segment, 'Choose from my PC', 'custom'));
    wrap.appendChild(radioGroup);

    if (segment.overlayMode === 'builtin') {
      const select = document.createElement('select');
      select.className = 'shorts-select';
      options.overlays.forEach((choice) => {
        const opt = document.createElement('option');
        opt.value = choice.id;
        opt.textContent = choice.label;
        opt.selected = choice.id === segment.overlayId;
        select.appendChild(opt);
      });
      select.addEventListener('change', () => {
        segment.overlayId = select.value;
        invalidateSegment(segment);
      });
      wrap.appendChild(select);
    } else {
      wrap.appendChild(buildCustomOverlayPicker(segment));
    }

    return wrap;
  }

  function buildOverlayModeRadio(segment, labelText, mode) {
    const label = document.createElement('label');
    label.className = 'radio-row';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `shorts-overlay-mode-${segment.id}`;
    input.value = mode;
    input.checked = segment.overlayMode === mode;
    input.addEventListener('change', () => {
      segment.overlayMode = mode;
      invalidateSegment(segment);
      renderEdit();
    });

    label.appendChild(input);
    label.appendChild(document.createTextNode(labelText));
    return label;
  }

  function buildCustomOverlayPicker(segment) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-custom-overlay';

    if (segment.customOverlay) {
      const preview = document.createElement(segment.customOverlay.fileType === 'image' ? 'img' : 'video');
      preview.className = 'shorts-overlay-preview';
      preview.src = `file://${segment.customOverlay.filePath}`;
      if (segment.customOverlay.fileType === 'video') {
        preview.controls = true;
        preview.muted = true;
      }
      wrap.appendChild(preview);

      const fileNameEl = document.createElement('p');
      fileNameEl.className = 'shorts-overlay-filename';
      fileNameEl.textContent = segment.customOverlay.filePath.split(/[\\/]/).pop();
      wrap.appendChild(fileNameEl);
    }

    const browseBtn = document.createElement('button');
    browseBtn.type = 'button';
    browseBtn.className = 'btn btn-secondary';
    browseBtn.textContent = segment.customOverlay ? 'Change Overlay' : 'Browse…';
    browseBtn.addEventListener('click', async () => {
      const picked = await pickAndAssignOverlay(segment, { switchToCustomMode: false });
      if (picked) renderEdit();
    });
    wrap.appendChild(browseBtn);

    return wrap;
  }

  // --- Shared field builders ---

  function buildSelectField({ label, options: choices, value, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const select = document.createElement('select');
    select.className = 'shorts-select';
    choices.forEach((choice) => {
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

  function buildVolumeSlider({ label, value, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-select-field slider-row';

    const labelEl = document.createElement('label');
    labelEl.className = 'shorts-field-label';
    labelEl.textContent = `${label}: ${value}%`;
    wrap.appendChild(labelEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(value);
    slider.addEventListener('input', (event) => {
      const percent = Number(event.target.value);
      labelEl.textContent = `${label}: ${percent}%`;
      onChange(percent);
    });
    wrap.appendChild(slider);

    return wrap;
  }

  // Cheap way to keep the bottom Generate Final Video button's disabled
  // state in sync while typing, without a full re-render (which would
  // steal focus out of the textarea mid-sentence).
  function generateFinalRefreshHook() {
    const btn = Array.from(appEl.querySelectorAll('button')).find((b) => b.textContent === 'Generate Final Video');
    if (btn) btn.disabled = !segments.every((segment) => segment.scriptText.trim().length > 0);
  }

  // --- Shared phone-frame video display, used by the Preview Modal and the
  // final-video preview screen. ---

  function buildPhoneFrame(videoSrc, extraClass) {
    const phoneFrame = document.createElement('div');
    phoneFrame.className = extraClass ? `phone-frame ${extraClass}` : 'phone-frame';

    const phoneNotch = document.createElement('div');
    phoneNotch.className = 'phone-notch';
    phoneFrame.appendChild(phoneNotch);

    const phoneScreen = document.createElement('div');
    phoneScreen.className = 'phone-screen';

    const video = document.createElement('video');
    video.src = `file://${videoSrc}`;
    video.controls = true;
    phoneScreen.appendChild(video);
    phoneFrame.appendChild(phoneScreen);

    const phoneHomeIndicator = document.createElement('div');
    phoneHomeIndicator.className = 'phone-home-indicator';
    phoneFrame.appendChild(phoneHomeIndicator);

    return phoneFrame;
  }

  // --- Preview Modal ---
  //
  // Opened by clicking a segment's Preview (eye) icon. Shows a
  // generating/ready/error state driven entirely by segment.previewStatus,
  // with Accept / Cancel / Choose another overlay together once ready --
  // all three reuse existing functions (renderSegmentClip, invalidateSegment,
  // pickAndAssignOverlay), nothing new is rendered here.
  //
  // Deliberately appended as a sibling of appEl (not inside it): renderEdit()
  // calls appEl.innerHTML = '' from several unrelated interactions (voice/
  // music checkboxes, overlay radios), which would destroy an open modal if
  // it lived inside appEl.

  function handlePreviewSegment(segment) {
    const pending = renderSegmentClip(segment); // synchronously flips previewStatus to 'generating'
    openSegmentPreviewModal(segment);
    renderEdit();

    pending.then(() => {
      renderEdit();
      if (modalSegment === segment) renderModalBody();
    });
  }

  function openSegmentPreviewModal(segment) {
    closeSegmentPreviewModal();
    modalSegment = segment;

    modalBackdropEl = document.createElement('div');
    modalBackdropEl.className = 'shorts-modal-backdrop';
    modalBackdropEl.addEventListener('click', (event) => {
      if (event.target === modalBackdropEl) closeSegmentPreviewModal();
    });

    const modal = document.createElement('div');
    modal.className = 'shorts-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'shorts-modal-close';
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => closeSegmentPreviewModal());
    modal.appendChild(closeBtn);

    const title = document.createElement('p');
    title.className = 'shorts-modal-title';
    title.textContent = `Segment ${segments.indexOf(segment) + 1} Preview`;
    modal.appendChild(title);

    modalBodyEl = document.createElement('div');
    modalBodyEl.className = 'shorts-modal-body';
    modal.appendChild(modalBodyEl);

    modalBackdropEl.appendChild(modal);
    container.appendChild(modalBackdropEl);

    document.addEventListener('keydown', onModalKeydown);

    renderModalBody();
  }

  function closeSegmentPreviewModal() {
    if (!modalBackdropEl) return;
    document.removeEventListener('keydown', onModalKeydown);
    modalBackdropEl.remove();
    modalBackdropEl = null;
    modalBodyEl = null;
    modalSegment = null;
  }

  function onModalKeydown(event) {
    if (event.key === 'Escape') closeSegmentPreviewModal();
  }

  function renderModalBody() {
    if (!modalBodyEl || !modalSegment) return;
    modalBodyEl.innerHTML = '';

    if (modalSegment.previewStatus === 'ready') {
      modalBodyEl.appendChild(buildModalReadyView(modalSegment));
    } else if (modalSegment.previewStatus === 'error') {
      modalBodyEl.appendChild(buildModalErrorView(modalSegment));
    } else {
      modalBodyEl.appendChild(buildModalGeneratingView());
    }
  }

  function buildModalGeneratingView() {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-modal-generating';

    const spinner = document.createElement('div');
    spinner.className = 'shorts-modal-spinner';
    wrap.appendChild(spinner);

    const text = document.createElement('p');
    text.textContent = 'Generating preview…';
    wrap.appendChild(text);

    return wrap;
  }

  function buildModalErrorView(segment) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-modal-error';

    const text = document.createElement('p');
    text.textContent = segment.previewError;
    wrap.appendChild(text);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => closeSegmentPreviewModal());
    wrap.appendChild(closeBtn);

    return wrap;
  }

  function buildModalReadyView(segment) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-modal-preview';

    wrap.appendChild(buildPhoneFrame(segment.previewPath, 'phone-frame-small'));

    const actions = document.createElement('div');
    actions.className = 'shorts-modal-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'btn btn-primary';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', () => {
      segment.approved = true;
      closeSegmentPreviewModal();
      renderEdit();
    });
    actions.appendChild(acceptBtn);

    const overlayBtn = document.createElement('button');
    overlayBtn.type = 'button';
    overlayBtn.className = 'btn btn-secondary';
    overlayBtn.textContent = 'Choose another overlay';
    overlayBtn.addEventListener('click', async () => {
      const picked = await pickAndAssignOverlay(segment, { switchToCustomMode: true });
      if (picked) {
        closeSegmentPreviewModal();
        renderEdit();
      }
    });
    actions.appendChild(overlayBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      invalidateSegment(segment);
      closeSegmentPreviewModal();
      renderEdit();
    });
    actions.appendChild(cancelBtn);

    wrap.appendChild(actions);

    return wrap;
  }

  // --- Final assembly ---
  //
  // Preview is optional: any segment that hasn't been previewed (or was
  // invalidated by an edit since) gets auto-rendered here, sequentially,
  // via the exact same renderSegmentClip used by manual Preview -- there is
  // no separate rendering path for this. Segments that already have a
  // previewPath (previewed, accepted, or auto-rendered earlier and not
  // since edited) are left untouched.

  async function handleGenerateFinal() {
    const pending = segments.filter((segment) => segment.previewPath == null);

    if (pending.length > 0) {
      const allOk = await autoRenderPendingSegments(pending);
      if (!allOk) return;
    }

    renderGeneratingFinal();

    try {
      const result = await window.shortsAPI.generateFinal({
        segmentPaths: segments.map((segment) => segment.previewPath),
      });

      finalPreviewPath = result.outputPath;
      renderFinalPreview();
    } catch (error) {
      renderGenerateFinalError(error.message);
    }
  }

  async function autoRenderPendingSegments(pending) {
    for (let i = 0; i < pending.length; i += 1) {
      renderAutoRenderProgress(i + 1, pending.length);
      // eslint-disable-next-line no-await-in-loop -- segments must render in order, not concurrently
      const ok = await renderSegmentClip(pending[i]);
      if (!ok) {
        renderAutoRenderError(pending[i], i + 1, pending.length);
        return false;
      }
    }
    return true;
  }

  function renderAutoRenderProgress(current, total) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = `Generating segment ${current} of ${total}…`;
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = 'Rendering the segments that haven\'t been previewed yet.';
    appEl.appendChild(description);

    const progressWrap = document.createElement('div');
    progressWrap.className = 'export-progress';

    const track = document.createElement('div');
    track.className = 'export-progress-track';

    const fill = document.createElement('div');
    fill.className = 'export-progress-fill';
    fill.style.width = `${((current - 1) / total) * 100}%`;
    track.appendChild(fill);
    progressWrap.appendChild(track);

    const infoRow = document.createElement('div');
    infoRow.className = 'export-progress-info';

    const phaseEl = document.createElement('span');
    phaseEl.textContent = `Segment ${current} of ${total}`;
    infoRow.appendChild(phaseEl);

    const percentEl = document.createElement('span');
    percentEl.textContent = `${Math.round(((current - 1) / total) * 100)}%`;
    infoRow.appendChild(percentEl);

    progressWrap.appendChild(infoRow);
    appEl.appendChild(progressWrap);
  }

  function renderAutoRenderError(segment, index, total) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = `Could not generate segment ${index} of ${total}`;
    appEl.appendChild(heading);

    const messageEl = document.createElement('p');
    messageEl.textContent = segment.previewError;
    appEl.appendChild(messageEl);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back to Edit';
    backBtn.addEventListener('click', renderEdit);
    appEl.appendChild(backBtn);
  }

  function renderGeneratingFinal() {
    appEl.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Combining segments…';
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = 'Joining your segments into one final video.';
    appEl.appendChild(description);
  }

  function renderGenerateFinalError(message) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Could not generate the final video';
    appEl.appendChild(heading);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    appEl.appendChild(messageEl);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', renderEdit);
    appEl.appendChild(backBtn);
  }

  function renderFinalPreview() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Preview';
    appEl.appendChild(heading);

    appEl.appendChild(buildPhoneFrame(finalPreviewPath));

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn btn-primary';
    exportBtn.textContent = 'Export MP4';
    exportBtn.addEventListener('click', handleExport);
    appEl.appendChild(exportBtn);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back to Edit';
    backBtn.addEventListener('click', renderEdit);
    appEl.appendChild(backBtn);
  }

  async function handleExport() {
    try {
      const result = await window.shortsAPI.exportShort({ tempPath: finalPreviewPath });

      if (result.canceled) {
        renderFinalPreview();
        return;
      }

      renderExportSuccess(result.outputPath);
    } catch (error) {
      renderExportError(error.message);
    }
  }

  function renderExportSuccess(outputPath) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Video exported successfully.';
    appEl.appendChild(heading);

    const pathEl = document.createElement('p');
    pathEl.textContent = outputPath;
    appEl.appendChild(pathEl);

    const anotherBtn = document.createElement('button');
    anotherBtn.type = 'button';
    anotherBtn.className = 'btn btn-primary';
    anotherBtn.textContent = 'Create Another Video';
    anotherBtn.addEventListener('click', () => {
      segments = [createSegment()];
      finalPreviewPath = null;
      renderEdit();
    });
    appEl.appendChild(anotherBtn);
  }

  function renderExportError(message) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Export failed';
    appEl.appendChild(heading);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    appEl.appendChild(messageEl);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back to Preview';
    backBtn.addEventListener('click', renderFinalPreview);
    appEl.appendChild(backBtn);
  }
}
