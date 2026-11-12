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
