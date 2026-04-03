/**
 * Convert Stitch HTML → React/Next.js Components
 *
 * Usage:
 *   node convert-to-react.mjs                                    → Convert all HTML in screenshots/stitch/
 *   node convert-to-react.mjs --file screenshots/stitch/login.html → Convert 1 file
 *   node convert-to-react.mjs --extract-tokens                   → Only extract design tokens
 *
 * Output:
 *   src/app/[name]/page.tsx            → React pages
 *   src/styles/stitch-tokens.css       → Design tokens extracted
 *   tailwind.config.stitch.ts          → Tailwind config from Stitch
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..");
const STITCH_DIR = path.join(PROJECT_DIR, "screenshots", "stitch");

// --- CLI Args ---
const args = process.argv.slice(2);
const singleFile = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const extractOnly = args.includes("--extract-tokens");
const outputDir = args.includes("--output-dir") ? args[args.indexOf("--output-dir") + 1] : path.join(PROJECT_DIR, "src", "app");

// --- HTML Parser Helpers ---

/**
 * Extract Tailwind config from Stitch HTML
 * Stitch embeds config in <script id="tailwind-config"> or inline <script>
 */
function extractTailwindConfig(html) {
  // Pattern 1: <script id="tailwind-config">
  const configMatch = html.match(/<script[^>]*id=["']tailwind-config["'][^>]*>([\s\S]*?)<\/script>/i);
  if (configMatch) return configMatch[1].trim();

  // Pattern 2: tailwind.config embedded in any script
  const twMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\});/);
  if (twMatch) return `tailwind.config = ${twMatch[1]};`;

  return null;
}

/**
 * Extract Google Fonts links from HTML
 */
function extractFonts(html) {
  const fontLinks = [];
  const regex = /<link[^>]*href=["'](https:\/\/fonts\.googleapis\.com[^"']*?)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    fontLinks.push(match[1]);
  }
  return fontLinks;
}

/**
 * Extract icon library references
 */
function extractIcons(html) {
  const icons = [];
  if (html.includes("material-symbols") || html.includes("Material Symbols")) {
    icons.push("material-symbols");
  }
  if (html.includes("lucide") || html.includes("Lucide")) {
    icons.push("lucide-react");
  }
  if (html.includes("heroicons") || html.includes("Heroicons")) {
    icons.push("@heroicons/react");
  }
  if (html.includes("font-awesome") || html.includes("FontAwesome")) {
    icons.push("@fortawesome/fontawesome");
  }
  return icons;
}

/**
 * Extract <body> content from full HTML
 */
function extractBody(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();

  // If no body tag, try to get content after </head> or after last </script> in head
  const headEnd = html.lastIndexOf("</head>");
  if (headEnd !== -1) {
    let content = html.substring(headEnd + 7).trim();
    content = content.replace(/<\/html>\s*$/i, "").trim();
    return content;
  }

  return html;
}

/**
 * Extract inline <style> blocks
 */
function extractStyles(html) {
  const styles = [];
  const regex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    // Skip Tailwind CDN reset styles
    if (!match[1].includes("tailwindcss")) {
      styles.push(match[1].trim());
    }
  }
  return styles;
}

/**
 * Convert HTML attributes to JSX
 */
function htmlToJsx(html) {
  let jsx = html;

  // class → className
  jsx = jsx.replace(/\bclass=/g, "className=");

  // for → htmlFor
  jsx = jsx.replace(/\bfor=/g, "htmlFor=");

  // Self-closing tags
  jsx = jsx.replace(/<(img|br|hr|input|meta|link)([^>]*?)(?<!\/)>/gi, "<$1$2 />");

  // Style strings → objects (basic conversion)
  // e.g., style="color: red; font-size: 16px" → style={{ color: 'red', fontSize: '16px' }}
  jsx = jsx.replace(/style="([^"]*)"/g, (match, styleStr) => {
    const props = styleStr
      .split(";")
      .filter((s) => s.trim())
      .map((s) => {
        const [key, ...valParts] = s.split(":");
        const val = valParts.join(":").trim();
        const camelKey = key
          .trim()
          .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return `${camelKey}: '${val}'`;
      })
      .join(", ");
    return `style={{ ${props} }}`;
  });

  // tabindex → tabIndex
  jsx = jsx.replace(/\btabindex=/g, "tabIndex=");

  // onclick → onClick, onchange → onChange, etc.
  jsx = jsx.replace(/\bon([a-z]+)=/g, (match, event) => {
    return `on${event.charAt(0).toUpperCase()}${event.slice(1)}=`;
  });

  // colspan → colSpan, rowspan → rowSpan
  jsx = jsx.replace(/\bcolspan=/g, "colSpan=");
  jsx = jsx.replace(/\browspan=/g, "rowSpan=");

  // maxlength → maxLength, minlength → minLength
  jsx = jsx.replace(/\bmaxlength=/g, "maxLength=");
  jsx = jsx.replace(/\bminlength=/g, "minLength=");

  // readonly → readOnly
  jsx = jsx.replace(/\breadonly\b/g, "readOnly");

  // autocomplete → autoComplete
  jsx = jsx.replace(/\bautocomplete=/g, "autoComplete=");

  // Remove HTML comments
  jsx = jsx.replace(/<!--[\s\S]*?-->/g, "");

  // Remove script tags (Stitch embeds Tailwind CDN scripts)
  jsx = jsx.replace(/<script[\s\S]*?<\/script>/gi, "");

  return jsx;
}

/**
 * Generate React page component
 */
