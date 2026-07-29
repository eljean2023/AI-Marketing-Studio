import { renderWindowPicker } from '../components/window-picker/window-picker.js';
import { renderRecorderControls } from '../components/recorder-controls/recorder-controls.js';
import { renderPreviewPlayer } from '../components/preview-player/preview-player.js';
import { renderEditorTimeline } from '../components/editor-timeline/editor-timeline.js';
import { renderExportPanel } from '../components/export-panel/export-panel.js';
import { createRecorder } from '../../recording/capture.js';
import { clampEdit } from '../../editor/timeline.js';

export function startRecordFlow(container, { onExit }) {
  container.innerHTML = '';

  // Ctrl+R starts recording, but only once a source has been selected
  // ("ready" state) -- pressing it on the picker or during an active
  // recording does nothing.
  function handleKeydown(event) {
    const isTypingTarget = event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA');
    if (isTypingTarget) return;

    const ctrlOrCmd = event.ctrlKey || event.metaKey;
    if (ctrlOrCmd && event.key.toLowerCase() === 'r' && state === 'ready') {
      event.preventDefault();
      handleStart();
    }
  }
  window.addEventListener('keydown', handleKeydown);

  const homeLink = document.createElement('button');
  homeLink.type = 'button';
  homeLink.className = 'home-link';
  homeLink.textContent = '← Home';
  homeLink.addEventListener('click', () => {
    window.removeEventListener('keydown', handleKeydown);
    onExit();
  });
  container.appendChild(homeLink);

  const appEl = document.createElement('div');
  appEl.className = 'flow-content';
  container.appendChild(appEl);

  let state = 'idle';
  let selectedSource = null;
  let recorder = null;
  let recordedFilePath = null;
  let duration = 0;
  let edit = { trimStart: 0, trimEnd: 0, deleteSegment: null };
  let recordingHasAudio = true;

  let progressFillEl = null;
  let progressPercentEl = null;
  let progressPhaseEl = null;

  async function init() {
    const sources = await window.recorderAPI.getSources();
    renderIdle(sources);
  }

  function renderIdle(sources) {
    state = 'idle';
    appEl.innerHTML = '';
    renderWindowPicker(appEl, sources, onSourceSelected, init);
  }

  function onSourceSelected(source) {
    selectedSource = source;
    state = 'ready';
    renderControlsView();
  }

  function renderControlsView() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = titleFor(state);
    appEl.appendChild(heading);

    if ((state === 'recording' || state === 'paused') && !recordingHasAudio) {
      const notice = document.createElement('p');
      notice.textContent = 'No microphone detected — recording video only, without narration.';
      appEl.appendChild(notice);
    }

    const controls = document.createElement('div');
    appEl.appendChild(controls);

    renderRecorderControls(controls, {
      state,
      onStart: handleStart,
      onPause: handlePause,
      onResume: handleResume,
      onStop: handleStop,
    });
  }

  function titleFor(currentState) {
    if (currentState === 'ready') return `Ready to record: ${selectedSource.name}`;
    if (currentState === 'recording') return 'Recording…';
    if (currentState === 'paused') return 'Paused';
    return '';
  }

  async function handleStart() {
    recorder = createRecorder({
      sourceId: selectedSource.id,
      onStopped: handleRecordingStopped,
    });

    try {
      const { hasAudio } = await recorder.start();
      recordingHasAudio = hasAudio;
      state = 'recording';
      renderControlsView();
    } catch (error) {
      renderStartError(error.message);
    }
  }

  function renderStartError(message) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Could not start recording';
    appEl.appendChild(heading);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    appEl.appendChild(messageEl);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', renderControlsView);
    appEl.appendChild(backBtn);
  }

  function handlePause() {
    recorder.pause();
    state = 'paused';
    renderControlsView();
  }

  function handleResume() {
    recorder.resume();
    state = 'recording';
    renderControlsView();
  }

  function handleStop() {
    recorder.stop();
  }

  async function handleRecordingStopped(blob) {
    const arrayBuffer = await blob.arrayBuffer();

    try {
      recordedFilePath = await window.recorderAPI.saveRecording(arrayBuffer);
    } catch (error) {
      renderSaveError(error.message);
      return;
    }

    state = 'preview';
    renderPreview();
  }

  function renderSaveError(message) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Could not save recording';
    appEl.appendChild(heading);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    appEl.appendChild(messageEl);

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'btn btn-secondary';
    restartBtn.textContent = 'Start Over';
    restartBtn.addEventListener('click', init);
    appEl.appendChild(restartBtn);
  }

  function renderPreview() {
    appEl.innerHTML = '';
    renderPreviewPlayer(appEl, {
      filePath: recordedFilePath,
      onContinue: (resolvedDuration) => {
        duration = resolvedDuration;
        edit = { trimStart: 0, trimEnd: duration, deleteSegment: null };
        state = 'editing';
        renderEditing();
      },
    });
  }

  function renderEditing() {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Trim';
    appEl.appendChild(heading);

    const editorContainer = document.createElement('div');
    appEl.appendChild(editorContainer);

    renderEditorTimeline(editorContainer, {
      duration,
      edit,
      onChange: (nextEdit) => {
        edit = clampEdit(nextEdit, duration);
        renderEditing();
      },
      onContinue: () => {
        state = 'export-setup';
        renderExportSetup();
      },
    });
  }

  function renderExportSetup() {
    appEl.innerHTML = '';
    renderExportPanel(appEl, { onExport: handleExport });
  }

  async function handleExport(resolution) {
    state = 'exporting';
    renderExporting();

    const unsubscribe = window.recorderAPI.onExportProgress(({ percent, phase }) => {
      updateExportProgress(percent, phase);
    });

    try {
      const result = await window.recorderAPI.exportVideo({
        inputPath: recordedFilePath,
        edit: clampEdit(edit, duration),
        resolution,
        hasAudio: recordingHasAudio,
      });

      unsubscribe();

      if (result.canceled) {
        state = 'export-setup';
        renderExportSetup();
        return;
      }

      state = 'exported';
      renderExported(result.outputPath);
    } catch (error) {
      unsubscribe();
      state = 'export-error';
      renderExportError(error.message);
    }
  }

  // FFmpeg's own "-progress" output drives this, not an estimate: out_time
  // versus the known total output duration gives a real percentage. There
  // is no separate, truthfully distinguishable "applying crop" step --
  // trim/pad/crop and encoding all happen in one FFmpeg filter+encode pass,
  // so "Encoding…" covers that whole real, progress-tracked phase.
  // "Finalizing…" is real too: it's the temp-file rename step after FFmpeg
  // has fully exited.
  function phaseLabel(phase) {
    if (phase === 'preparing') return 'Preparing…';
    if (phase === 'encoding') return 'Encoding…';
    if (phase === 'finalizing') return 'Finalizing…';
    return '';
  }

  function renderExporting() {
    appEl.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Exporting…';
    appEl.appendChild(heading);

    const progressWrap = document.createElement('div');
    progressWrap.className = 'export-progress';

    const track = document.createElement('div');
    track.className = 'export-progress-track';

    progressFillEl = document.createElement('div');
    progressFillEl.className = 'export-progress-fill';
    progressFillEl.style.width = '0%';
    track.appendChild(progressFillEl);
    progressWrap.appendChild(track);

    const infoRow = document.createElement('div');
    infoRow.className = 'export-progress-info';

    progressPhaseEl = document.createElement('span');
    progressPhaseEl.textContent = phaseLabel('preparing');
    infoRow.appendChild(progressPhaseEl);

    progressPercentEl = document.createElement('span');
    progressPercentEl.textContent = '0%';
    infoRow.appendChild(progressPercentEl);

    progressWrap.appendChild(infoRow);
    appEl.appendChild(progressWrap);
  }

  function updateExportProgress(percent, phase) {
    if (!progressFillEl) return;
    const clamped = Math.max(0, Math.min(100, percent));
    progressFillEl.style.width = `${clamped}%`;
    progressPercentEl.textContent = `${Math.round(clamped)}%`;
    progressPhaseEl.textContent = phaseLabel(phase);
  }

  function renderExported(outputPath) {
    appEl.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Export complete';
    appEl.appendChild(heading);

    const pathEl = document.createElement('p');
    pathEl.textContent = outputPath;
    appEl.appendChild(pathEl);

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'btn btn-primary';
    restartBtn.textContent = 'Record Another';
    restartBtn.addEventListener('click', init);
    appEl.appendChild(restartBtn);
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
    backBtn.textContent = 'Back to Export Settings';
    backBtn.addEventListener('click', renderExportSetup);
    appEl.appendChild(backBtn);
  }

  init();
}
