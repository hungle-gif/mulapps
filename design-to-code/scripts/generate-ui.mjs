/**
 * Generate UI screens from Google Stitch API
 *
 * Usage:
 *   node generate-ui.mjs                          → Generate from screens.json
 *   node generate-ui.mjs --prompt "A login page"  → Generate single screen
 *
 * Prerequisites:
 *   1. cd scripts && npm install
 *   2. STITCH_API_KEY in ../.env
 *
 * Output:
 *   screenshots/stitch/{name}.html   → HTML + Tailwind
 *   screenshots/stitch/{name}.jpg    → Screenshot image
 */

import { StitchToolClient } from "@google/stitch-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        process.env[key] = value;
      }
    }
  }
}

const API_KEY = process.env.STITCH_API_KEY;
if (!API_KEY) {
  console.error("ERROR: STITCH_API_KEY not found in .env");
  process.exit(1);
}

// Output directory
const outputDir = path.join(__dirname, "..", "screenshots", "stitch");
fs.mkdirSync(outputDir, { recursive: true });

// Parse CLI args
const args = process.argv.slice(2);
const singlePrompt = args.includes("--prompt") ? args[args.indexOf("--prompt") + 1] : null;
const projectTitle = args.includes("--project") ? args[args.indexOf("--project") + 1] : "My App";
const deviceType = args.includes("--mobile") ? "MOBILE" : "DESKTOP";

async function downloadFile(url, filepath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
}

async function downloadText(url, filepath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const text = await resp.text();
  fs.writeFileSync(filepath, text, "utf-8");
}

async function generateScreen(client, projectId, name, prompt) {
  console.log(`\n  Generating: ${name}...`);
  console.log(`  Prompt: ${prompt.substring(0, 100)}...`);

  try {
    // Generate screen — SDK returns full response with design + screens
    const result = await client.callTool("generate_screen_from_text", {
      projectId,
      prompt,
      deviceType,
    });

    // Extract screen data from response
    const outputComponents = result.outputComponents || [];
    const designComponent = outputComponents.find((c) => c.design);
    const screens = designComponent?.design?.screens || [];
    const screen = screens[0];

    if (screen) {
      // Download HTML
      const htmlUrl = screen.htmlCode?.downloadUrl;
      if (htmlUrl) {
        await downloadText(htmlUrl, path.join(outputDir, `${name}.html`));
        console.log(`  ✓ ${name}.html saved`);
      }

      // Download screenshot
      const imgUrl = screen.screenshot?.downloadUrl;
      if (imgUrl) {
        await downloadFile(imgUrl, path.join(outputDir, `${name}.jpg`));
        console.log(`  ✓ ${name}.jpg saved`);
      }

      // Save design system (DESIGN.md)
      const designMd = screen.theme?.designMd;
      if (designMd) {
        fs.writeFileSync(path.join(outputDir, `${name}-design.md`), designMd, "utf-8");
        console.log(`  ✓ ${name}-design.md saved`);
      }

      return { name, success: true, title: screen.title };
    }

    console.log(`  ✓ ${name} generated (no downloadable screen found)`);
    return { name, success: true };
  } catch (err) {
    console.error(`  ✗ ${name} failed: ${err.message}`);
    return { name, success: false, error: err.message };
  }
}

async function main() {
  console.log("===========================================");
  console.log("  Google Stitch — UI Generator");
  console.log("===========================================");
  console.log(`  Device: ${deviceType}`);
  console.log(`  Output: ${outputDir}`);

  const client = new StitchToolClient({ apiKey: API_KEY });

  try {
    // Create project
    const project = await client.callTool("create_project", { title: projectTitle });
    const projectFullName = project.name; // "projects/123456"
    const projectId = projectFullName.split("/").pop(); // "123456" — SDK cần ID number
    console.log(`  Project: ${projectId} (${projectTitle})`);

    let results = [];

    if (singlePrompt) {
      const name = args.includes("--name") ? args[args.indexOf("--name") + 1] : "screen";
      results.push(await generateScreen(client, projectId, name, singlePrompt));
    } else {
      // Batch mode
      const screensPath = path.join(__dirname, "screens.json");

      if (!fs.existsSync(screensPath)) {
        console.log("\n  No screens.json found. Creating template...");
        const template = [
          { name: "homepage", prompt: "A modern landing page with hero section, features grid, testimonials, pricing cards, footer. Vietnamese text. Primary color indigo. Dark theme." },
          { name: "login", prompt: "A login page with centered card, email and password inputs, 'Đăng nhập' button, Google OAuth button, 'Quên mật khẩu?' link, 'Đăng ký' link. Vietnamese labels. Primary color indigo." },
        ];
        fs.writeFileSync(screensPath, JSON.stringify(template, null, 2), "utf-8");
        console.log(`  ✓ Template created: ${screensPath}`);
        console.log("  Edit screens.json, then run again.");
        await client.close();
        process.exit(0);
      }

      const screens = JSON.parse(fs.readFileSync(screensPath, "utf-8"));
      console.log(`  Screens: ${screens.length} to generate\n`);

      for (const screen of screens) {
        results.push(await generateScreen(client, projectId, screen.name, screen.prompt));
      }
    }

    // Summary
    console.log("\n===========================================");
    console.log("  Summary");
    console.log("===========================================");
    const success = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`  ✓ Success: ${success}`);
    if (failed > 0) console.log(`  ✗ Failed: ${failed}`);
    console.log(`  Output: ${outputDir}`);
    console.log(`  → Lên stitch.withgoogle.com để xem và duyệt`);
    console.log("===========================================\n");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
