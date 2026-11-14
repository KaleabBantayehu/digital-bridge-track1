import { existsSync, mkdirSync, readFileSync, statSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const repo = resolve(import.meta.dirname, '..');
const languageFiles = {
  am: [join(repo, 'apps/web-components/src/i18n/am.json'), join(repo, 'i18n/am.json')],
  en: [join(repo, 'apps/web-components/src/i18n/en.json'), join(repo, 'i18n/en.json')],
};
const voices = { am: 'am-ET-MekdesNeural', en: 'en-US-AriaNeural' };
const keys = ['welcome', 'step0', 'name', 'step1', 'contact', 'step2', 'dob', 'step3', 'identity', 'step4', 'support', 'step5', 'review', 'step6', 'career_intro'];

function readLanguage(lang) {
  const file = languageFiles[lang].find(existsSync);
  if (!file) throw new Error(`Missing ${lang}.json; expected ${languageFiles[lang].join(' or ')}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function textFor(data, key) {
  const candidates = [
    key,
    `${key}.title`,
    `${key}.hint`,
    key === 'welcome' ? 'app.name' : undefined,
    key === 'career_intro' ? 'career.title' : undefined,
  ].filter(Boolean);
  const value = candidates.map((candidate) => data[candidate]).find((candidate) => typeof candidate === 'string');
  return value ?? key;
}

function runTts(lang, key, text, output) {
  mkdirSync(dirname(output), { recursive: true });
  if (existsSync(output) && statSync(output).size > 3072) return Promise.resolve();
  const temporary = `${output}.partial`;
  return new Promise((resolvePromise, reject) => {
    const child = spawn('python', ['-m', 'edge_tts', '--voice', voices[lang], '--text', text, '--write-media', temporary], {
      cwd: repo,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    const timer = setTimeout(() => child.kill(), 60000);
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (existsSync(temporary)) rmSync(temporary, { force: true });
      reject(new Error(`edge-tts failed for ${lang}/${key}: ${error.message}`));
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      if (status !== 0 || !existsSync(temporary) || statSync(temporary).size <= 3072) {
        if (existsSync(temporary)) rmSync(temporary, { force: true });
        reject(new Error(`edge-tts failed for ${lang}/${key}: ${stderr || `exit ${status}`}`));
        return;
      }
      copyFileSync(temporary, output);
      rmSync(temporary, { force: true });
      resolvePromise();
    });
  });
}

for (const lang of Object.keys(voices)) {
  const data = readLanguage(lang);
  const outputDir = join(repo, 'apps/savanna-host-demo/assets/audio', lang);
  const clips = {};
  for (const key of keys) {
    const file = `${key}.mp3`;
    await runTts(lang, key, textFor(data, key), join(outputDir, file));
    clips[key] = file;
  }
  const manifest = {
    lang,
    fallback: 'manifest-audio',
    voice: voices[lang],
    generatedBy: 'scripts/generate-tts-audio.mjs',
    clips,
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  mkdirSync(outputDir, { recursive: true });
  const manifestPath = join(outputDir, 'manifest.json');
  writeFileSync(manifestPath, manifestText, 'utf8');

  for (const destination of [
    join(repo, 'apps/web-components/dist/audio', lang),
    join(repo, 'dist/assets/audio', lang),
  ]) {
    mkdirSync(destination, { recursive: true });
    for (const file of Object.values(clips)) copyFileSync(join(outputDir, file), join(destination, file));
    writeFileSync(join(destination, 'manifest.json'), manifestText, 'utf8');
  }
}

console.log('Generated neural TTS audio for Amharic and English.');
