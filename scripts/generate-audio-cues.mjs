// Generates the bundled read-aloud fallback cues: small, valid PCM WAV files (8 kHz, mono, 16-bit).
//
// These are TONE CUES, not speech. Each one is a soft two-note chime followed by one gentle pip per step number
// (Step 3 -> 3 pips), so a learner hears that Read aloud responded and which question they are on, while the
// on-screen caption box shows the words. When a native speaker records real prompts, put the .mp3/.wav files
// next to these and point the manifest at them; nothing else changes.
//
// Usage: node scripts/generate-audio-cues.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outBase = join(root, 'apps/savanna-host-demo/assets/audio');
const RATE = 8000;

function tone(samples, start, freq, seconds, volume) {
  const from = Math.round(start * RATE);
  const length = Math.round(seconds * RATE);
  for (let i = 0; i < length && from + i < samples.length; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.015);
    const decay = Math.exp(-t * 6);
    samples[from + i] += Math.sin(2 * Math.PI * freq * t) * volume * attack * decay;
  }
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function cue(pips, finished = false) {
  const seconds = 0.6 + pips * 0.22 + 0.3;
  const samples = new Float64Array(Math.round(seconds * RATE));
  tone(samples, 0, 660, 0.45, 0.22);
  tone(samples, 0.14, 880, 0.45, 0.2);
  for (let i = 0; i < pips; i++) tone(samples, 0.6 + i * 0.22, finished ? 1046 : 740, 0.18, 0.16);
  return wav(Array.from(samples));
}

const prompts = Array.from({ length: 7 }, (_, step) => [`step${step}`, cue(step + 1)]);
prompts.push(['finished', cue(3, true)]);

for (const lang of ['am', 'en']) {
  const dir = join(outBase, lang);
  mkdirSync(dir, { recursive: true });
  const clips = {};
  for (const [key, buffer] of prompts) {
    writeFileSync(join(dir, `${key}.wav`), buffer);
    clips[key] = `${key}.wav`;
  }
  const manifest = {
    lang,
    fallback: 'text-only',
    kind: 'tone-cue',
    note: 'Tone cues (chime + one pip per step number), not recorded speech. The widget shows the words in a caption box while a cue plays. Replace with native-speaker recordings when available.',
    clips,
  };
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${prompts.length} cues + manifest.json to ${dir}`);
}
