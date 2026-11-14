type AudioManifest = { clips?: Record<string, string> };
const manifestCache = new Map<string, Promise<AudioManifest | null>>();

const base = (value: string) => value.replace(/\/+$/, '');

async function manifestFor(audioBaseUrl: string, lang: string): Promise<AudioManifest | null> {
  const url = `${base(audioBaseUrl)}/audio/${lang}/manifest.json`;
  if (!manifestCache.has(url)) {
    manifestCache.set(url, fetch(url).then(async (response) => {
      if (!response.ok) return null;
      const value: unknown = await response.json();
      return value && typeof value === 'object' ? value as AudioManifest : null;
    }).catch(() => null));
  }
  return manifestCache.get(url) ?? null;
}

export async function resolvePromptClip(lang: string, key: string, audioBaseUrl: string): Promise<string | null> {
  if (!audioBaseUrl || !key || typeof window === 'undefined') return null;
  const manifest = await manifestFor(audioBaseUrl, lang);
  const file = manifest?.clips?.[key];
  return file ? `${base(audioBaseUrl)}/audio/${lang}/${file}` : null;
}