function generateReactPage(name, bodyJsx, customStyles) {
  const componentName = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  let styleImport = "";
  if (customStyles.length > 0) {
    styleImport = `import './${name}.css'\n`;
  }

  return `${styleImport}
export default function ${componentName}Page() {
  return (
    <>
${bodyJsx
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
    </>
  )
}
`.trimStart();
}

/**
 * Convert a single HTML file to React
 */
function convertFile(htmlPath, outDir) {
  const filename = path.basename(htmlPath, ".html");
  const html = fs.readFileSync(htmlPath, "utf-8");

  console.log(`  Converting: ${filename}`);

  // Extract parts
  const body = extractBody(html);
  const customStyles = extractStyles(html);
  const jsx = htmlToJsx(body);

  // Create output directory
  const pageDir = path.join(outDir, filename);
  fs.mkdirSync(pageDir, { recursive: true });

  // Write page.tsx
  const pageContent = generateReactPage(filename, jsx, customStyles);
  fs.writeFileSync(path.join(pageDir, "page.tsx"), pageContent, "utf-8");
  console.log(`    ✓ ${filename}/page.tsx`);

  // Write custom CSS if any
  if (customStyles.length > 0) {
    fs.writeFileSync(path.join(pageDir, `${filename}.css`), customStyles.join("\n\n"), "utf-8");
    console.log(`    ✓ ${filename}/${filename}.css`);
  }

  return { name: filename, success: true };
}

/**
 * Extract design tokens from first HTML file (run once per project)
 */
function extractDesignTokens(htmlFiles) {
  if (htmlFiles.length === 0) return;

  const html = fs.readFileSync(htmlFiles[0], "utf-8");

  // Extract Tailwind config
  const twConfig = extractTailwindConfig(html);
  if (twConfig) {
    const tokensDir = path.join(PROJECT_DIR, "src", "styles");
    fs.mkdirSync(tokensDir, { recursive: true });
    fs.writeFileSync(path.join(tokensDir, "tailwind-stitch.js"), twConfig, "utf-8");
    console.log("  ✓ Design tokens: src/styles/tailwind-stitch.js");
  }

  // Extract fonts
  const fonts = extractFonts(html);
  if (fonts.length > 0) {
    console.log("  ✓ Fonts detected:");
    fonts.forEach((f) => console.log(`    ${f}`));
  }

  // Extract icons
  const icons = extractIcons(html);
  if (icons.length > 0) {
    console.log("  ✓ Icon libraries:");
    icons.forEach((i) => console.log(`    npm install ${i}`));
  }

  // Write setup instructions
  const setupMd = `# Stitch Design Setup

## Fonts
${fonts.length > 0 ? fonts.map((f) => `- ${f}`).join("\n") : "No external fonts detected."}

## Icons
${icons.length > 0 ? icons.map((i) => `- \`npm install ${i}\``).join("\n") : "No icon libraries detected."}

## Tailwind Config
${twConfig ? "Extracted to `src/styles/tailwind-stitch.js`. Merge into your `tailwind.config.ts`." : "No embedded Tailwind config found. Use design-brief tokens instead."}
`;
  const tokensDir = path.join(PROJECT_DIR, "src", "styles");
  fs.mkdirSync(tokensDir, { recursive: true });
  fs.writeFileSync(path.join(tokensDir, "SETUP.md"), setupMd, "utf-8");
  console.log("  ✓ Setup guide: src/styles/SETUP.md");
}

// --- Main ---
async function main() {
  console.log("===========================================");
  console.log("  Stitch HTML → React/Next.js Converter");
  console.log("===========================================");

  let htmlFiles = [];

  if (singleFile) {
    const fullPath = path.resolve(singleFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`  ✗ File not found: ${fullPath}`);
      process.exit(1);
    }
    htmlFiles = [fullPath];
  } else {
    if (!fs.existsSync(STITCH_DIR)) {
      console.error(`  ✗ No stitch output found: ${STITCH_DIR}`);
      console.error("    Run 'bash scripts/stitch.sh batch' first.");
      process.exit(1);
    }
    htmlFiles = fs
      .readdirSync(STITCH_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((f) => path.join(STITCH_DIR, f));
  }

  if (htmlFiles.length === 0) {
    console.log("  No HTML files to convert.");
    process.exit(0);
  }

  console.log(`  Found: ${htmlFiles.length} HTML file(s)`);
  console.log(`  Output: ${outputDir}\n`);

  // Step 1: Extract design tokens (always do this)
  console.log("--- Design Tokens ---");
  extractDesignTokens(htmlFiles);

  if (extractOnly) {
    console.log("\n  Done (extract-only mode).");
    process.exit(0);
  }

  // Step 2: Convert each HTML → React
  console.log("\n--- Converting Pages ---");
  const results = [];
  for (const file of htmlFiles) {
    try {
      results.push(convertFile(file, outputDir));
    } catch (err) {
      console.error(`  ✗ ${path.basename(file)}: ${err.message}`);
      results.push({ name: path.basename(file, ".html"), success: false, error: err.message });
    }
  }

  // Summary
  const ok = results.filter((r) => r.success).length;
  const fail = results.filter((r) => !r.success).length;
  console.log("\n===========================================");
  console.log(`  ✓ Converted: ${ok}`);
  if (fail > 0) console.log(`  ✗ Failed: ${fail}`);
  console.log(`  Output: ${outputDir}`);
  console.log("");
  console.log("  Next steps:");
  console.log("  1. Merge design tokens into tailwind.config.ts");
  console.log("  2. Run dev server: npm run dev");
  console.log("  3. Compare each page vs Stitch screenshot");
  console.log("  4. Run: node scripts/visual-test.mjs");
  console.log("===========================================\n");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
