export function renderRecorderControls(container, { state, onStart, onPause, onResume, onStop }) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'recorder-controls';

  if (state === 'ready') {
    wrapper.appendChild(createButton('Start Recording', 'primary', onStart));
  }

  if (state === 'recording') {
    wrapper.appendChild(createButton('Pause', 'secondary', onPause));
    wrapper.appendChild(createButton('Stop', 'danger', onStop));
  }

  if (state === 'paused') {
    wrapper.appendChild(createButton('Resume', 'primary', onResume));
    wrapper.appendChild(createButton('Stop', 'danger', onStop));
  }

  container.appendChild(wrapper);
}

function createButton(text, variant, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn btn-${variant}`;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}
