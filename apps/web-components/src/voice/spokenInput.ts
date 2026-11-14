import { toAsciiDigits } from '@db/shared-schemas';

/**
 * Speech-to-text returns numbers and symbols as words: "ዜሮ ዘጠኝ አንድ አንድ…", "zero nine one one…", Ethiopic
 * numerals (፩፪), or "name at gmail dot com". These helpers turn a transcript into what the field expects, so a
 * learner can say a phone number, an e-mail address or an ID number. The result is always shown in the editable
 * review box first; nothing is submitted without "Use this answer".
 */
export type SpokenKind = 'text' | 'tel' | 'email' | 'code';

const DIGIT_WORDS: Record<string, string> = {
  // Amharic (with common spelling variants from speech engines)
  'ዜሮ': '0', 'ዚሮ': '0', 'ዘሮ': '0', 'ባዶ': '0',
  'አንድ': '1', 'ሁለት': '2', 'ሶስት': '3', 'ሦስት': '3', 'አራት': '4', 'አምስት': '5',
  'ስድስት': '6', 'ሰባት': '7', 'ስምንት': '8', 'ዘጠኝ': '9',
  // English
  zero: '0', nil: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};
/** Sound-alikes that only make sense when the field holds nothing but digits. */
const PHONE_ONLY_WORDS: Record<string, string> = { oh: '0', o: '0', for: '4', to: '2', too: '2' };
/** "double five" / "ድርብ አምስት" -> 55; "triple" -> 555. */
const REPEAT_WORDS: Record<string, number> = { double: 2, triple: 3, 'ድርብ': 2 };
const PLUS_WORDS = new Set(['plus', 'ፕላስ', '+']);

const SYMBOL_WORDS: Record<string, string> = {
  at: '@', 'አት': '@', '@': '@',
  dot: '.', point: '.', period: '.', 'ዶት': '.', 'ነጥብ': '.',
  dash: '-', hyphen: '-', minus: '-', 'ሰረዝ': '-',
  underscore: '_', 'አንደርስኮር': '_',
};

const tokens = (text: string) =>
  toAsciiDigits(text)
    .toLowerCase()
    .replace(/[,،፣።]/g, ' ')
    .replace(/\bat sign\b/g, 'at')
    .replace(/\bunder score\b/g, 'underscore')
    .split(/\s+/)
    .filter(Boolean);

/** Map digit words to digits, keep every other token unchanged. */
function wordsToDigits(list: string[], phone = false): string[] {
  const words = phone ? { ...DIGIT_WORDS, ...PHONE_ONLY_WORDS } : DIGIT_WORDS;
  const out: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const repeat = REPEAT_WORDS[list[i]];
    const next = list[i + 1];
    if (repeat && next !== undefined && (words[next] || /^\d$/.test(next))) {
      out.push((words[next] ?? next).repeat(repeat));
      i += 1;
      continue;
    }
    out.push(words[list[i]] ?? list[i]);
  }
  return out;
}

/** "ዜሮ ዘጠኝ አንድ አንድ 234 567" -> "0911234567"; "plus 251 911…" -> "+251911…". Other words are dropped. */
export function spokenToPhone(text: string): string {
  return wordsToDigits(tokens(text), true)
    .map((tok) => (PLUS_WORDS.has(tok) ? '+' : tok.replace(/[^\d+]/g, '')))
    .join('');
}

/** "abebe at gmail dot com" / "abebe አት gmail ዶት com" -> "abebe@gmail.com". */
export function spokenToEmail(text: string): string {
  return wordsToDigits(tokens(text))
    .map((tok) => SYMBOL_WORDS[tok] ?? tok)
    .join('');
}

/** ID / reference numbers: "ET one two three four" -> "ET1234". Letters upper-cased, spaces removed. */
export function spokenToCode(text: string): string {
  return wordsToDigits(tokens(text))
    .map((tok) => SYMBOL_WORDS[tok] === '-' ? '-' : tok)
    .join('')
    .toUpperCase();
}

export function normaliseSpoken(text: string, kind: SpokenKind): string {
  if (kind === 'tel') return spokenToPhone(text);
  if (kind === 'email') return spokenToEmail(text);
  if (kind === 'code') return spokenToCode(text);
  return text.trim();
}

/** For read-back: say a phone/code one character at a time ("0 9 1 1 …") instead of "nine hundred million". */
export function spellOut(text: string, kind: SpokenKind): string {
  if (kind === 'text') return text;
  return Array.from(text)
    .map((ch) => (ch === '@' ? ' at ' : ch === '.' ? ' dot ' : ch))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
