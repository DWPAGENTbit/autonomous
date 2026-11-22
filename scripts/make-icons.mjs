// Generates every app icon (web/PWA and Android) from one logo file.
// Usage: node scripts/make-icons.mjs [path/to/logo.png|svg]   (default: src/app/icon.svg)
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const src = process.argv[2] ?? "src/app/icon.svg";
const BG = { r: 255, g: 255, b: 255, alpha: 1 };
/** Launch screen colour: the warm canvas of the app. */
const SPLASH_BG = { r: 233, g: 227, b: 220, alpha: 1 };

/** The logo on a white square, scaled to `scale` of the canvas. */
async function tile(size, scale, out, { round = false, transparent = false } = {}) {
  const inner = Math.round(size * scale);
  const logo = await sharp(src, { density: 600 }).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  let img = sharp({ create: { width: size, height: size, channels: 4, background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : BG } }).composite([
    { input: logo, gravity: "center" },
  ]);
  if (round) {
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: "dest-in" }]);
  }
  mkdirSync(dirname(out), { recursive: true });
  await img.png().toFile(out);
}

// Web / PWA
await tile(192, 0.78, "public/icons/icon-192.png");
await tile(512, 0.78, "public/icons/icon-512.png");
await tile(512, 0.62, "public/icons/maskable-512.png");
await tile(180, 0.78, "public/icons/apple-touch-icon.png");

// Android (only when the native project exists)
const res = "mobile/android/app/src/main/res";
if (existsSync(res)) {
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, px] of Object.entries(densities)) {
    await tile(px, 0.8, join(res, `mipmap-${d}`, "ic_launcher.png"));
    await tile(px, 0.8, join(res, `mipmap-${d}`, "ic_launcher_round.png"), { round: true });
    // Adaptive icon foreground: 108dp canvas, logo inside the 66dp safe zone.
    await tile(Math.round(px * 2.25), 0.5, join(res, `mipmap-${d}`, "ic_launcher_foreground.png"), { transparent: true });
  }
  // Launch screen: logo centred on the warm canvas.
  const splash = { "drawable": [480, 320], "drawable-port-mdpi": [320, 480], "drawable-port-hdpi": [480, 800], "drawable-port-xhdpi": [720, 1280], "drawable-port-xxhdpi": [960, 1600], "drawable-port-xxxhdpi": [1280, 1920], "drawable-land-mdpi": [480, 320], "drawable-land-hdpi": [800, 480], "drawable-land-xhdpi": [1280, 720], "drawable-land-xxhdpi": [1600, 960], "drawable-land-xxxhdpi": [1920, 1280] };
  for (const [folder, [w, h]] of Object.entries(splash)) {
    const dir = join(res, folder);
    if (!existsSync(dir)) continue;
    const s = Math.round(Math.min(w, h) * 0.32);
    const logo = await sharp(src, { density: 600 }).resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp({ create: { width: w, height: h, channels: 4, background: SPLASH_BG } }).composite([{ input: logo, gravity: "center" }]).png().toFile(join(dir, "splash.png"));
  }
}
console.log("icons generated from", src);
