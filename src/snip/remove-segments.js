const MIN_RANGE_SECONDS = 0.05;

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

// Given the segments the user marked for removal, computes the KEEP ranges
// (the complement) that the export pipeline actually cuts and concatenates.
// This is the authoritative ripple-delete math -- the renderer never needs
// to duplicate it correctly, only the export result has to be right.
function computeKeepRanges({ trimStart, trimEnd, removeSegments }) {
  const clamped = removeSegments
    .map((segment) => ({
      start: Math.max(trimStart, Math.min(segment.start, trimEnd)),
      end: Math.max(trimStart, Math.min(segment.end, trimEnd)),
    }))
    .filter((segment) => segment.end - segment.start > MIN_RANGE_SECONDS);

  const merged = mergeRanges(clamped);

  const keepRanges = [];
  let cursor = trimStart;

  for (const removed of merged) {
    if (removed.start - cursor > MIN_RANGE_SECONDS) {
      keepRanges.push({ start: cursor, end: removed.start });
    }
    cursor = Math.max(cursor, removed.end);
  }

  if (trimEnd - cursor > MIN_RANGE_SECONDS) {
    keepRanges.push({ start: cursor, end: trimEnd });
  }

  return keepRanges;
}

module.exports = { mergeRanges, computeKeepRanges };
