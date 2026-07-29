import { formatTime } from '../../../editor/timeline.js';

const MIN_GAP_SECONDS = 0.1;

export function renderSnipTimeline(container, { duration, start, end, onScrub, onChange }) {
  container.innerHTML = '';

  let currentStart = start;
  let currentEnd = end;

  const wrapper = document.createElement('div');
  wrapper.className = 'snip-timeline';

  const track = document.createElement('div');
  track.className = 'snip-track';

  const range = document.createElement('div');
  range.className = 'snip-range';

  const startHandle = document.createElement('div');
  startHandle.className = 'snip-handle';

  const endHandle = document.createElement('div');
  endHandle.className = 'snip-handle';

  track.appendChild(range);
  track.appendChild(startHandle);
  track.appendChild(endHandle);
  wrapper.appendChild(track);

  const labels = document.createElement('div');
  labels.className = 'snip-labels';

  const startLabel = document.createElement('span');
  const endLabel = document.createElement('span');
  labels.appendChild(startLabel);
  labels.appendChild(endLabel);
  wrapper.appendChild(labels);

  container.appendChild(wrapper);

  function layout() {
    const startPct = duration > 0 ? (currentStart / duration) * 100 : 0;
    const endPct = duration > 0 ? (currentEnd / duration) * 100 : 100;

    startHandle.style.left = `${startPct}%`;
    endHandle.style.left = `${endPct}%`;
    range.style.left = `${startPct}%`;
    range.style.width = `${Math.max(0, endPct - startPct)}%`;

    startLabel.textContent = `Start: ${formatTime(currentStart)}`;
    endLabel.textContent = `End: ${formatTime(currentEnd)}`;
  }

  function timeFromPointer(clientX) {
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    return ratio * duration;
  }

  function attachDrag(handle, type) {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);

      function onPointerMove(moveEvent) {
        const time = timeFromPointer(moveEvent.clientX);

        if (type === 'start') {
          currentStart = Math.min(time, currentEnd - MIN_GAP_SECONDS);
          currentStart = Math.max(0, currentStart);
        } else {
          currentEnd = Math.max(time, currentStart + MIN_GAP_SECONDS);
          currentEnd = Math.min(duration, currentEnd);
        }

        layout();

        if (onScrub) onScrub(type === 'start' ? currentStart : currentEnd);
      }

      function onPointerUp(upEvent) {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        onChange({ start: currentStart, end: currentEnd });
      }

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
    });
  }

  attachDrag(startHandle, 'start');
  attachDrag(endHandle, 'end');

  layout();
}
