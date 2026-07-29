import { renderSnipTimeline } from '../components/snip-timeline/snip-timeline.js';
import { renderCropSelector } from '../components/crop-selector/crop-selector.js';
import { renderRemoveSegmentsTimeline } from '../components/remove-segments-timeline/remove-segments-timeline.js';
import { resolveDuration } from '../../shared/resolve-duration.js';

const DEFAULT_REMOVE_SEGMENT_SECONDS = 2;
const MIN_REMOVE_SEGMENT_SECONDS = 0.2;
const FRAME_STEP_SECONDS = 1 / 30;
const MAX_ZOOM = 8;
const MAX_HISTORY = 50;
const JUMP_SECONDS = 5;
const REPLACE_CONFIRM_MESSAGE =
  'A video is already open. Replace it with the new one? Unsaved trim, crop, and remove-segment changes will be lost.';

function basename(filePath) {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1];
}

function isTypingTarget(target) {
  return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
}

export function startSnipFlow(container, { onExit, initialFilePath }) {
  container.innerHTML = '';

  const homeLink = document.createElement('button');
  homeLink.type = 'button';
  homeLink.className = 'home-link';
  homeLink.textContent = '← Home';
  homeLink.addEventListener('click', () => {
    disposeKeydown();
    onExit();
  });
  container.appendChild(homeLink);

  const appEl = document.createElement('div');
  appEl.className = 'flow-content';
  container.appendChild(appEl);

  let videoPath = null;
  let duration = 0;
  let videoWidth = 0;
  let videoHeight = 0;
  let selection = { start: 0, end: 0 };
  let crop = null;
  let removeSegments = [];
  let selectedSegmentId = null;
  let undoStack = [];
  let redoStack = [];
  let zoomLevel = 1;

  let cutProgressFillEl = null;
  let cutProgressPercentEl = null;
  let cutProgressPhaseEl = null;

  // Every screen that wants keyboard shortcuts registers its handler here;
  // whichever screen is entered next always disposes the previous one first,
  // so shortcuts never fire from a screen that's no longer showing.
  let disposeKeydown = () => {};

  function scopeKeydown(handler) {
    disposeKeydown();
    window.addEventListener('keydown', handler);
    disposeKeydown = () => window.removeEventListener('keydown', handler);
  }

  if (initialFilePath) {
    loadVideo(initialFilePath);
  } else {
    renderOpenPrompt();
  }

  function renderOpenPrompt() {
    disposeKeydown();
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Video Snipping Tool';
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = 'Open an existing video (MP4, MOV, MKV, or WEBM) to select the portion you want to keep, or drag a video file anywhere onto this window.';
    appEl.appendChild(description);

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn btn-primary';
    openBtn.textContent = 'Open Video';
    openBtn.addEventListener('click', handleOpen);
    appEl.appendChild(openBtn);

    const recentContainer = document.createElement('div');
    recentContainer.className = 'recent-files';
    appEl.appendChild(recentContainer);

    window.snipAPI.getRecentFiles().then((entries) => {
      if (entries.length === 0) return;
      renderRecentFilesList(recentContainer, entries);
    });
  }

  function renderRecentFilesList(container, entries) {
    container.innerHTML = '';

    const heading = document.createElement('h3');
    heading.className = 'recent-files-heading';
    heading.textContent = 'Recent Files';
    container.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'recent-files-list';

    entries.forEach((entry) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'recent-file-item';
      item.textContent = basename(entry.path);
      item.title = entry.path;
      item.addEventListener('click', () => loadVideo(entry.path));
      list.appendChild(item);
    });

    container.appendChild(list);
  }

  async function handleOpen() {
    const result = await window.snipAPI.openVideo();
    if (result.canceled || !result.filePath) return;
    loadVideo(result.filePath);
  }

  // Shared "actually load this file" path used by the Open Video dialog,
  // Recent Files, drag & drop, and the initial file passed in from outside.
  function loadVideo(filePath) {
    videoPath = filePath;
    duration = 0;
    videoWidth = 0;
    videoHeight = 0;
    selection = { start: 0, end: 0 };
    crop = null;
    removeSegments = [];
    selectedSegmentId = null;
    undoStack = [];
    redoStack = [];
    zoomLevel = 1;
    window.snipAPI.addRecentFile(filePath);
    renderEdit();
  }

  // Called from outside this flow (drag & drop onto the window, or the
  // global Ctrl+O shortcut when this flow is already mounted). Unlike the
  // explicit in-flow "Open Video" / "Open a Different Video" buttons, these
  // triggers can happen unexpectedly mid-edit, so they confirm before
  // discarding an already-open video's changes.
  function requestOpenFile(filePath) {
    if (videoPath) {
      if (!window.confirm(REPLACE_CONFIRM_MESSAGE)) return;
    }
    loadVideo(filePath);
  }

  function requestOpenDialog() {
    if (videoPath) {
      if (!window.confirm(REPLACE_CONFIRM_MESSAGE)) return;
    }
    handleOpen();
  }

  function renderEdit() {
    disposeKeydown();
    appEl.innerHTML = '';

    let cropModeActive = false;

    const heading = document.createElement('h2');
    heading.textContent = 'Edit';
    appEl.appendChild(heading);

    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    appEl.appendChild(videoWrapper);

    const video = document.createElement('video');
    video.src = `file://${videoPath}`;
    videoWrapper.appendChild(video);

    const cropOverlay = document.createElement('div');
    cropOverlay.className = 'crop-overlay-container';
    videoWrapper.appendChild(cropOverlay);

    const playbackControls = document.createElement('div');
    playbackControls.className = 'recorder-controls';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn btn-secondary';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => video.play());

    const pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'btn btn-secondary';
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => video.pause());

    playbackControls.appendChild(playBtn);
    playbackControls.appendChild(pauseBtn);
    appEl.appendChild(playbackControls);

    const timelineContainer = document.createElement('div');
    timelineContainer.className = 'snip-timeline-container';
    appEl.appendChild(timelineContainer);

    // Multi Segment Remove (Ripple Delete) lives in its own panel, rendered
    // and re-rendered independently of the rest of this screen so that
    // adding/deleting/undoing a segment never resets video playback or the
    // existing Trim/Crop controls above it.
    const removeSegmentsPanel = document.createElement('div');
    removeSegmentsPanel.className = 'remove-segments-panel';
    appEl.appendChild(removeSegmentsPanel);

    const cropBtn = document.createElement('button');
    cropBtn.type = 'button';
    cropBtn.className = 'btn btn-secondary';
    cropBtn.textContent = crop ? 'Adjust Crop' : 'Crop';
    cropBtn.addEventListener('click', toggleCropMode);
    appEl.appendChild(cropBtn);

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'btn btn-primary';
    previewBtn.textContent = 'Preview';
    previewBtn.addEventListener('click', renderPreviewFinal);
    appEl.appendChild(previewBtn);

    const openAnotherBtn = document.createElement('button');
    openAnotherBtn.type = 'button';
    openAnotherBtn.className = 'btn btn-secondary';
    openAnotherBtn.textContent = 'Open a Different Video';
    openAnotherBtn.addEventListener('click', renderOpenPrompt);
    appEl.appendChild(openAnotherBtn);

    function toggleCropMode() {
      cropModeActive = !cropModeActive;

      if (cropModeActive) {
        cropBtn.textContent = 'Done Cropping';
        renderCropSelector(cropOverlay, {
          videoWidth,
          videoHeight,
          crop,
          onChange: (next) => {
            crop = next;
          },
        });
      } else {
        cropBtn.textContent = crop ? 'Adjust Crop' : 'Crop';
        cropOverlay.innerHTML = '';
      }
    }

    function initTimeline(resolvedDuration) {
      renderSnipTimeline(timelineContainer, {
        duration: resolvedDuration,
        start: selection.start,
        end: selection.end,
        onScrub: (time) => {
          video.currentTime = time;
        },
        onChange: (next) => {
          selection = next;
          renderRemoveSegmentsPanel();
        },
      });
    }

    // --- Multi Segment Remove (Ripple Delete) ---

    function pushHistory() {
      undoStack.push(removeSegments.map((s) => ({ ...s })));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = [];
    }

    function handleAddSegment() {
      pushHistory();

      const half = DEFAULT_REMOVE_SEGMENT_SECONDS / 2;
      let start = Math.max(selection.start, video.currentTime - half);
      let end = Math.min(selection.end, video.currentTime + half);

      if (end - start < MIN_REMOVE_SEGMENT_SECONDS) {
        start = selection.start;
        end = Math.min(selection.end, selection.start + DEFAULT_REMOVE_SEGMENT_SECONDS);
      }

      const id = `seg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      removeSegments = [...removeSegments, { id, start, end }];
      selectedSegmentId = id;
      renderRemoveSegmentsPanel();
    }

    function handleDeleteSelected() {
      if (!selectedSegmentId) return;
      pushHistory();
      removeSegments = removeSegments.filter((s) => s.id !== selectedSegmentId);
      selectedSegmentId = null;
      renderRemoveSegmentsPanel();
    }

    function handleUndo() {
      if (undoStack.length === 0) return;
      redoStack.push(removeSegments.map((s) => ({ ...s })));
      removeSegments = undoStack.pop();
      selectedSegmentId = null;
      renderRemoveSegmentsPanel();
    }

    function handleRedo() {
      if (redoStack.length === 0) return;
      undoStack.push(removeSegments.map((s) => ({ ...s })));
      removeSegments = redoStack.pop();
      selectedSegmentId = null;
      renderRemoveSegmentsPanel();
    }

    function handleZoom(delta) {
      zoomLevel = Math.max(1, Math.min(MAX_ZOOM, zoomLevel + delta));
      renderRemoveSegmentsPanel();
    }

    function handleFrameStep(direction) {
      video.pause();
      video.currentTime = Math.max(0, Math.min(duration, video.currentTime + direction * FRAME_STEP_SECONDS));
    }

    function renderRemoveSegmentsPanel() {
      removeSegmentsPanel.innerHTML = '';

      const heading = document.createElement('h3');
      heading.className = 'remove-segments-heading';
      heading.textContent = 'Remove Segments';
      removeSegmentsPanel.appendChild(heading);

      const toolbar = document.createElement('div');
      toolbar.className = 'remove-segments-toolbar';

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn btn-secondary';
      addBtn.textContent = '+ Add Remove Segment';
      addBtn.addEventListener('click', handleAddSegment);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-secondary';
      deleteBtn.textContent = 'Delete Selected';
      deleteBtn.disabled = !selectedSegmentId;
      deleteBtn.addEventListener('click', handleDeleteSelected);

      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.className = 'btn btn-secondary';
      undoBtn.textContent = 'Undo';
      undoBtn.disabled = undoStack.length === 0;
      undoBtn.addEventListener('click', handleUndo);

      const redoBtn = document.createElement('button');
      redoBtn.type = 'button';
      redoBtn.className = 'btn btn-secondary';
      redoBtn.textContent = 'Redo';
      redoBtn.disabled = redoStack.length === 0;
      redoBtn.addEventListener('click', handleRedo);

      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.type = 'button';
      zoomOutBtn.className = 'btn btn-secondary';
      zoomOutBtn.textContent = 'Zoom −';
      zoomOutBtn.disabled = zoomLevel <= 1;
      zoomOutBtn.addEventListener('click', () => handleZoom(-1));

      const zoomInBtn = document.createElement('button');
      zoomInBtn.type = 'button';
      zoomInBtn.className = 'btn btn-secondary';
      zoomInBtn.textContent = 'Zoom +';
      zoomInBtn.disabled = zoomLevel >= MAX_ZOOM;
      zoomInBtn.addEventListener('click', () => handleZoom(1));

      const frameBackBtn = document.createElement('button');
      frameBackBtn.type = 'button';
      frameBackBtn.className = 'btn btn-secondary';
      frameBackBtn.textContent = '◀ Frame';
      frameBackBtn.addEventListener('click', () => handleFrameStep(-1));

      const frameForwardBtn = document.createElement('button');
      frameForwardBtn.type = 'button';
      frameForwardBtn.className = 'btn btn-secondary';
      frameForwardBtn.textContent = 'Frame ▶';
      frameForwardBtn.addEventListener('click', () => handleFrameStep(1));

      [addBtn, deleteBtn, undoBtn, redoBtn, zoomOutBtn, zoomInBtn, frameBackBtn, frameForwardBtn]
        .forEach((btn) => toolbar.appendChild(btn));

      removeSegmentsPanel.appendChild(toolbar);

      const timelineEl = document.createElement('div');
      timelineEl.className = 'remove-timeline-container';
      removeSegmentsPanel.appendChild(timelineEl);

      renderRemoveSegmentsTimeline(timelineEl, {
        trimStart: selection.start,
        trimEnd: selection.end,
        zoom: zoomLevel,
        segments: removeSegments,
        selectedId: selectedSegmentId,
        onSelect: (id) => {
          selectedSegmentId = id;
          renderRemoveSegmentsPanel();
        },
        onChange: (next) => {
          pushHistory();
          removeSegments = next;
          renderRemoveSegmentsPanel();
        },
      });
    }

    // --- Keyboard shortcuts (active only while this Edit screen is shown) ---

    function handleEditKeydown(event) {
      if (isTypingTarget(event.target)) return;

      const ctrlOrCmd = event.ctrlKey || event.metaKey;

      if (event.code === 'Space') {
        event.preventDefault();
        if (video.paused) video.play(); else video.pause();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (cropModeActive) {
          toggleCropMode();
        } else if (selectedSegmentId) {
          selectedSegmentId = null;
          renderRemoveSegmentsPanel();
        }
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        handleDeleteSelected();
        return;
      }

      if (ctrlOrCmd && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (ctrlOrCmd && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - JUMP_SECONDS);
        return;
      }

      if (event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        video.currentTime = Math.min(duration, video.currentTime + JUMP_SECONDS);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleFrameStep(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleFrameStep(1);
      }
    }

    scopeKeydown(handleEditKeydown);

    if (duration > 0) {
      // Returning to this screen (e.g. "Back to Edit") — duration/dimensions
      // are already known, so the user's trim, crop, and remove-segment
      // selections are preserved instead of resetting.
      initTimeline(duration);
      renderRemoveSegmentsPanel();
    } else {
      resolveDuration(video).then((resolvedDuration) => {
        duration = resolvedDuration;
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
        selection = { start: 0, end: duration };
        initTimeline(duration);
        renderRemoveSegmentsPanel();
      });
    }
  }

  function renderPreviewFinal() {
    disposeKeydown();
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Preview Final Result';
    appEl.appendChild(heading);

    const description = document.createElement('p');
    description.textContent = 'This preview shows exactly what will be exported.';
    appEl.appendChild(description);

    const effectiveCrop = crop || { x: 0, y: 0, width: videoWidth, height: videoHeight };
    const displayWidth = Math.min(640, effectiveCrop.width);
    const displayHeight = displayWidth * (effectiveCrop.height / effectiveCrop.width);
    const s = displayWidth / effectiveCrop.width;

    const frame = document.createElement('div');
    frame.className = 'preview-frame';
    frame.style.width = `${displayWidth}px`;
    frame.style.height = `${displayHeight}px`;
    appEl.appendChild(frame);

    const video = document.createElement('video');
    video.src = `file://${videoPath}`;
    video.style.width = `${videoWidth * s}px`;
    video.style.height = `${videoHeight * s}px`;
    video.style.left = `${-effectiveCrop.x * s}px`;
    video.style.top = `${-effectiveCrop.y * s}px`;
    frame.appendChild(video);

    const playbackControls = document.createElement('div');
    playbackControls.className = 'recorder-controls';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn btn-secondary';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => {
      if (video.currentTime >= selection.end - 0.05) {
        video.currentTime = selection.start;
      }
      video.play();
    });

    const pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'btn btn-secondary';
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => video.pause());

    playbackControls.appendChild(playBtn);
    playbackControls.appendChild(pauseBtn);
    appEl.appendChild(playbackControls);

    const cutBtn = document.createElement('button');
    cutBtn.type = 'button';
    cutBtn.className = 'btn btn-primary';
    cutBtn.textContent = '✂ Cut';
    cutBtn.addEventListener('click', handleCut);
    appEl.appendChild(cutBtn);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back to Edit';
    backBtn.addEventListener('click', renderEdit);
    appEl.appendChild(backBtn);

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = selection.start;
    }, { once: true });

    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= selection.end) {
        video.pause();
        video.currentTime = selection.end;
        return;
      }

      // Simulate the ripple delete during preview: if playback enters a
      // removed segment, jump straight to its end so the user sees exactly
      // what the export will contain.
      const activeRemoved = removeSegments.find(
        (segment) => video.currentTime >= segment.start && video.currentTime < segment.end
      );
      if (activeRemoved) {
        video.currentTime = activeRemoved.end;
      }
    });

    function handlePreviewKeydown(event) {
      if (isTypingTarget(event.target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (video.paused) video.play(); else video.pause();
      }
    }

    scopeKeydown(handlePreviewKeydown);
  }

  async function handleCut() {
    disposeKeydown();
    renderCutting();

    const unsubscribe = window.snipAPI.onCutProgress(({ percent, phase }) => {
      updateCutProgress(percent, phase);
    });

    try {
      const result = await window.snipAPI.cutVideo({
        inputPath: videoPath,
        start: selection.start,
        end: selection.end,
        crop,
        removeSegments,
      });

      unsubscribe();

      if (result.canceled) {
        renderPreviewFinal();
        return;
      }

      renderCutSuccess(result.outputPath);
    } catch (error) {
      unsubscribe();
      renderCutError(error.message);
    }
  }

  // FFmpeg's own "-progress" output drives this, not an estimate -- same
  // approach as record-flow.js's phaseLabel(). "Analyzing…" is real too:
  // it's cut.js's post-copy duration check, run before deciding whether a
  // frame-accurate re-encode is needed.
  function phaseLabel(phase) {
    if (phase === 'preparing') return 'Preparing…';
    if (phase === 'analyzing') return 'Analyzing video…';
    if (phase === 'cutting') return 'Cutting…';
    if (phase === 'finalizing') return 'Finalizing…';
    return '';
  }

  function renderCutting() {
    appEl.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Cutting…';
    appEl.appendChild(heading);

    const progressWrap = document.createElement('div');
    progressWrap.className = 'export-progress';

    const track = document.createElement('div');
    track.className = 'export-progress-track';

    cutProgressFillEl = document.createElement('div');
    cutProgressFillEl.className = 'export-progress-fill';
    cutProgressFillEl.style.width = '0%';
    track.appendChild(cutProgressFillEl);
    progressWrap.appendChild(track);

    const infoRow = document.createElement('div');
    infoRow.className = 'export-progress-info';

    cutProgressPhaseEl = document.createElement('span');
    cutProgressPhaseEl.textContent = phaseLabel('preparing');
    infoRow.appendChild(cutProgressPhaseEl);

    cutProgressPercentEl = document.createElement('span');
    cutProgressPercentEl.textContent = '0%';
    infoRow.appendChild(cutProgressPercentEl);

    progressWrap.appendChild(infoRow);
    appEl.appendChild(progressWrap);
  }

  function updateCutProgress(percent, phase) {
    if (!cutProgressFillEl) return;
    const clamped = Math.max(0, Math.min(100, percent));
    cutProgressFillEl.style.width = `${clamped}%`;
    cutProgressPercentEl.textContent = `${Math.round(clamped)}%`;
    cutProgressPhaseEl.textContent = phaseLabel(phase);
  }

  function renderCutSuccess(outputPath) {
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
    anotherBtn.textContent = 'Snip Another Video';
    anotherBtn.addEventListener('click', renderOpenPrompt);
    appEl.appendChild(anotherBtn);
  }

  function renderCutError(message) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Cut failed';
    appEl.appendChild(heading);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    appEl.appendChild(messageEl);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', renderPreviewFinal);
    appEl.appendChild(backBtn);
  }

  return { requestOpenFile, requestOpenDialog };
}
