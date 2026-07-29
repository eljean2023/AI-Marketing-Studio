const { runFFmpeg, probeHasAudio } = require('./run-ffmpeg');
const { cutVideo } = require('./cut');
const { buildCropFilter } = require('./crop');
const { computeKeepRanges } = require('./remove-segments');

async function processVideo({ inputPath, outputPath, start, end, crop, removeSegments, onProgress = () => {} }) {
  const hasRemoveSegments = Array.isArray(removeSegments) && removeSegments.length > 0;
  const reportCutting = (percent) => onProgress({ phase: 'cutting', percent });

  if (!hasRemoveSegments) {
    if (!crop) {
      return cutVideo({ inputPath, outputPath, start, end, onProgress });
    }

    // Cropping always requires decoding (pixels have to be read to be
    // discarded), so once a crop is present there is no stream-copy path.
    // Trim and crop are applied in a single re-encode pass, in that order
    // (trim, then crop), so no intermediate file is ever written.
    const cropFilter = buildCropFilter(crop);
    const totalDurationSeconds = end - start;

    await runFFmpeg([
      '-y',
      '-i', inputPath,
      '-ss', String(start),
      '-to', String(end),
      '-vf', cropFilter,
      '-c:v', 'libx264',
      '-crf', '16',
      '-preset', 'medium',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-progress', 'pipe:1',
      outputPath,
    ], { onProgress: reportCutting, totalDurationSeconds });

    return { reencoded: true };
  }

  // Multi Segment Remove: trim start/end still define the overall bounds,
  // removeSegments carve additional gaps out of that range. The remaining
  // pieces are trimmed and concatenated in one filter_complex pass, with
  // crop (if present) applied to the concatenated result -- matching the
  // established order: Time Trim -> Video Crop -> Export.
  const keepRanges = computeKeepRanges({ trimStart: start, trimEnd: end, removeSegments });

  if (keepRanges.length === 0) {
    throw new Error('The selected removals eliminate the entire video. Adjust your segments.');
  }

  const hasAudio = await probeHasAudio(inputPath);

  const parts = [];
  keepRanges.forEach((range, index) => {
    parts.push(`[0:v]trim=start=${range.start}:end=${range.end},setpts=PTS-STARTPTS[v${index}]`);
    if (hasAudio) {
      parts.push(`[0:a]atrim=start=${range.start}:end=${range.end},asetpts=PTS-STARTPTS[a${index}]`);
    }
  });

  if (hasAudio) {
    const concatInputs = keepRanges.map((_, index) => `[v${index}][a${index}]`).join('');
    parts.push(`${concatInputs}concat=n=${keepRanges.length}:v=1:a=1[vcat][aout]`);
  } else {
    const concatInputs = keepRanges.map((_, index) => `[v${index}]`).join('');
    parts.push(`${concatInputs}concat=n=${keepRanges.length}:v=1:a=0[vcat]`);
  }

  let videoMap = '[vcat]';
  if (crop) {
    const cropFilter = buildCropFilter(crop);
    parts.push(`[vcat]${cropFilter}[vout]`);
    videoMap = '[vout]';
  }

  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex', parts.join(';'),
    '-map', videoMap,
  ];

  if (hasAudio) {
    args.push('-map', '[aout]');
  }

  args.push('-c:v', 'libx264', '-crf', '16', '-preset', 'medium');

  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '192k');
  }

  args.push('-progress', 'pipe:1', outputPath);

  const totalDurationSeconds = keepRanges.reduce((sum, range) => sum + (range.end - range.start), 0);

  await runFFmpeg(args, { onProgress: reportCutting, totalDurationSeconds });

  return { reencoded: true, segmentCount: keepRanges.length };
}

module.exports = { processVideo };
