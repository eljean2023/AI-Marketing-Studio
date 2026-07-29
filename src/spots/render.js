const fs = require('fs');
const path = require('path');

const { runFFmpeg, probeDuration, probeDimensions, probeHasAudio } = require('./run-ffmpeg');
const { wrapText } = require('./wrap-text');

const WIDTH = 1080;
const HEIGHT = 1920;

// A still image has no intrinsic duration -- there is no trim/timeline UI
// in V1, so a fixed default length is used instead.
const DEFAULT_IMAGE_DURATION_SECONDS = 6;

// Windows-specific: a fontfile path containing a drive-letter colon
// (e.g. "C:/Windows/Fonts/...") breaks drawtext's own option parsing, even
// quoted/escaped -- confirmed in src/shorts/render.js. The fix there (spawn
// ffmpeg with cwd set to the font's directory, reference it by filename
// only) is reused here as-is.
const FONT_DIR = 'C:/Windows/Fonts';
const FONT_FILE = 'arialbd.ttf';

const MAIN_FONT_SIZE = 64;
const MAIN_MAX_CHARS = 20;
const SUPPORTING_FONT_SIZE = 42;
const SUPPORTING_MAX_CHARS = 28;
const CTA_FONT_SIZE = 48;
const CTA_MAX_CHARS = 24;

const LOGO_WIDTH = 180;
const LOGO_MARGIN = 40;

// Background music, when mixed under a video's own existing audio, plays
// at a lower volume so the original audio stays the primary track -- a
// fixed default, no advanced mixing controls in V1.
const MUSIC_DUCK_VOLUME = 0.3;

// True still images decoded by ffmpeg's image2 demuxer -- these are the
// only ones "-loop 1" applies to. gif is deliberately excluded: even a
// static gif is decoded by ffmpeg's own gif demuxer as a (short) video
// stream, not image2, so it needs "-stream_loop -1" like any other video --
// "-loop 1" fails outright against it. Same distinction already established
// in src/shorts/render.js for its overlay picker.
const STILL_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

function resolveBackgroundInput(backgroundPath) {
  if (!fs.existsSync(backgroundPath)) {
    throw new Error('The selected background file could not be found. It may have been moved or deleted.');
  }

  const ext = path.extname(backgroundPath).slice(1).toLowerCase();

  if (STILL_IMAGE_EXTENSIONS.includes(ext)) {
    return ['-loop', '1', '-t', String(DEFAULT_IMAGE_DURATION_SECONDS), '-i', backgroundPath];
  }

  if (ext === 'gif') {
    // An animated gif has no reliable intrinsic "how long should this spot
    // be" duration either (it's usually a very short loop), so it's looped
    // indefinitely and bounded by the same fixed default as a still image.
    return ['-stream_loop', '-1', '-t', String(DEFAULT_IMAGE_DURATION_SECONDS), '-i', backgroundPath];
  }

  return ['-i', backgroundPath];
}

// Same escaping rules as src/shorts/render.js's escapeDrawtext: backslashes
// first, then colons (both are filter-option delimiters), then straight
// quotes replaced with a typographically similar character since drawtext's
// own quote-escaping inside a single-quoted value is unreliable.
function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '\u2019');
}

