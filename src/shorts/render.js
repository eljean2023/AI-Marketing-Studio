const fs = require('fs');
const os = require('os');
const path = require('path');

const { runFFmpeg, probeDuration, probeSilences } = require('./run-ffmpeg');
const { synthesizeSpeech } = require('./synthesize-speech');
const { buildCaptionCues } = require('./caption-timing');
const { wrapText } = require('./wrap-text');
const { getMusicTrack, getOverlay } = require('./assets');

const WIDTH = 1080;
const HEIGHT = 1920;
const DEFAULT_MUSIC_VOLUME_PERCENT = 60;
// How far music ducks below its base level while narration is speaking.
// -18dB to -24dB is the range that reliably keeps speech intelligible
// without music dropping out audibly; -21dB is the midpoint.
const MUSIC_DUCK_DB = -21;
// Gaps at least this long, at least this much quieter than the narration,
// are treated as real pauses between sentences (restore music), not just
// natural dips within a word.
const SILENCE_NOISE_DB = -30;
const SILENCE_MIN_SECONDS = 0.3;
const FONT_SIZE = 56;
const MAX_CHARS_PER_LINE = 24;

// Windows-specific: a fontfile path containing a drive-letter colon
// (e.g. "C:/Windows/Fonts/...") breaks drawtext's own option parsing --
// confirmed directly, not assumed: the colon is read as a filter-option
// delimiter even when quoted or escaped. The fix is to spawn ffmpeg with
// its cwd set to the font's directory and reference the font by filename
// only. This app has only been built and tested on Windows; a
// cross-platform release would need a per-OS font strategy here.
const FONT_DIR = 'C:/Windows/Fonts';
const FONT_FILE = 'arialbd.ttf';

// FFmpeg drawtext text= values are sensitive to their own filter syntax.
// Backslashes and colons delimit filter options; single quotes delimit the
// value itself. Escaping order matters: backslashes first, then the
// characters that rely on backslash-escaping. Literal newline bytes in the
// value (not the two-character "\n") are what drawtext renders as line
// breaks -- confirmed directly.
function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '\u2019');
}

// Builds a time-varying `volume` expression for the music track: full
// (baseGain) during real silence gaps in the narration -- i.e. between
// sentences -- and ducked (duckGain) everywhere else, i.e. while the
// narration is actually speaking.
function buildMusicVolumeExpr(silences, baseGain, duckGain) {
  let expr = duckGain.toFixed(4);

  silences.forEach(({ start, end }) => {
    expr = `if(between(t,${start.toFixed(3)},${end.toFixed(3)}),${baseGain.toFixed(4)},${expr})`;
  });

  return expr;
}

// True single-frame formats, decoded by ffmpeg's image2 demuxer -- these
// are the only ones "-loop 1" applies to. GIF is intentionally excluded:
// even a static GIF is decoded by ffmpeg's own gif demuxer as a (short)
// video stream, not image2, so it needs "-stream_loop -1" like any other
// video -- "-loop 1" fails outright against it ("Option loop not found"),
// confirmed directly rather than assumed.
const STILL_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

// The overlay is either one of the bundled videos (always looped) or a
// file the user picked from their own PC -- used directly from its
// original location, never copied into the app. Looping strategy is
// decided from the file's actual extension, not the UI's image/video
// preview-tag choice (fileType) -- those two concerns diverge for GIF: it
// displays fine in an <img> tag, but needs the video loop flag in ffmpeg.
function resolveOverlayInput({ overlayId, customOverlay }) {
  if (customOverlay && customOverlay.filePath) {
    if (!fs.existsSync(customOverlay.filePath)) {
      throw new Error('The selected overlay file could not be found. It may have been moved or deleted.');
    }

    const ext = path.extname(customOverlay.filePath).slice(1).toLowerCase();

    return STILL_IMAGE_EXTENSIONS.includes(ext)
      ? ['-loop', '1', '-i', customOverlay.filePath]
      : ['-stream_loop', '-1', '-i', customOverlay.filePath];
  }

  const overlay = getOverlay(overlayId);
  if (!overlay) throw new Error(`Unknown overlay: ${overlayId}`);

  return ['-stream_loop', '-1', '-i', overlay.file];
}

