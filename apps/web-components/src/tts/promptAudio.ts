import type { Lang } from '@db/shared-schemas';
import { resolveAmharicPromptAudio } from '../api/amharicAudio';

const manifests = new Map<string, Promise<Record<string, string> | null>>();

function loadClips(manifestUrl: string, lang: Lang): Promise<Record<string, string> | null> {
  let pending = manifests.get(manifestUrl);
  if (!pending) {
    pending = fetch(manifestUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest: unknown) => {
        if (!manifest || typeof manifest !== 'object') return null;
        const { lang: manifestLang, clips } = manifest as { lang?: unknown; clips?: unknown };
        if (manifestLang !== lang || !clips || typeof clips !== 'object' || Array.isArray(clips)) return null;
        return clips as Record<string, string>;
      })
      .catch(() => null);
    manifests.set(manifestUrl, pending);
  }
  return pending;
}

/**
 * URL of a bundled prompt clip, or null. A clip is only requested when the host set `audio-base-url` AND the
 * manifest ({base}/audio/{lang}/manifest.json) lists that prompt, so a missing file never produces a 404 or a dead
 * button. The bundled clips are tone cues; the caption box always shows the words.
 */
export async function resolvePromptClip(lang: Lang, promptKey: string, audioBaseUrl?: string): Promise<string | null> {
  if (!audioBaseUrl) return null;
  const base = audioBaseUrl.replace(/\/+$/, '');
  const manifestUrl = `${base}/audio/${lang}/manifest.json`;
  try {
    if (lang === 'am') return await resolveAmharicPromptAudio(promptKey, manifestUrl);
    const clips = await loadClips(manifestUrl, lang);
    const clip = clips?.[promptKey];
    return typeof clip === 'string' && clip ? new URL(clip, new URL(manifestUrl, window.location.href)).toString() : null;
  } catch {
    return null; // manifest missing or malformed: caption box only, never an error for the learner
  }
}
