export interface AmharicAudioManifest {
  lang: 'am';
  fallback: 'text-only';
  clips: Record<string, string>;
}

export async function resolveAmharicPromptAudio(
  promptKey: string,
  manifestUrl = './assets/audio/am/manifest.json',
): Promise<string | null> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Unable to load the Amharic audio manifest (${response.status}).`);
  }

  const manifest: unknown = await response.json();
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('lang' in manifest) ||
    manifest.lang !== 'am' ||
    !('fallback' in manifest) ||
    manifest.fallback !== 'text-only' ||
    !('clips' in manifest) ||
    typeof manifest.clips !== 'object' ||
    manifest.clips === null ||
    Array.isArray(manifest.clips)
  ) {
    throw new TypeError('The Amharic audio manifest has an invalid format.');
  }

  const clip = (manifest.clips as Record<string, unknown>)[promptKey];
  if (clip === undefined) return null;
  if (typeof clip !== 'string' || clip.length === 0) {
    throw new TypeError(`The Amharic audio entry "${promptKey}" is invalid.`);
  }
  return new URL(clip, new URL(manifestUrl, window.location.href)).toString();
}
