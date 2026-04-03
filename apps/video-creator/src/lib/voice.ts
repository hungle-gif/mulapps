/**
 * Voice generation using FPT.AI TTS (primary) + Edge-TTS (fallback)
 * FPT.AI: giọng Bắc chất lượng cao (leminh, banmai, giahuy, thuminh)
 */
import { execSync } from "child_process";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync, statSync } from "fs";

export interface VoiceScript {
  id: string;
  text: string;
  voice?: string;   // FPT: leminh, banmai, giahuy | Edge: vi-VN-NamMinhNeural
  rate?: string;     // Edge: "+5%" | FPT: speed header "-1", "0", "1"
  pitch?: string;    // Edge only
  engine?: "fpt" | "edge"; // Default: fpt
}

export interface VoiceTiming {
  [sceneId: string]: number;
}

// FPT.AI Config
const FPT_API_KEY = "b0YnT1B4M7XBSv9hsfhRjO6CcRAa2xla";
const FPT_API_URL = "https://api.fpt.ai/hmi/tts/v5";

/**
 * Generate voice with FPT.AI — giọng Bắc trầm ấm
 */
async function generateFPT(
  text: string,
  outputPath: string,
  voice: string = "leminh",
  speed: string = "0"
): Promise<void> {
  // Call FPT API
  const response = await fetch(FPT_API_URL, {
    method: "POST",
    headers: {
      "api-key": FPT_API_KEY,
      "voice": voice,
      "speed": speed,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: text,
  });

  const result = await response.json() as { async: string; error: number };

  if (result.error !== 0 || !result.async) {
    throw new Error(`FPT.AI error: ${JSON.stringify(result)}`);
  }

  // Wait for audio to be ready, then download
  const audioUrl = result.async;
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    await sleep(2000); // FPT needs time to generate
    try {
      const audioRes = await fetch(audioUrl);
      if (audioRes.ok) {
        const buffer = Buffer.from(await audioRes.arrayBuffer());
        if (buffer.length > 1000) { // Valid audio file
          writeFileSync(outputPath, buffer);
          return;
        }
      }
    } catch {}
    retries++;
  }

  throw new Error(`FPT.AI: Failed to download audio after ${maxRetries} retries`);
}

/**
 * Generate voice with Edge-TTS (fallback)
 */
function generateEdge(
  text: string,
  outputPath: string,
  voice: string = "vi-VN-NamMinhNeural",
  rate: string = "+0%",
  pitch: string = "+0Hz"
): void {
  execSync(
    `edge-tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text "${text.replace(/"/g, '\\"')}" --write-media "${outputPath.replace(/\\/g, "/")}"`,
    { stdio: "pipe", timeout: 30000 }
  );
}

/**
 * Generate all voice clips for all scenes
 */
export async function generateAllVoices(
  scripts: VoiceScript[],
  audioDir: string
): Promise<VoiceTiming> {
  if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });

  const timing: VoiceTiming = {};

  for (const scene of scripts) {
    const engine = scene.engine || "fpt";
    const outputFile = join(audioDir, `${scene.id}.mp3`);

    console.log(`[Voice/${engine.toUpperCase()}] Generating: ${scene.id}...`);

    try {
      if (engine === "fpt") {
        await generateFPT(
          scene.text,
          outputFile,
          scene.voice || "leminh",
          scene.rate || "0"
        );
      } else {
        generateEdge(
          scene.text,
          outputFile,
          scene.voice || "vi-VN-NamMinhNeural",
          scene.rate || "+0%",
          scene.pitch || "+0Hz"
        );
      }
    } catch (error) {
      console.log(`  [${engine}] Failed, falling back to Edge-TTS...`);
      generateEdge(scene.text, outputFile);
    }

    // Get precise duration via ffprobe
    let duration: number;
    try {
      const result = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${outputFile}"`,
        { encoding: "utf-8", timeout: 10000 }
      ).trim();
      duration = parseFloat(result);
    } catch {
      const size = statSync(outputFile).size;
      duration = size / 12000;
    }

    timing[scene.id] = Math.round(duration * 100) / 100;
    console.log(`  ${scene.id}: ${timing[scene.id]}s ✅`);
  }

  const timingPath = join(audioDir, "timing.json");
  writeFileSync(timingPath, JSON.stringify(timing, null, 2));

  const total = Object.values(timing).reduce((s, d) => s + d, 0);
  console.log(`[Voice] Total: ${total.toFixed(1)}s | Saved: ${timingPath}`);

  return timing;
}

/**
 * Merge all scene audio files into one voiceover.aac
 */
export function mergeAudioToAAC(
  scripts: VoiceScript[],
  audioDir: string,
  outputPath: string
): void {
  // Step 1: Convert MP3 → WAV (consistent format)
  for (const s of scripts) {
    const mp3 = join(audioDir, `${s.id}.mp3`);
    const wav = join(audioDir, `${s.id}.wav`);
    execSync(`ffmpeg -y -i "${mp3}" -ar 24000 -ac 1 -c:a pcm_s16le "${wav}"`, { stdio: "pipe" });
  }

  // Step 2: Concat WAVs (lossless, no duration loss)
  const concatList = scripts.map((s) => `file '${join(audioDir, `${s.id}.wav`).replace(/\\/g, "/")}'`).join("\n");
  const concatFile = join(audioDir, "concat_wav.txt");
  writeFileSync(concatFile, concatList);

  const mergedWav = join(audioDir, "merged_all.wav");
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:a pcm_s16le "${mergedWav}"`, { stdio: "pipe" });

  // Step 3: WAV → MP3 (AAC encoder has duration bug, MP3 is reliable)
  // Output as .mp3 regardless of outputPath extension
  const mp3Path = outputPath.replace(/\.[^.]+$/, ".mp3");
  execSync(`ffmpeg -y -i "${mergedWav}" -c:a libmp3lame -q:a 2 "${mp3Path}"`, { stdio: "pipe" });

  // Also copy to the original outputPath for Remotion compatibility
  if (mp3Path !== outputPath) {
    const { copyFileSync: cpSync } = require("fs");
    cpSync(mp3Path, outputPath);
  }

  try {
    const dur = execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${mp3Path}"`, { encoding: "utf-8" }).trim();
    console.log(`[Voice] Merged: ${mp3Path} (${parseFloat(dur).toFixed(1)}s)`);
  } catch {
    console.log(`[Voice] Merged: ${mp3Path}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
