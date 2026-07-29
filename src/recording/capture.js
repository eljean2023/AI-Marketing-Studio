const MIME_TYPE = 'video/webm;codecs=vp9,opus';

export function createRecorder({ sourceId, onStopped }) {
  let mediaRecorder = null;
  let stream = null;
  let chunks = [];

  async function start() {
    const videoStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      },
    });

    // Microphone capture is best-effort: many machines (VMs, remote desktops,
    // desktops with no mic plugged in) have no audio input device at all.
    // The recorder must still work without one, video-only.
    let micStream = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      micStream = null;
    }

    stream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(micStream ? micStream.getAudioTracks() : []),
    ]);

    chunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      onStopped(new Blob(chunks, { type: MIME_TYPE }));
    };

    mediaRecorder.start();

    return { hasAudio: Boolean(micStream) };
  }

  function pause() {
    mediaRecorder.pause();
  }

  function resume() {
    mediaRecorder.resume();
  }

  function stop() {
    mediaRecorder.stop();
  }

  return { start, pause, resume, stop };
}
