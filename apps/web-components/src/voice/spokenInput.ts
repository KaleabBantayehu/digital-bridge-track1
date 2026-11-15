import { ETHIOPIAN_MONTHS, GREGORIAN_MONTHS, toAsciiDigits } from '@db/shared-schemas';

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
  dash: '-', hyphen: '-', minus: '-', 'ሰረዝ': '-', 'ጭረት': '-', 'ሃይፈን': '-',
  underscore: '_', 'አንደርስኮር': '_', 'አንደር_ስኮር': '_',
};

const tokens = (text: string) =>
  toAsciiDigits(text)
    .toLowerCase()
    .replace(/[,،፣።]/g, ' ')
    .replace(/\bat sign\b/g, 'at')
    .replace(/\bunder score\b/g, 'underscore')
    .replace(/አንደር ስኮር/g, 'አንደርስኮር')
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
    .map((tok) => (SYMBOL_WORDS[tok] === '-' || SYMBOL_WORDS[tok] === '_' ? SYMBOL_WORDS[tok] : tok))
    .join('')
    .toUpperCase();
}

/**
 * Co-designer finding: "users can say their name spelling by spelling". Runs of two or more single letters
 * ("a b e b e", "K A L E A B") become one word ("Abebe", "Kaleab"); other words are left alone.
 */
export function collapseSpelledLetters(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    if (/^[A-Za-z]\.?$/.test(words[i])) {
      let j = i;
      while (j < words.length && /^[A-Za-z]\.?$/.test(words[j])) j++;
      if (j - i >= 2) {
        const joined = words.slice(i, j).map((w) => w.replace('.', '')).join('').toLowerCase();
        out.push(joined.charAt(0).toUpperCase() + joined.slice(1));
        i = j;
        continue;
      }
    }
    out.push(words[i]);
    i++;
  }
  return out.join(' ');
}

/** Names and other text: "Mary hyphen Jane" -> "Mary-Jane", "selam underscore tadesse" -> "selam_tadesse". */
export function joinSpokenSymbols(text: string): string {
  return text
    .replace(/\s*\b(?:hyphen|dash)\b\s*|\s*(?:ሰረዝ|ጭረት|ሃይፈን)\s*/gi, '-')
    .replace(/\s*\b(?:underscore|under score)\b\s*|\s*(?:አንደርስኮር|አንደር ስኮር)\s*/gi, '_')
    .trim();
}

export function normaliseSpoken(text: string, kind: SpokenKind): string {
  if (kind === 'tel') return spokenToPhone(text);
  if (kind === 'email') return spokenToEmail(text).toLowerCase();
  if (kind === 'code') return spokenToCode(text);
  return joinSpokenSymbols(collapseSpelledLetters(text));
}

// ---- Spoken numbers and dates (date of birth by voice, co-designer finding) ---------------------------------------

/** Fold Ethiopic letters that sound the same (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ) so spelling variants still match. */
export function foldFidel(text: string): string {
  const same: Record<number, number> = { 0x1210: 0x1200, 0x1280: 0x1200, 0x1220: 0x1230, 0x12d0: 0x12a0, 0x1340: 0x1338 };
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x1200 || code > 0x137f) return ch;
      const base = code - ((code - 0x1200) % 8);
      return same[base] ? String.fromCodePoint(same[base] + (code - base)) : ch;
    })
    .join('');
}

const NUMBER_VALUES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000,
  'ዜሮ': 0, 'አንድ': 1, 'ሁለት': 2, 'ሶስት': 3, 'አራት': 4, 'አምስት': 5, 'ስድስት': 6, 'ሰባት': 7, 'ስምንት': 8, 'ዘጠኝ': 9,
  'አስር': 10, 'ሃያ': 20, 'ሀያ': 20, 'ሰላሳ': 30, 'አርባ': 40, 'ሃምሳ': 50, 'ሀምሳ': 50, 'ስልሳ': 60, 'ስድሳ': 60, 'ሰባ': 70,
  'ሰማንያ': 80, 'ዘጠና': 90, 'መቶ': 100, 'ሺህ': 1000, 'ሺ': 1000,
};
const TEEN_PREFIX = 'አስራ'; // "አስራ አምስት" = 15

const numberWord = (word: string): number | undefined => NUMBER_VALUES[foldFidel(word)] ?? NUMBER_VALUES[word];

/**
 * A run of number words -> one or more numbers. "fifteen" -> [15]; "nineteen ninety five" -> [1995];
 * "one thousand nine hundred ninety five" / "አንድ ሺህ ዘጠኝ መቶ ዘጠና አምስት" -> [1995]; "ሁለት ሺህ አስራ አምስት" -> [2015].
 */
