import { formatTime } from '../../../editor/timeline.js';

export function renderEditorTimeline(container, { duration, edit, onChange, onContinue }) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'editor-panel';

  wrapper.appendChild(buildSliderRow({
    label: 'Cut beginning (start at)',
    value: edit.trimStart,
    min: 0,
    max: duration,
    onInput: (value) => onChange({ ...edit, trimStart: Number(value) }),
  }));

  wrapper.appendChild(buildSliderRow({
    label: 'Cut end (end at)',
    value: edit.trimEnd,
    min: 0,
    max: duration,
    onInput: (value) => onChange({ ...edit, trimEnd: Number(value) }),
  }));

  const deleteToggle = document.createElement('label');
  deleteToggle.className = 'checkbox-row';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(edit.deleteSegment);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      onChange({ ...edit, deleteSegment: { start: edit.trimStart, end: edit.trimStart } });
    } else {
      onChange({ ...edit, deleteSegment: null });
    }
  });

  deleteToggle.appendChild(checkbox);
  deleteToggle.appendChild(document.createTextNode(' Delete a segment'));
  wrapper.appendChild(deleteToggle);

  if (edit.deleteSegment) {
    wrapper.appendChild(buildSliderRow({
      label: 'Delete from',
      value: edit.deleteSegment.start,
      min: edit.trimStart,
      max: edit.trimEnd,
      onInput: (value) => onChange({ ...edit, deleteSegment: { ...edit.deleteSegment, start: Number(value) } }),
    }));

    wrapper.appendChild(buildSliderRow({
      label: 'Delete to',
      value: edit.deleteSegment.end,
      min: edit.trimStart,
      max: edit.trimEnd,
      onInput: (value) => onChange({ ...edit, deleteSegment: { ...edit.deleteSegment, end: Number(value) } }),
    }));
  }

  const continueBtn = document.createElement('button');
  continueBtn.type = 'button';
  continueBtn.className = 'btn btn-primary';
  continueBtn.textContent = 'Continue to Export';
  continueBtn.addEventListener('click', onContinue);
  wrapper.appendChild(continueBtn);

  container.appendChild(wrapper);
}

function buildSliderRow({ label, value, min, max, onInput }) {
  const row = document.createElement('div');
  row.className = 'slider-row';

  const labelEl = document.createElement('label');
  labelEl.textContent = `${label}: ${formatTime(value)}`;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(Math.max(min, max));
  slider.step = '0.1';
  slider.value = String(value);
  slider.addEventListener('input', (event) => {
    labelEl.textContent = `${label}: ${formatTime(Number(event.target.value))}`;
    onInput(event.target.value);
  });

  row.appendChild(labelEl);
  row.appendChild(slider);
  return row;
}
