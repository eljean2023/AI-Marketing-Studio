const MAX_WORDS_PER_CUE = 3;
const MIN_CUE_SECONDS = 0.6;

// Groups the script into short caption bursts (a few words each, matching
// how short-form captions are actually displayed -- not full sentences),
// then distributes the known total narration duration across them
// proportionally to each cue's character count. This is a heuristic, not
// real speech alignment: it won't match natural pauses or emphasis, but it
// requires no extra model or service, keeping this a "Lite" tool.
function buildCaptionCues(scriptText, totalDurationSeconds) {
  const words = scriptText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || totalDurationSeconds <= 0) return [];

  const cues = [];
  for (let i = 0; i < words.length; i += MAX_WORDS_PER_CUE) {
    cues.push(words.slice(i, i + MAX_WORDS_PER_CUE).join(' '));
  }

  const totalChars = cues.reduce((sum, cue) => sum + cue.length, 0);

  const rawDurations = cues.map((cue) => {
    const share = totalChars > 0 ? (cue.length / totalChars) * totalDurationSeconds : 0;
    return Math.max(MIN_CUE_SECONDS, share);
  });

  // The MIN_CUE_SECONDS floor can make raw durations sum to more than the
  // actual narration length (many short cues). Scale back down so cues
  // never run past the end of the audio.
  const rawTotal = rawDurations.reduce((sum, d) => sum + d, 0);
  const scale = rawTotal > totalDurationSeconds ? totalDurationSeconds / rawTotal : 1;

  let cursor = 0;
  return cues.map((text, index) => {
    const duration = rawDurations[index] * scale;
    const start = cursor;
    const end = Math.min(totalDurationSeconds, cursor + duration);
    cursor = end;
    return { text, start, end };
  });
}

module.exports = { buildCaptionCues };
