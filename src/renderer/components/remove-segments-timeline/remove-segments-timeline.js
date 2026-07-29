const MIN_SEGMENT_SECONDS = 0.2;

export function renderRemoveSegmentsTimeline(container, {
  trimStart, trimEnd, zoom, segments, selectedId, onSelect, onChange,
}) {
  container.innerHTML = '';

  const duration = trimEnd - trimStart;

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'remove-timeline-scroll';

  const track = document.createElement('div');
  track.className = 'remove-timeline-track';
  track.style.width = `${100 * zoom}%`;
  scrollWrap.appendChild(track);
  container.appendChild(scrollWrap);

  function timeToPercent(time) {
    return duration > 0 ? ((time - trimStart) / duration) * 100 : 0;
  }

  segments.forEach((segment) => {
    const block = document.createElement('div');
    block.className = segment.id === selectedId
      ? 'remove-segment remove-segment-selected'
      : 'remove-segment';
    block.style.left = `${timeToPercent(segment.start)}%`;
    block.style.width = `${timeToPercent(segment.end) - timeToPercent(segment.start)}%`;

    const startHandle = document.createElement('div');
    startHandle.className = 'remove-segment-handle remove-segment-handle-start';

    const endHandle = document.createElement('div');
    endHandle.className = 'remove-segment-handle remove-segment-handle-end';

    block.appendChild(startHandle);
    block.appendChild(endHandle);
    track.appendChild(block);

    block.addEventListener('click', (event) => {
      if (event.target === block) onSelect(segment.id);
    });

    function attachDrag(handleEl, mode) {
      handleEl.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleEl.setPointerCapture(event.pointerId);
        onSelect(segment.id);

        const startClientX = event.clientX;
        const orig = { start: segment.start, end: segment.end };
        const origWidth = orig.end - orig.start;

        // Drag state is kept local to this closure -- the shared `segment`
        // object (a reference into the caller's removeSegments array) is
        // never mutated mid-drag, only on release via onChange. Undo/Redo
        // snapshots removeSegments before applying a change, so mutating it
        // live here would silently corrupt undo history.
        let draftStart = orig.start;
        let draftEnd = orig.end;

        function onMove(moveEvent) {
          const rect = track.getBoundingClientRect();
          const dt = rect.width > 0 ? ((moveEvent.clientX - startClientX) / rect.width) * duration : 0;

          if (mode === 'move') {
            let newStart = orig.start + dt;
            let newEnd = orig.end + dt;
            if (newStart < trimStart) {
              newStart = trimStart;
              newEnd = trimStart + origWidth;
            }
            if (newEnd > trimEnd) {
              newEnd = trimEnd;
              newStart = trimEnd - origWidth;
            }
            draftStart = newStart;
            draftEnd = newEnd;
          } else if (mode === 'start') {
            draftStart = Math.min(Math.max(trimStart, orig.start + dt), draftEnd - MIN_SEGMENT_SECONDS);
          } else {
            draftEnd = Math.max(Math.min(trimEnd, orig.end + dt), draftStart + MIN_SEGMENT_SECONDS);
          }

          block.style.left = `${timeToPercent(draftStart)}%`;
          block.style.width = `${timeToPercent(draftEnd) - timeToPercent(draftStart)}%`;
        }

        function onUp(upEvent) {
          handleEl.releasePointerCapture(upEvent.pointerId);
          handleEl.removeEventListener('pointermove', onMove);
          handleEl.removeEventListener('pointerup', onUp);
          onChange(segments.map((s) => (s.id === segment.id ? { ...s, start: draftStart, end: draftEnd } : s)));
        }

        handleEl.addEventListener('pointermove', onMove);
        handleEl.addEventListener('pointerup', onUp);
      });
    }

    attachDrag(block, 'move');
    attachDrag(startHandle, 'start');
    attachDrag(endHandle, 'end');
  });
}
