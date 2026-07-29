export function renderWindowPicker(container, sources, onSelect, onRetry) {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Select a window to record';
  container.appendChild(heading);

  if (sources.length === 0) {
    const message = document.createElement('p');
    message.textContent = 'No recordable windows were found. Make sure at least one application window is open.';
    container.appendChild(message);

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-secondary';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', onRetry);
    container.appendChild(retryBtn);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'source-grid';

  sources.forEach((source) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'source-card';

    const img = document.createElement('img');
    img.src = source.thumbnailDataUrl;
    img.alt = source.name;

    const label = document.createElement('span');
    label.textContent = source.name;

    card.appendChild(img);
    card.appendChild(label);
    card.addEventListener('click', () => onSelect(source));

    grid.appendChild(card);
  });

  container.appendChild(grid);
}
