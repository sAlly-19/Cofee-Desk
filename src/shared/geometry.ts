export function normalizedPoint(
  bounds: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
) {
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height, x, y].every(
      Number.isFinite,
    ) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  )
    return null;
  return {
    x: Math.round(bounds.x + x * (bounds.width - 1)),
    y: Math.round(bounds.y + y * (bounds.height - 1)),
  };
}

export function videoPoint(
  rect: { left: number; top: number; width: number; height: number },
  videoWidth: number,
  videoHeight: number,
  clientX: number,
  clientY: number,
) {
  if (
    ![
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      videoWidth,
      videoHeight,
      clientX,
      clientY,
    ].every(Number.isFinite) ||
    Math.min(rect.width, rect.height, videoWidth, videoHeight) <= 0
  )
    return null;
  const scale = Math.min(rect.width / videoWidth, rect.height / videoHeight),
    width = videoWidth * scale,
    height = videoHeight * scale;
  const x = clientX - rect.left - (rect.width - width) / 2,
    y = clientY - rect.top - (rect.height - height) / 2;
  if (x < 0 || y < 0 || x > width || y > height) return null;
  const normX = x / width,
    normY = y / height;
  return {
    normX,
    normY,
    pixelX: Math.round(normX * (videoWidth - 1)),
    pixelY: Math.round(normY * (videoHeight - 1)),
  };
}