async function renderShort({ scriptText, voiceId, musicTrackId, musicVolume, overlayId, customOverlay, outputPath }) {
  const musicTrack = await getMusicTrack(musicTrackId);
  const overlayInputArgs = resolveOverlayInput({ overlayId, customOverlay });

  if (!musicTrack) throw new Error(`Unknown music track: ${musicTrackId}`);

  const musicVolumePercent = Number.isFinite(musicVolume) ? musicVolume : DEFAULT_MUSIC_VOLUME_PERCENT;
  const baseGain = Math.max(0, Math.min(1, musicVolumePercent / 100));
  const duckGain = baseGain * 10 ** (MUSIC_DUCK_DB / 20);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shorts-'));

  try {
    const narrationPath = await synthesizeSpeech({ text: scriptText, voiceId, outputDir: workDir });
    const narrationDuration = await probeDuration(narrationPath);

    if (!narrationDuration || narrationDuration <= 0) {
      throw new Error('Could not determine narration length. Try a shorter or simpler script.');
    }

    const silences = await probeSilences(narrationPath, {
      noiseDb: SILENCE_NOISE_DB,
      minDurationSeconds: SILENCE_MIN_SECONDS,
    });
    const musicVolumeExpr = buildMusicVolumeExpr(silences, baseGain, duckGain);

    const cues = buildCaptionCues(scriptText, narrationDuration);

    const drawtextFilters = cues.map((cue) => {
      const wrappedText = wrapText(cue.text, MAX_CHARS_PER_LINE).join('\n');

      return `drawtext=fontfile=${FONT_FILE}:text='${escapeDrawtext(wrappedText)}':`
        + `fontsize=${FONT_SIZE}:fontcolor=white:borderw=4:bordercolor=black@0.8:`
        + `x=(w-text_w)/2:y=h-h/4:`
        + `enable='between(t,${cue.start},${cue.end})'`;
    });

    const videoChain = [
      `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
      ...drawtextFilters,
    ].join(',') + '[vout]';

    const filterComplex = [
      videoChain,
      `[1:a]volume=1.0[narration]`,
      `[2:a]volume=eval=frame:volume='${musicVolumeExpr}'[music]`,
      `[narration][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
    ].join(';');

    await runFFmpeg([
      '-y',
      ...overlayInputArgs,
      '-i', narrationPath,
      '-stream_loop', '-1', '-i', musicTrack.file,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '[aout]',
      '-t', String(narrationDuration),
      '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ], { cwd: FONT_DIR });

    return { outputPath, durationSeconds: narrationDuration, cueCount: cues.length };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

// Every segment is rendered by renderShort() with identical encode settings
// (same resolution, codec, pixel format), so joining them is a lossless
// stream-copy concat -- no re-encoding needed.
function buildConcatListFile(filePaths, workDir) {
  const listPath = path.join(workDir, 'concat-list.txt');
  const lines = filePaths.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`);
  fs.writeFileSync(listPath, lines.join('\n'));
  return listPath;
}

async function concatenateSegments(segmentPaths, outputPath) {
  if (!segmentPaths || segmentPaths.length === 0) {
    throw new Error('No approved segments to combine.');
  }

  for (const segmentPath of segmentPaths) {
    if (!fs.existsSync(segmentPath)) {
      throw new Error('One of the approved segment previews is missing. Preview and accept that segment again.');
    }
  }

  if (segmentPaths.length === 1) {
    fs.copyFileSync(segmentPaths[0], outputPath);
  } else {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shorts-concat-'));
    try {
      const listPath = buildConcatListFile(segmentPaths, workDir);
      await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath]);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  const durationSeconds = await probeDuration(outputPath);
  return { outputPath, durationSeconds };
}

module.exports = { renderShort, concatenateSegments };
