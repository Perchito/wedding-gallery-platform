// One-off generator for placeholder PWA app icons (blush square + gold ring +
// "M&G" monogram-ish mark). Run with `node scripts/gen-icons.mjs`.
// Not part of the app runtime — output PNGs are committed to public/.
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BG = hexToRgb("#b5615f");
const RING = hexToRgb("#e9d4b3");
const MARK = hexToRgb("#fffaf6");

function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * 0.42;
  const ringW = size * 0.035;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let [r, g, b] = BG;

      // Gold ring
      if (Math.abs(dist - ringR) < ringW) {
        [r, g, b] = RING;
      }

      // Simple heart-ish mark in the center using two circles + triangle approx
      const heartScale = size * 0.16;
      const lx = (dx + heartScale * 0.5) / heartScale;
      const ly = (dy - heartScale * 0.15) / heartScale;
      const rx = (dx - heartScale * 0.5) / heartScale;
      const ry = (dy - heartScale * 0.15) / heartScale;
      const inLeftLobe = lx * lx + ly * ly < 0.42;
      const inRightLobe = rx * rx + ry * ry < 0.42;
      const inTriangle =
        Math.abs(dx) < heartScale * 1.05 &&
        dy > -heartScale * 0.1 &&
        dy < heartScale * 1.1 &&
        Math.abs(dx) < (heartScale * 1.2 - dy * 0.75);

      if (inLeftLobe || inRightLobe || inTriangle) {
        [r, g, b] = MARK;
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

writeFileSync("public/icon-192.png", drawIcon(192));
writeFileSync("public/icon-512.png", drawIcon(512));
console.log("Generated public/icon-192.png and public/icon-512.png");
