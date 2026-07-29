// Pure presentational component (same convention as window-picker.js):
// takes already-resolved data plus callbacks, owns no IPC calls itself.
// The caller (spot-flow.js) is responsible for invoking spotsAPI and
// re-rendering with updated `current`.
export function renderBackgroundPicker(container, { current, onPick }) {
  container.innerHTML = '';

  const labelEl = document.createElement('label');
  labelEl.className = 'shorts-field-label';
  labelEl.textContent = 'Background';
  container.appendChild(labelEl);

  const wrap = document.createElement('div');
  wrap.className = 'shorts-custom-overlay';

  if (current) {
    const preview = document.createElement(current.fileType === 'image' ? 'img' : 'video');
    preview.className = 'shorts-overlay-preview';
    preview.src = current.fileType === 'image'
      ? (current.previewDataUrl || '')
      : `file://${current.filePath}`;
    if (current.fileType === 'video') {
      preview.controls = true;
      preview.muted = true;
    }
    wrap.appendChild(preview);

    const fileNameEl = document.createElement('p');
    fileNameEl.className = 'shorts-overlay-filename';
    fileNameEl.textContent = current.filePath.split(/[\\/]/).pop();
    wrap.appendChild(fileNameEl);
  }

  const browseBtn = document.createElement('button');
  browseBtn.type = 'button';
  browseBtn.className = 'btn btn-secondary';
  browseBtn.textContent = current ? 'Change Background' : 'Choose Background';
  browseBtn.addEventListener('click', onPick);
  wrap.appendChild(browseBtn);

  container.appendChild(wrap);
}
