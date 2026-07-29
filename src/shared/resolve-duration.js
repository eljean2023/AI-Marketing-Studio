export function resolveDuration(video) {
  return new Promise((resolve) => {
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration)) {
        resolve(video.duration);
        return;
      }

      // Some containers (e.g. MediaRecorder-produced webm) report Infinity
      // duration until the browser is forced to index the file by seeking
      // past the end.
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
