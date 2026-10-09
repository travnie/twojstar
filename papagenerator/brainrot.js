// Brainrot math. Small and contained; the actual UI remains readable.
export const skibidiClamp = (n, low, high) => Math.min(high, Math.max(low, n));
export const yeetIntoFrame = (layer, w, h) => {
  const marginX = Math.min(16, w / 2);
  const marginY = Math.min(16, h / 2);
  return {
    ...layer,
    x: skibidiClamp(layer.x, marginX, w - marginX),
    y: skibidiClamp(layer.y, marginY, h - marginY)
  };
};
export const certifiedRizz = (angle) => ((angle % 360) + 360) % 360;
export const sigmaDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
