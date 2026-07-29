export function clampEdit(edit, duration) {
  const trimStart = Math.max(0, Math.min(edit.trimStart, duration));
  const trimEnd = Math.max(trimStart, Math.min(edit.trimEnd, duration));

  let deleteSegment = null;
  if (edit.deleteSegment) {
    const start = Math.max(trimStart, Math.min(edit.deleteSegment.start, trimEnd));
    const end = Math.max(start, Math.min(edit.deleteSegment.end, trimEnd));
    if (end > start) deleteSegment = { start, end };
  }

  return { trimStart, trimEnd, deleteSegment };
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}
