/**
 * Render pipeline:
 * 1. Write TSX code to workspace/src/TikTokVideo.tsx
 * 2. Update Root.tsx with correct durationInFrames
 * 3. Copy voiceover.aac to workspace/public/
 * 4. Run: npx remotion render
 * 5. Return output MP4 path
 */
import { execSync } from "child_process";
import { writeFileSync, copyFileSync, existsSync, mkdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { generateAllVoices, mergeAudioToAAC, type VoiceScript, type VoiceTiming } from "./voice.js";
import { nanoid } from "nanoid";

const WORKSPACE = resolve(process.cwd(), "workspace");
const OUTPUT_DIR = resolve(process.cwd(), "output");

export interface RenderRequest {
  code: string;           // Full TikTokVideo.tsx content
  voice_scripts: VoiceScript[];
  output_name?: string;   // Custom filename (e.g. "OpenCode_Review_20260401")
  composition_id?: string;
  width?: number;
  height?: number;
  fps?: number;
}

export interface RenderResult {
  video_path: string;
  duration_seconds: number;
  file_size_bytes: number;
  timing: VoiceTiming;
  render_time_seconds: number;
}

export async function renderVideo(request: RenderRequest): Promise<RenderResult> {
  const startTime = Date.now();
  const jobId = nanoid(8);
  const compositionId = request.composition_id || "TikTokVideo";
  const width = request.width || 1080;
  const height = request.height || 1920;
  const fps = request.fps || 30;

  console.log(`[Render:${jobId}] Starting...`);

  const audioDir = join(WORKSPACE, "audio");
  const publicDir = join(WORKSPACE, "public");
  const srcDir = join(WORKSPACE, "src");

  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  // === STEP 1: Generate voice audio ===
  console.log(`[Render:${jobId}] Step 1/4: Generating voice...`);
  const timing = await generateAllVoices(request.voice_scripts, audioDir);

  // === STEP 2: Merge audio → voiceover.aac ===
  console.log(`[Render:${jobId}] Step 2/4: Merging audio...`);
  const voiceoverPath = join(publicDir, "voiceover.mp3");
  mergeAudioToAAC(request.voice_scripts, audioDir, voiceoverPath);

  // Calculate total duration
  const totalDurationSec = Object.values(timing).reduce((sum, d) => sum + d, 0);
  const totalFrames = Math.ceil(totalDurationSec * fps);

  // === STEP 3: Write code files + AUTO-SYNC TIMING ===
  console.log(`[Render:${jobId}] Step 3/4: Writing code + syncing timing...`);

  // Auto-update timing in TSX code based on real audio durations
  let code = request.code;
  const sceneIds = request.voice_scripts.map((s) => s.id);
  let frameOffset = 0;
  const timingEntries: string[] = [];

  for (let i = 0; i < sceneIds.length; i++) {
    const id = sceneIds[i];
    const durationSec = timing[id] || 5;
    const durationFrames = Math.ceil(durationSec * fps);
    const start = frameOffset;
    const end = frameOffset + durationFrames;
    frameOffset = end;

    // Build timing entry: s1: { start: 0, end: 293 }
    timingEntries.push(`  s${i + 1}: { start: ${start}, end: ${end} }`);
    console.log(`  Timing s${i + 1}: ${start}-${end} (${durationSec}s = ${durationFrames} frames)`);
  }

  // Replace the T = { ... } block in code with real timing
  const timingBlock = `const T = {\n${timingEntries.join(",\n")},\n}`;
  code = code.replace(/const T = \{[\s\S]*?\};/, timingBlock);

  // Unescape backticks from JSON transport (API sends \` which must become `)
  code = code.replace(/\\`/g, "`").replace(/\\\$/g, "$");

  // Write the video component with corrected timing
  writeFileSync(join(srcDir, "TikTokVideo.tsx"), code);

  // Update Root.tsx with correct frame count
  const rootCode = `import { Composition } from "remotion";
import { TikTokVideo } from "./TikTokVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${compositionId}"
      component={TikTokVideo}
      durationInFrames={${totalFrames}}
      fps={${fps}}
      width={${width}}
      height={${height}}
    />
  );
};
`;
  writeFileSync(join(srcDir, "Root.tsx"), rootCode);

  // === STEP 4: Render with Remotion ===
  console.log(`[Render:${jobId}] Step 4/4: Rendering ${totalFrames} frames (${totalDurationSec.toFixed(1)}s @ ${fps}fps)...`);

  const outputFilename = request.output_name ? `${request.output_name}.mp4` : `video_${jobId}.mp4`;
  const outputPath = join(OUTPUT_DIR, outputFilename);

  // Ensure public dir has voiceover — Remotion needs it accessible via staticFile()
  const publicVoiceover = join(WORKSPACE, "public", "voiceover.mp3");
  if (!existsSync(publicVoiceover)) {
    throw new Error("voiceover.aac not found in workspace/public/");
  }

  execSync(
    `npx remotion render src/index.ts ${compositionId} "${outputPath}" --codec h264 --crf 18 --public-dir "${join(WORKSPACE, "public").replace(/\\/g, "/")}"`,
    {
      cwd: WORKSPACE,
      stdio: "pipe",
      timeout: 600000,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
    }
  );

  const fileStat = statSync(outputPath);
  const renderTime = (Date.now() - startTime) / 1000;

  console.log(`[Render:${jobId}] ✅ Done!`);
  console.log(`  File: ${outputPath}`);
  console.log(`  Size: ${(fileStat.size / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  Duration: ${totalDurationSec.toFixed(1)}s`);
  console.log(`  Render time: ${renderTime.toFixed(0)}s`);

  return {
    video_path: outputPath,
    duration_seconds: totalDurationSec,
    file_size_bytes: fileStat.size,
    timing,
    render_time_seconds: renderTime,
  };
}
