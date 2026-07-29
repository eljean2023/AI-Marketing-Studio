export function renderPreviewPlayer(container, { filePath, onContinue }) {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Preview';
  container.appendChild(heading);

  const video = document.createElement('video');
  video.src = `file://${filePath}`;
  video.controls = true;
  container.appendChild(video);

  const continueBtn = document.createElement('button');
  continueBtn.type = 'button';
  continueBtn.className = 'btn btn-primary';
  continueBtn.textContent = 'Continue to Edit';
  continueBtn.disabled = true;
  container.appendChild(continueBtn);

  let resolvedDuration = 0;
  continueBtn.addEventListener('click', () => onContinue(resolvedDuration));

  resolveDuration(video).then((duration) => {
    resolvedDuration = duration;
    continueBtn.disabled = false;
  });
}

function resolveDuration(video) {
  return new Promise((resolve) => {
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration)) {
        resolve(video.duration);
        return;
      }

      // MediaRecorder-produced webm files report Infinity duration until the
      // browser is forced to index the file by seeking past the end.
      const onDurationChange = () => {
        if (Number.isFinite(video.duration)) {
          video.removeEventListener('durationchange', onDurationChange);
          video.currentTime = 0;
          resolve(video.duration);
        }
      };

      video.addEventListener('durationchange', onDurationChange);
      video.currentTime = 1e101;
    }, { once: true });
  });
}
