// node scripts/generate-icons.js
const sharp = require("sharp");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");

// 512x512 SVG — 다크 배경 + 화이트 심볼
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f1115"/>
  <path fill="white" d="M249.1,117.9c-34.52,115.08-80.56,207.14-138.1,276.19,46.03-34.52,74.8-57.54,86.31-69.05,23.02-34.52,40.28-63.29,51.79-86.31v-120.83Z"/>
  <path fill="white" d="M262.9,117.9c34.52,115.08,80.56,207.14,138.1,276.19-46.03-34.52,-74.8-57.54,-86.31-69.05-23.02-34.52,-40.28-63.29,-51.79-86.31v-120.83Z"/>
</svg>`;

const sizes = [
  { file: "icon-512x512.png",     size: 512 },
  { file: "icon-192x192.png",     size: 192 },
  { file: "apple-touch-icon.png", size: 180 },
];

(async () => {
  const buf = Buffer.from(svg);
  for (const { file, size } of sizes) {
    await sharp(buf).resize(size, size).png().toFile(path.join(publicDir, file));
    console.log(`✓ ${file} (${size}×${size})`);
  }
  console.log("Done.");
})().catch(e => { console.error(e); process.exit(1); });
