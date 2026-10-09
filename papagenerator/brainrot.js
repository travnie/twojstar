// Brainrot math. Small and contained; the actual UI remains readable.
export const skibidiClamp = (n, low, high) => Math.min(high, Math.max(low, n));
export const yeetIntoFrame = (layer, w, h) => ({
  ...layer,
  x: skibidiClamp(layer.x, -layer.size * 0.5, w + layer.size * 0.5),
  y: skibidiClamp(layer.y, -layer.size * 0.5, h + layer.size * 0.5)
});
export const certifiedRizz = (angle) => ((angle % 360) + 360) % 360;
export const sigmaDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
