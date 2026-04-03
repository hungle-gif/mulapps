/**
 * Visual Regression Test — So sánh Stitch screenshot vs React render
 *
 * Usage:
 *   node visual-test.mjs                          → Test all pages
 *   node visual-test.mjs --page login              → Test 1 page
 *   node visual-test.mjs --url http://localhost:3000 → Custom dev server URL
 *
 * Prerequisites:
 *   npm install playwright pixelmatch pngjs
 *   Dev server running (npm run dev)
 *
 * Output:
 *   screenshots/compare/
 *   ├── [name]-stitch.png      ← Stitch original (converted from jpg)
 *   ├── [name]-react.png       ← React rendered screenshot
 *   ├── [name]-diff.png        ← Difference highlighted in red
 *   └── report.json            ← Match percentage per page
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..");
const STITCH_DIR = path.join(PROJECT_DIR, "screenshots", "stitch");
const COMPARE_DIR = path.join(PROJECT_DIR, "screenshots", "compare");

// CLI args
const args = process.argv.slice(2);
const singlePage = args.includes("--page") ? args[args.indexOf("--page") + 1] : null;
const baseUrl = args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://localhost:3000";
const threshold = args.includes("--threshold") ? parseFloat(args[args.indexOf("--threshold") + 1]) : 0.1;

async function loadDeps() {
  try {
    const { chromium } = await import("playwright");
    const { default: pixelmatch } = await import("pixelmatch");
    const { PNG } = await import("pngjs");
    return { chromium, pixelmatch, PNG };
  } catch (err) {
    console.error("Missing dependencies. Install:");
    console.error("  npm install playwright pixelmatch pngjs");
    console.error("  npx playwright install chromium");
    process.exit(1);
  }
}

/**
 * Take screenshot of a URL
 */
async function screenshotUrl(browser, url, outputPath, viewport = { width: 1920, height: 1080 }) {
  const page = await browser.newPage();
  await page.setViewportSize(viewport);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    // Wait for fonts and images
    await page.waitForTimeout(1000);
    await page.screenshot({ path: outputPath, fullPage: true });
  } finally {
    await page.close();
  }
}

/**
 * Take screenshot of a local HTML file
 */
async function screenshotHtml(browser, htmlPath, outputPath, viewport = { width: 1920, height: 1080 }) {
  const page = await browser.newPage();
  await page.setViewportSize(viewport);

  try {
    const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: outputPath, fullPage: true });
  } finally {
    await page.close();
  }
}

/**
 * Compare two PNG images and generate diff
 */
function compareImages(img1Path, img2Path, diffPath, deps) {
  const { pixelmatch, PNG } = deps;

  const img1 = PNG.sync.read(fs.readFileSync(img1Path));
  const img2 = PNG.sync.read(fs.readFileSync(img2Path));

  // Resize to same dimensions (use larger)
  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  // Create canvases of same size
  const canvas1 = new PNG({ width, height });
  const canvas2 = new PNG({ width, height });

  // Copy image data (pad smaller image with white)
  PNG.bitblt(img1, canvas1, 0, 0, Math.min(img1.width, width), Math.min(img1.height, height), 0, 0);
  PNG.bitblt(img2, canvas2, 0, 0, Math.min(img2.width, width), Math.min(img2.height, height), 0, 0);

  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(canvas1.data, canvas2.data, diff.data, width, height, {
    threshold,
    includeAA: false,
    diffColor: [255, 0, 0], // Red for differences
    diffColorAlt: [0, 255, 0], // Green for anti-aliased
  });

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const matchPercent = ((1 - mismatchedPixels / totalPixels) * 100).toFixed(2);

  return {
    width,
    height,
    totalPixels,
    mismatchedPixels,
    matchPercent: parseFloat(matchPercent),
  };
}

async function main() {
  console.log("===========================================");
  console.log("  Visual Regression Test");
  console.log("  Stitch vs React Comparison");
  console.log("===========================================");
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Threshold: ${threshold}`);

  const deps = await loadDeps();
  const { chromium } = deps;

  fs.mkdirSync(COMPARE_DIR, { recursive: true });

  // Find Stitch HTML files
  let htmlFiles = [];
  if (singlePage) {
    const htmlPath = path.join(STITCH_DIR, `${singlePage}.html`);
    if (fs.existsSync(htmlPath)) {
      htmlFiles = [htmlPath];
    } else {
      console.error(`  ✗ Not found: ${htmlPath}`);
      process.exit(1);
    }
  } else {
    if (!fs.existsSync(STITCH_DIR)) {
      console.error(`  ✗ No stitch output: ${STITCH_DIR}`);
      process.exit(1);
    }
    htmlFiles = fs
      .readdirSync(STITCH_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((f) => path.join(STITCH_DIR, f));
  }

  if (htmlFiles.length === 0) {
    console.log("  No HTML files to test.");
    process.exit(0);
  }

  console.log(`  Pages to test: ${htmlFiles.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const htmlFile of htmlFiles) {
    const name = path.basename(htmlFile, ".html");
    console.log(`  Testing: ${name}`);

    const stitchPng = path.join(COMPARE_DIR, `${name}-stitch.png`);
    const reactPng = path.join(COMPARE_DIR, `${name}-react.png`);
    const diffPng = path.join(COMPARE_DIR, `${name}-diff.png`);

    try {
      // Screenshot Stitch HTML
      await screenshotHtml(browser, htmlFile, stitchPng);
      console.log(`    ✓ Stitch screenshot`);

      // Screenshot React page
      const reactUrl = name === "homepage" || name === "home" ? baseUrl : `${baseUrl}/${name}`;
      await screenshotUrl(browser, reactUrl, reactPng);
      console.log(`    ✓ React screenshot`);

      // Compare
      const result = compareImages(stitchPng, reactPng, diffPng, deps);
      console.log(`    → Match: ${result.matchPercent}% (${result.mismatchedPixels} pixels differ)`);

      if (result.matchPercent >= 95) {
        console.log(`    ✓ PASS`);
      } else if (result.matchPercent >= 85) {
        console.log(`    ⚠ WARN — review ${name}-diff.png`);
      } else {
        console.log(`    ✗ FAIL — significant differences`);
      }

      results.push({ name, ...result, status: result.matchPercent >= 95 ? "pass" : result.matchPercent >= 85 ? "warn" : "fail" });
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
      results.push({ name, error: err.message, status: "error" });
    }
  }

  await browser.close();

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    threshold,
    results,
    summary: {
      total: results.length,
      pass: results.filter((r) => r.status === "pass").length,
      warn: results.filter((r) => r.status === "warn").length,
      fail: results.filter((r) => r.status === "fail").length,
      error: results.filter((r) => r.status === "error").length,
    },
  };

  fs.writeFileSync(path.join(COMPARE_DIR, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  // Summary
  console.log("\n===========================================");
  console.log("  Summary");
  console.log("===========================================");
  console.log(`  ✓ Pass (≥95%):  ${report.summary.pass}`);
  console.log(`  ⚠ Warn (85-95%): ${report.summary.warn}`);
  console.log(`  ✗ Fail (<85%):   ${report.summary.fail}`);
  console.log(`  ✗ Error:         ${report.summary.error}`);
  console.log(`  Output: ${COMPARE_DIR}`);
  console.log("===========================================\n");

  // Exit code: non-zero if any fail
  if (report.summary.fail > 0 || report.summary.error > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
