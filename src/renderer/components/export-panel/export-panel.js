const RESOLUTIONS = [
  { label: '1920 x 1080 (Landscape)', width: 1920, height: 1080 },
  { label: '1080 x 1920 (Portrait)', width: 1080, height: 1920 },
];

export function renderExportPanel(container, { onExport }) {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Export';
  container.appendChild(heading);

  const form = document.createElement('div');
  form.className = 'export-form';

  let selected = RESOLUTIONS[0];

  const options = document.createElement('div');
  options.className = 'resolution-options';

  RESOLUTIONS.forEach((resolution, index) => {
    const label = document.createElement('label');
    label.className = 'radio-row';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'resolution';
    input.checked = index === 0;
    input.addEventListener('change', () => {
      selected = resolution;
    });

    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${resolution.label}`));
    options.appendChild(label);
  });

  form.appendChild(options);

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn btn-primary';
  exportBtn.textContent = 'Export MP4';
  exportBtn.addEventListener('click', () => onExport(selected));
  form.appendChild(exportBtn);

  container.appendChild(form);
}
