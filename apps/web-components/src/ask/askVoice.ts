// Speech results for <db-ask>: turn a continuous recognition result list into one clean question.

export interface AlternativeLike { transcript: string; confidence?: number }
export interface ResultLike { readonly length: number; [index: number]: AlternativeLike | undefined; isFinal?: boolean }
export interface ResultListLike { readonly length: number; [index: number]: ResultLike | undefined }

/** Collapse spaces and trim, so "  do I  need an ID " becomes "do I need an ID". */
export const normaliseTranscript = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Best of up to maxAlternatives guesses: the highest confidence, else the first. */
export function bestAlternative(result: ResultLike): string {
  let best = result[0]?.transcript ?? '';
  let score = result[0]?.confidence ?? 0;
  for (let i = 1; i < result.length; i++) {
    const alt = result[i];
    if (alt && (alt.confidence ?? 0) > score) {
      best = alt.transcript;
      score = alt.confidence ?? 0;
    }
  }
  return best;
}

/**
 * Join every result of a continuous session (final and interim) into the text to show in the question box.
 * Android Chrome repeats earlier words inside each new result ("how", "how do", "how do I"), so a result that
 * already contains the text so far replaces it instead of being appended.
 */
export function joinTranscripts(results: ResultListLike): string {
  let text = '';
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) continue;
    const piece = normaliseTranscript(bestAlternative(result));
    if (!piece) continue;
    if (text && piece.toLowerCase().startsWith(text.toLowerCase())) text = piece;
    else if (!text.toLowerCase().endsWith(piece.toLowerCase())) text = text ? `${text} ${piece}` : piece;
  }
  return normaliseTranscript(text);
}
