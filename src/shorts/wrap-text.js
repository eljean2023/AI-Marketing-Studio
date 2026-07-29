// Greedy word-wrap into lines that fit within maxCharsPerLine. drawtext has
// no built-in auto-wrap, so caption text has to be pre-broken into explicit
// lines before it's handed to the filter.
function wrapText(text, maxCharsPerLine) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);

  return lines;
}

module.exports = { wrapText };
