import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAmharicPromptAudio } from './amharicAudio';

describe('Amharic prompt audio fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the documented text-only fallback when no clips have been recorded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ lang: 'am', fallback: 'text-only', clips: {} }))),
    );

    await expect(resolveAmharicPromptAudio('step0.title')).resolves.toBeNull();
  });

  it('resolves a bundled clip path relative to the manifest', async () => {
    vi.stubGlobal(
      'window',
      { location: { href: 'https://demo.example.test/standalone.html' } },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ lang: 'am', fallback: 'text-only', clips: { 'step0.title': 'step0.mp3' } })),
      ),
    );

    await expect(resolveAmharicPromptAudio('step0.title', './assets/audio/am/manifest.json')).resolves.toBe(
      'https://demo.example.test/assets/audio/am/step0.mp3',
    );
  });
});
