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
  // Overlay has no dedicated UI of its own anymore -- it's chosen entirely
  // through the Preview Modal's "Choose another overlay" button (see
  // pickAndAssignOverlay), which still writes here for segment 1 (index 0)
  // and to the segment's own fields for every other segment, exactly as
  // before. These three just hold whatever was last picked.
  let globalOverlayMode = 'builtin';
  let globalOverlayId = null;
  let globalCustomOverlay = null;
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
    globalOverlayId = options.overlays[0].id;
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
      useCustomOverlay: false,
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

  function effectiveOverlayMode(segment) {
    return segment.useCustomOverlay ? segment.overlayMode : globalOverlayMode;
  }

  function effectiveOverlayId(segment) {
    return segment.useCustomOverlay ? segment.overlayId : globalOverlayId;
  }

  function effectiveCustomOverlay(segment) {
    return segment.useCustomOverlay ? segment.customOverlay : globalCustomOverlay;
  }

  // --- The single render path. Both manual Preview and the Generate Final
  // Video auto-render step call this and only this -- there is no second
  // way to turn a segment's script into a rendered clip.
  async function renderSegmentClip(segment) {
    segment.previewStatus = 'generating';
    segment.previewPath = null;
    segment.previewError = null;
    segment.approved = false;

    // Validated up front rather than letting it fail deep in ffmpeg: mode
    // can end up 'custom' with no file selected yet (e.g. from an older
    // session), which previously produced a confusing "Unknown overlay:
    // null" error at generation time instead of a clear, actionable one.
    if (effectiveOverlayMode(segment) === 'custom' && !effectiveCustomOverlay(segment)) {
      segment.previewStatus = 'error';
      segment.previewError = 'No overlay file is selected. Use Preview, then "Choose another overlay" to pick one.';
      return false;
    }

    try {
      const result = await window.shortsAPI.generate({
        scriptText: segment.scriptText.trim(),
        voiceId: effectiveVoiceId(segment),
        musicTrackId: effectiveMusicTrackId(segment),
        musicVolume: globalMusicVolume,
        overlayId: effectiveOverlayMode(segment) === 'builtin' ? effectiveOverlayId(segment) : null,
        customOverlay: effectiveOverlayMode(segment) === 'custom' ? effectiveCustomOverlay(segment) : null,
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

  // Backs the Preview Modal's "Choose another overlay" button -- the only
  // place overlay is ever chosen (see the note on globalOverlayMode above).
  // Segment 1 (index 0) has no override of its own, so picking there
  // updates the global default instead; every other segment gets its own.
  async function pickAndAssignOverlay(segment, { switchToCustomMode }) {
    const result = await window.shortsAPI.pickOverlay();
    if (result.canceled) return false;

    const customOverlay = { filePath: result.filePath, fileType: result.fileType };

    if (segments.indexOf(segment) === 0) {
      globalCustomOverlay = customOverlay;
      if (switchToCustomMode) globalOverlayMode = 'custom';
      segments.forEach((s) => { if (!s.useCustomOverlay) invalidateSegment(s); });
    } else {
      segment.customOverlay = customOverlay;
      if (switchToCustomMode) segment.overlayMode = 'custom';
      segment.useCustomOverlay = true;
      invalidateSegment(segment);
    }

    return true;
  }

  // --- Edit screen: the segment list ---

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
    const hasAcceptedPreview = segment.approved && Boolean(segment.previewPath);

    const card = document.createElement('div');
    card.className = 'shorts-segment-card';

    // A single compact row: title, Voice, Music, status, then the action
    // icons -- no more grouping/splitting into left/right clusters, so it
    // reads as one continuous line (wraps only if the window is too narrow
    // to fit it).
    const header = document.createElement('div');
    header.className = 'shorts-segment-header';

    const title = document.createElement('p');
    title.className = 'shorts-segment-title';
    title.textContent = `Segment ${index + 1}`;
    header.appendChild(title);

    // Voice and Music are the options changed most often, so they get their
    // own always-visible dropdowns right in the header -- each is a direct,
    // per-segment choice (not just this segment's global-following
    // display): picking a value here always pins it to this segment
    // specifically and only invalidates this segment's own preview, never
    // any other segment's.
    header.appendChild(buildHeaderSelect({
      options: options.voices,
      value: effectiveVoiceId(segment),
      ariaLabel: 'Voice',
      onChange: (value) => {
        segment.useCustomVoice = true;
        segment.voiceId = value;
        invalidateSegment(segment);
        renderEdit();
      },
    }));

    header.appendChild(buildHeaderSelect({
      options: options.musicTracks,
      value: effectiveMusicTrackId(segment),
      ariaLabel: 'Music',
      onChange: (value) => {
        segment.useCustomMusic = true;
        segment.musicTrackId = value;
        invalidateSegment(segment);
        renderEdit();
      },
    }));

    const statusBadge = document.createElement('span');
    statusBadge.className = `shorts-segment-status shorts-segment-status-${segment.previewStatus === 'ready' && segment.approved ? 'approved' : segment.previewStatus}`;
    statusBadge.textContent = segmentStatusLabel(segment);
    header.appendChild(statusBadge);

    // Just 3 icons now -- Preview / Insert below / Remove. Overlay is
    // chosen entirely through Preview (see pickAndAssignOverlay); Music
    // Volume moved to above the accepted-preview video (see
    // buildAcceptedPreviewDisplay), the one moment it's actually useful.
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

    header.appendChild(controls);
    card.appendChild(header);

    // Script + accepted Preview live side by side only once this segment
    // has an ACCEPTED preview -- reviewing always happens in the Preview
    // Modal first; only clicking Accept there moves the result beside the
    // script. Both columns are always in the DOM; only a class toggle (see
    // splitRow below) hides the preview column and lets the script column
    // take full width, so the <textarea> node never moves/steals focus
    // while typing.
    const splitRow = document.createElement('div');
    splitRow.className = 'shorts-segment-split';

    const scriptCol = document.createElement('div');
    scriptCol.className = 'shorts-segment-script-col';

    const scriptLabel = document.createElement('label');
    scriptLabel.className = 'shorts-field-label';
    scriptLabel.textContent = 'Script';
    scriptCol.appendChild(scriptLabel);

    const scriptInput = document.createElement('textarea');
    scriptInput.className = 'shorts-script-input';
    scriptInput.placeholder = 'Write your script here...';
    scriptInput.value = segment.scriptText;
    scriptInput.rows = 4;
    scriptInput.addEventListener('input', () => {
      segment.scriptText = scriptInput.value;
      invalidateSegment(segment);
      statusBadge.className = `shorts-segment-status shorts-segment-status-${segment.previewStatus}`;
      statusBadge.textContent = segmentStatusLabel(segment);
      previewBtn.disabled = segment.scriptText.trim().length === 0;
      splitRow.classList.add('shorts-segment-split-collapsed');
      previewCol.innerHTML = '';
      generateFinalRefreshHook();
    });
    scriptCol.appendChild(scriptInput);

    const previewCol = document.createElement('div');
    previewCol.className = 'shorts-segment-preview-col';
    if (hasAcceptedPreview) {
      previewCol.appendChild(buildAcceptedPreviewDisplay(segment));
    } else {
      splitRow.classList.add('shorts-segment-split-collapsed');
    }

    splitRow.appendChild(scriptCol);
    splitRow.appendChild(previewCol);
    card.appendChild(splitRow);

    return card;
  }

  // Read-only display for the split layout's preview column -- shown only
  // once a segment's preview has been Accepted in the modal. No actions
  // here besides Music Volume; Accept/Cancel/Choose another overlay all
  // happen in the modal, during review, before acceptance. Deliberately a
  // plain, compact video (not the full phone-frame chrome used by the
  // modal/final-preview screens) so its height roughly matches the script
  // textarea beside it -- a full-size phone frame would dominate the row.
  //
  // Music Volume lives here, above the video, rather than anywhere else in
  // the UI: this is the one moment it's actually useful -- the user is
  // listening to a real rendered clip and can judge the narration/music
  // balance directly. It's still a single project-wide value (not
  // per-segment), so dragging it invalidates every segment's preview, not
  // just this one -- same as when it lived in Settings, just relocated.
  function buildAcceptedPreviewDisplay(segment) {
    const wrap = document.createElement('div');
    wrap.className = 'shorts-accepted-preview';

    wrap.appendChild(buildVolumeSlider({
      label: 'Music Volume',
      value: globalMusicVolume,
      onChange: (value) => {
        globalMusicVolume = value;
        segments.forEach(invalidateSegment);
      },
    }));

    const video = document.createElement('video');
    video.src = `file://${segment.previewPath}`;
    video.controls = true;
    wrap.appendChild(video);

    return wrap;
  }

  function segmentStatusLabel(segment) {
    if (segment.previewStatus === 'generating') return 'Generating…';
    if (segment.previewStatus === 'error') return 'Preview failed';
    if (segment.previewStatus === 'ready' && segment.approved) return '✓ Approved';
    if (segment.previewStatus === 'ready') return 'Preview ready';
    return 'Not previewed';
  }

  // --- Shared field builders ---

  // Compact, label-less select for the segment header (Voice/Music).
  function buildHeaderSelect({ options: choices, value, onChange, ariaLabel }) {
    const select = document.createElement('select');
    select.className = 'shorts-select shorts-header-select';
    select.setAttribute('aria-label', ariaLabel);
    choices.forEach((choice) => {
      const opt = document.createElement('option');
      opt.value = choice.id;
      opt.textContent = choice.label;
      opt.selected = choice.id === value;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => onChange(select.value));
    return select;
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

  // --- Shared phone-frame video display, used by the accepted-preview
  // column, the Preview Modal, and the final-video preview screen. ---

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
  // pickAndAssignOverlay), nothing new is rendered here. Only once Accept is
  // clicked does the result move into the segment's own column beside the
  // script (see buildSegmentCard's splitRow) -- reviewing always happens
  // here first.
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

  // Picking a new overlay from inside the modal must NOT close it -- the
  // old preview belonged to the previous overlay, so it re-renders in
  // place (generating -> ready/error) and the user keeps reviewing in the
  // same modal, exactly like the initial Preview click, just without the
  // open/close bookend.
  async function handleChooseAnotherOverlayInModal(segment) {
    const picked = await pickAndAssignOverlay(segment, { switchToCustomMode: true });
    if (!picked) return;

    const pending = renderSegmentClip(segment);
    renderEdit();
    renderModalBody();

    await pending;
    renderEdit();
    if (modalSegment === segment) renderModalBody();
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
    overlayBtn.addEventListener('click', () => handleChooseAnotherOverlayInModal(segment));
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