export function parseNumberWords(words: string[]): number[] {
  const chunks: number[] = [];
  let cur: number | null = null;
  let teen = false;
  let multiplier = false;
  const addable = (c: number, v: number) =>
    (teen && c === 10 && v < 10) ||
    (c >= 100 && v < 100 && c % 100 === 0) ||
    (c >= 100 && v < 10 && c % 10 === 0) ||
    (c >= 20 && c < 100 && c % 10 === 0 && v < 10);
  for (const word of words) {
    if (foldFidel(word) === foldFidel(TEEN_PREFIX)) {
      if (cur !== null && !addable(cur, 10)) { chunks.push(cur); cur = null; }
      cur = (cur ?? 0) + 10;
      teen = true;
      continue;
    }
    const v = numberWord(word);
    if (v === undefined) continue;
    if (v === 100) {
      multiplier = true;
      cur = cur !== null && cur >= 1000 ? cur - (cur % 1000) + ((cur % 1000) || 1) * 100 : (cur ?? 1) * 100;
    } else if (v === 1000) {
      multiplier = true;
      cur = (cur ?? 1) * 1000;
    } else if (cur !== null && addable(cur, v)) {
      cur += v;
    } else {
      if (cur !== null) chunks.push(cur);
      cur = v;
    }
    teen = teen && v < 10 ? false : teen && cur === 10;
  }
  if (cur !== null) chunks.push(cur);
  // "nineteen ninety five": a pair like 19 | 95 is a year (1850–2100, Ethiopian or Gregorian), even after other numbers.
  if (multiplier) return chunks;
  const merged: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const year = chunks[i] * 100 + (chunks[i + 1] ?? -1);
    if (chunks[i] >= 18 && chunks[i] <= 20 && i + 1 < chunks.length && chunks[i + 1] < 100 && year >= 1850 && year <= 2100) {
      merged.push(year);
      i++;
    } else {
      merged.push(chunks[i]);
    }
  }
  return merged;
}

const MONTH_ALIASES: Record<string, number> = {
  meskerem: 1, meskarem: 1, mascarem: 1, meskerm: 1, tikimt: 2, tikemt: 2, tekemt: 2, tiqimt: 2, hidar: 3, hedar: 3,
  tahsas: 4, tahesas: 4, tahisas: 4, tir: 5, ter: 5, yekatit: 6, yakatit: 6, megabit: 7, megabeet: 7, miazia: 8,
  miyazya: 8, miyaziya: 8, ginbot: 9, genbot: 9, sene: 10, senay: 10, hamle: 11, hamley: 11, nehase: 12, nehasie: 12,
  pagume: 13, pagumen: 13, 'ህዳር': 3, 'ታህሳስ': 4, 'ሚያዚያ': 8, 'ነሀሴ': 12, 'ጳጉሜን': 13,
};
const GREG_ALIASES: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** A spoken month name -> its number (1–13 Ethiopian, 1–12 Gregorian), in English or Amharic, tolerating near misses. */
export function parseMonthName(word: string, calendar: 'ethiopian' | 'gregorian' = 'ethiopian'): number | undefined {
  const w = foldFidel(word.toLowerCase().replace(/[^a-zሀ-፿]/g, ''));
  if (!w) return undefined;
  const months = calendar === 'ethiopian' ? ETHIOPIAN_MONTHS : GREGORIAN_MONTHS;
  for (const m of months) if (w === m.en.toLowerCase() || w === foldFidel(m.am)) return m.number;
  const alias = calendar === 'ethiopian' ? MONTH_ALIASES[w] : GREG_ALIASES[w];
  if (alias) return alias;
  if (/^[a-z]{5,}$/.test(w)) {
    for (const m of months) if (editDistance(w, m.en.toLowerCase()) <= 1) return m.number;
  }
  return undefined;
}

export interface SpokenDate { day?: number; month?: number; year?: number }

/**
 * "15 Meskerem 1995", "መስከረም አስራ አምስት አንድ ሺህ ዘጠኝ መቶ ዘጠና አምስት", "fifteen one nineteen ninety five",
 * "15 1 1995" -> { day: 15, month: 1, year: 1995 }. Without a month name the order is day, month, year.
 */
export function parseSpokenDate(text: string, calendar: 'ethiopian' | 'gregorian' = 'ethiopian'): SpokenDate {
  const words = toAsciiDigits(text).toLowerCase().replace(/[,./\-።፣]/g, ' ').split(/\s+/).filter(Boolean);
  const numbers: number[] = [];
  let month: number | undefined;
  let run: string[] = [];
  const flush = () => {
    if (run.length) numbers.push(...parseNumberWords(run));
    run = [];
  };
  for (const word of words) {
    if (/^\d+$/.test(word)) {
      flush();
      numbers.push(Number(word));
      continue;
    }
    const m = month === undefined ? parseMonthName(word, calendar) : undefined;
    if (m) {
      flush();
      month = m;
      continue;
    }
    if (numberWord(word) !== undefined || foldFidel(word) === foldFidel(TEEN_PREFIX)) run.push(word);
    else flush();
  }
  flush();
  const result: SpokenDate = {};
  const yearIndex = numbers.findIndex((n) => n >= 1000);
  if (yearIndex >= 0) result.year = numbers.splice(yearIndex, 1)[0];
  if (month !== undefined) result.month = month;
  const maxMonth = calendar === 'ethiopian' ? 13 : 12;
  for (const n of numbers) {
    if (result.day === undefined && n >= 1 && n <= 31) result.day = n;
    else if (result.month === undefined && n >= 1 && n <= maxMonth) result.month = n;
  }
  return result;
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
