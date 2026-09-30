import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const bmsDir = path.join(distDir, "bms");

if (fs.existsSync(distDir)) {
  fs.mkdirSync(bmsDir, { recursive: true });

  // Copy assets to /bms/assets
  const assetsSrc = path.join(distDir, "assets");
  const assetsDest = path.join(bmsDir, "assets");
  if (fs.existsSync(assetsSrc)) {
    fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  }

  // Copy index.html to /bms/index.html
  const indexSrc = path.join(distDir, "index.html");
  const indexDest = path.join(bmsDir, "index.html");
  if (fs.existsSync(indexSrc)) {
    fs.copyFileSync(indexSrc, indexDest);
  }

  // Copy images, favicons, etc. to /bms/
  for (const file of fs.readdirSync(distDir)) {
    if (file !== "bms" && !fs.statSync(path.join(distDir, file)).isDirectory()) {
      fs.copyFileSync(path.join(distDir, file), path.join(bmsDir, file));
    }
  }

  console.log("✓ Postbuild: mirrored dist/ to dist/bms/ for Netlify routing compatibility");
}
