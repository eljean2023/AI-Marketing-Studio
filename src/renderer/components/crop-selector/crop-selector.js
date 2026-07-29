const MIN_SIZE_PX = 20;

export function renderCropSelector(container, { videoWidth, videoHeight, crop, onChange }) {
  container.innerHTML = '';
  container.style.pointerEvents = 'auto';

  let current = crop ? { ...crop } : null;
  let box = null;
  let handles = {};

  function scale() {
    return {
      x: container.clientWidth / videoWidth,
      y: container.clientHeight / videoHeight,
    };
  }

  function clamp() {
    current.width = Math.max(MIN_SIZE_PX, Math.min(current.width, videoWidth));
    current.height = Math.max(MIN_SIZE_PX, Math.min(current.height, videoHeight));
    current.x = Math.max(0, Math.min(current.x, videoWidth - current.width));
    current.y = Math.max(0, Math.min(current.y, videoHeight - current.height));
  }

  function layout() {
    const s = scale();
    box.style.left = `${current.x * s.x}px`;
    box.style.top = `${current.y * s.y}px`;
    box.style.width = `${current.width * s.x}px`;
    box.style.height = `${current.height * s.y}px`;
  }

  function commit() {
    onChange({ ...current });
  }

  function createBoxElement() {
    box = document.createElement('div');
    box.className = 'crop-box';

    ['nw', 'ne', 'sw', 'se'].forEach((corner) => {
      const handle = document.createElement('div');
      handle.className = `crop-handle crop-handle-${corner}`;
      handles[corner] = handle;
      box.appendChild(handle);
    });

    container.appendChild(box);
  }

  // Phase 2: once a rectangle exists, it can be moved (drag the box) or
  // resized (drag a corner handle) — this is the "adjust" phase Windows
  // Snipping Tool offers after the initial selection is drawn.
  function attachMoveAndResize() {
    box.addEventListener('pointerdown', (event) => {
      if (event.target !== box) return;
      event.preventDefault();
      box.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const origX = current.x;
      const origY = current.y;

      function onMove(moveEvent) {
        const s = scale();
        current.x = origX + (moveEvent.clientX - startX) / s.x;
        current.y = origY + (moveEvent.clientY - startY) / s.y;
        clamp();
        layout();
      }

      function onUp(upEvent) {
        box.releasePointerCapture(upEvent.pointerId);
        box.removeEventListener('pointermove', onMove);
        box.removeEventListener('pointerup', onUp);
        commit();
      }

      box.addEventListener('pointermove', onMove);
      box.addEventListener('pointerup', onUp);
    });

    Object.entries(handles).forEach(([corner, handle]) => {
      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);

        const startX = event.clientX;
        const startY = event.clientY;
        const orig = { ...current };

        function onMove(moveEvent) {
          const s = scale();
          const dx = (moveEvent.clientX - startX) / s.x;
          const dy = (moveEvent.clientY - startY) / s.y;

          if (corner.includes('w')) {
            current.x = orig.x + dx;
            current.width = orig.width - dx;
          }
          if (corner.includes('e')) {
            current.width = orig.width + dx;
          }
          if (corner.includes('n')) {
            current.y = orig.y + dy;
            current.height = orig.height - dy;
          }
          if (corner.includes('s')) {
            current.height = orig.height + dy;
          }

          current.width = Math.max(MIN_SIZE_PX, current.width);
          current.height = Math.max(MIN_SIZE_PX, current.height);
          layout();
        }

        function onUp(upEvent) {
          handle.releasePointerCapture(upEvent.pointerId);
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          clamp();
          layout();
          commit();
        }

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
      });
    });
  }

  // Phase 1: no rectangle exists yet. Mouse down marks one corner; dragging
  // (in any direction) grows the rectangle live between that corner and the
  // current pointer position, exactly like Windows Snipping Tool. Mouse up
  // finalizes it and hands off to the adjust phase above.
  function attachDrawGesture() {
    container.addEventListener('pointerdown', (event) => {
      if (event.target !== container) return;
      event.preventDefault();
      container.setPointerCapture(event.pointerId);

      const rect = container.getBoundingClientRect();
      const s = scale();
      const startVideoX = (event.clientX - rect.left) / s.x;
      const startVideoY = (event.clientY - rect.top) / s.y;

      current = { x: startVideoX, y: startVideoY, width: 0, height: 0 };
      createBoxElement();
      layout();

      function onMove(moveEvent) {
        const curVideoX = (moveEvent.clientX - rect.left) / s.x;
        const curVideoY = (moveEvent.clientY - rect.top) / s.y;

        current.x = Math.max(0, Math.min(startVideoX, curVideoX));
        current.y = Math.max(0, Math.min(startVideoY, curVideoY));
        current.width = Math.min(videoWidth, Math.abs(curVideoX - startVideoX));
        current.height = Math.min(videoHeight, Math.abs(curVideoY - startVideoY));

        layout();
      }

      function onUp(upEvent) {
        container.releasePointerCapture(upEvent.pointerId);
        container.removeEventListener('pointermove', onMove);
        container.removeEventListener('pointerup', onUp);

        clamp();
        layout();
        attachMoveAndResize();
        commit();
      }

      container.addEventListener('pointermove', onMove);
      container.addEventListener('pointerup', onUp);
    }, { once: true });
  }

  if (current) {
    // Re-entering "Adjust Crop" with a previously drawn rectangle — resume
    // directly in the adjust phase instead of forcing a redraw.
    createBoxElement();
    layout();
    attachMoveAndResize();
  } else {
    attachDrawGesture();
  }
}