// Brand Kit stores colors as "#RRGGBB"; ffmpeg's color parser documents
// "0xRRGGBB" as its canonical hex form, so the leading "#" is swapped
// rather than relying on "#" also being accepted.
function toFFmpegColor(hex) {
  return hex.replace(/^#/, '0x');
}

// scale+pad (contain, never crop) can letterbox/pillarbox the background
// significantly for a source whose aspect ratio differs a lot from the
// 1080x1920 target (e.g. a 16:9 photo produces large black bars top and
// bottom). Text positioned as a fraction of the full canvas would land in
// those empty bars instead of over the actual visible image/video -- so
// text is positioned as a fraction of the actual visible content area
// instead, falling back to the full canvas if dimensions can't be probed.
function computeContentBounds(srcDimensions) {
  if (!srcDimensions) {
    return { contentTop: 0, contentHeight: HEIGHT };
  }

  const scale = Math.min(WIDTH / srcDimensions.width, HEIGHT / srcDimensions.height);
  const contentHeight = srcDimensions.height * scale;
  const contentTop = (HEIGHT - contentHeight) / 2;

  return { contentTop, contentHeight };
}

function buildDrawtextFilter({ text, maxChars, fontSize, y, fontColor, borderColor }) {
  const wrapped = wrapText(text, maxChars).join('\n');
  return `drawtext=fontfile=${FONT_FILE}:text='${escapeDrawtext(wrapped)}':`
    + `fontsize=${fontSize}:fontcolor=${fontColor}:borderw=4:bordercolor=${borderColor}:`
    + `x=(w-text_w)/2:y=${y}`;
}

function buildTextFilters({ mainMessage, supportingText, cta, primaryColor, contentTop, contentHeight }) {
  const filters = [
    buildDrawtextFilter({
      text: mainMessage,
      maxChars: MAIN_MAX_CHARS,
      fontSize: MAIN_FONT_SIZE,
      y: Math.round(contentTop + contentHeight * 0.12),
      fontColor: 'white',
      borderColor: 'black@0.8',
    }),
  ];

  if (supportingText && supportingText.trim()) {
    filters.push(buildDrawtextFilter({
      text: supportingText,
      maxChars: SUPPORTING_MAX_CHARS,
      fontSize: SUPPORTING_FONT_SIZE,
      y: Math.round(contentTop + contentHeight * 0.32),
      fontColor: 'white',
      borderColor: 'black@0.8',
    }));
  }

  if (cta && cta.trim()) {
    filters.push(buildDrawtextFilter({
      text: cta,
      maxChars: CTA_MAX_CHARS,
      fontSize: CTA_FONT_SIZE,
      y: Math.round(contentTop + contentHeight * 0.80),
      // CTA is styled with the business's own primary brand color -- a
      // white border keeps it legible even against the default unset
      // black, though a true contrast calculation is out of scope for V1.
      fontColor: toFFmpegColor(primaryColor || '#ffffff'),
      borderColor: 'white@0.9',
    }));
  }

  return filters;
}

async function renderSpot({
  backgroundPath,
  backgroundType,
  mainMessage,
  supportingText,
  cta,
  logoPath,
  primaryColor,
  musicPath,
  outputPath,
}) {
  const backgroundArgs = resolveBackgroundInput(backgroundPath);
  const hasLogo = Boolean(logoPath) && fs.existsSync(logoPath);
  const hasMusic = Boolean(musicPath) && fs.existsSync(musicPath);

  // Background is always input 0; logo and music (either may be absent)
  // are appended after it, so their input indices are tracked dynamically
  // rather than hardcoded.
  const inputs = [...backgroundArgs];
  let nextInputIndex = 1;

  let logoInputIndex = null;
  if (hasLogo) {
    inputs.push('-loop', '1', '-i', logoPath);
    logoInputIndex = nextInputIndex++;
  }

  let musicInputIndex = null;
  if (hasMusic) {
    // Looped indefinitely (it has no relationship to the background's own
    // duration) and bounded by the global -shortest flag below -- same
    // "unbounded auxiliary stream needs an explicit stop" fix already
    // required for the logo overlay.
    inputs.push('-stream_loop', '-1', '-i', musicPath);
    musicInputIndex = nextInputIndex++;
  }

  const padFilter = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

  const videoChainParts = [`[0:v]${padFilter}[bg]`];
  let lastLabel = '[bg]';

  if (hasLogo) {
    // logoArgs loops the logo indefinitely (it's a still image with no
    // inherent duration of its own) -- without shortest=1, overlay's
    // default eof_action=repeat would keep running off the infinite logo
    // stream even after the background ends, hanging the whole render.
    videoChainParts.push(`[${logoInputIndex}:v]scale=${LOGO_WIDTH}:-1[logo]`);
    videoChainParts.push(`[bg][logo]overlay=W-w-${LOGO_MARGIN}:${LOGO_MARGIN}:shortest=1[composited]`);
    lastLabel = '[composited]';
  }

  const srcDimensions = await probeDimensions(backgroundPath);
  const { contentTop, contentHeight } = computeContentBounds(srcDimensions);

  const textFilterChain = buildTextFilters({
    mainMessage, supportingText, cta, primaryColor, contentTop, contentHeight,
  }).join(',');

  const hasBackgroundAudio = backgroundType === 'video' && await probeHasAudio(backgroundPath);

  // When music is involved, the global -shortest flag has proven unreliable
  // in testing: combined with an indefinitely-looped music input it caused
  // ffmpeg to either truncate the output early (amix duration=first already
  // bounds that case correctly on its own) or, worse, stall the filter
  // graph entirely (reproduced directly with a looped gif background +
  // looped music together -- zero frames ever encoded, eventually erroring
  // out). An explicit global -t bound, using the background's own
  // known/probed duration, replaces -shortest entirely and was confirmed to
  // fix every case tested (image, gif, silent video, video with audio).
  let musicDurationBound = null;
  if (hasMusic) {
    musicDurationBound = backgroundType === 'image'
      ? DEFAULT_IMAGE_DURATION_SECONDS
      : await probeDuration(backgroundPath);
  }

  const audioFilterParts = [];
  let audioMapArg = null;

  if (hasMusic && hasBackgroundAudio) {
    // Keep the background video's own audio as the primary track, with
    // music mixed in underneath at a lower volume.
    audioFilterParts.push(`[0:a]volume=1.0[bgaudio]`);
    audioFilterParts.push(`[${musicInputIndex}:a]volume=${MUSIC_DUCK_VOLUME}[music]`);
    audioFilterParts.push(`[bgaudio][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
    audioMapArg = '[aout]';
  } else if (hasMusic) {
    // No existing audio to preserve (image/gif/silent video) -- the chosen
    // music becomes the sole audio track, at its normal volume.
    audioFilterParts.push(`[${musicInputIndex}:a]volume=1.0[aout]`);
    audioMapArg = '[aout]';
  } else if (hasBackgroundAudio) {
    audioMapArg = '0:a';
  }

  const filterComplex = [
    ...videoChainParts,
    `${lastLabel}${textFilterChain}[vout]`,
    ...audioFilterParts,
  ].join(';');

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
  ];

  if (audioMapArg) {
    args.push('-map', audioMapArg, '-c:a', 'aac', '-b:a', '192k');
  }

  if (musicDurationBound) {
    args.push('-t', String(musicDurationBound));
  }

  args.push(
    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  );

  await runFFmpeg(args, { cwd: FONT_DIR });

  const durationSeconds = backgroundType === 'image'
    ? DEFAULT_IMAGE_DURATION_SECONDS
    : await probeDuration(outputPath);

  return { outputPath, durationSeconds };
}

module.exports = { renderSpot };
