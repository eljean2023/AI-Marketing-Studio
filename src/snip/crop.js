function buildCropFilter({ x, y, width, height }) {
  return `crop=${Math.round(width)}:${Math.round(height)}:${Math.round(x)}:${Math.round(y)}`;
}

module.exports = { buildCropFilter };
