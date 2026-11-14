/**
 * Lightweight phonetic Latin -> Ethiopic (Fidel) helper for learners without an Amharic keyboard or working Amharic
 * speech-to-text. It is a typing aid, not a full SERA implementation: common names and places come from a small
 * dictionary, everything else from simple consonant + vowel rules. The learner always sees and confirms the result.
 */

/** First-order (ä) code point of each consonant series. The seven orders are consecutive: ä u i a e ə o. */
const SERIES: Record<string, number> = {
  h: 0x1200, l: 0x1208, H: 0x1210, m: 0x1218, r: 0x1228, s: 0x1230, sh: 0x1238, x: 0x1238, q: 0x1240,
  b: 0x1260, v: 0x1268, t: 0x1270, ch: 0x1278, c: 0x1278, n: 0x1290, ny: 0x1298, N: 0x1298, k: 0x12a8,
  w: 0x12c8, z: 0x12d8, zh: 0x12e0, y: 0x12e8, d: 0x12f0, j: 0x1300, g: 0x1308, T: 0x1320, C: 0x1328,
  P: 0x1330, ts: 0x1338, S: 0x1338, f: 0x1348, p: 0x1350,
};
/** Vowel carrier series (አ) for vowels at the start of a word or after another vowel. */
const GLOTTAL = 0x12a0;
const DIGRAPHS = ['sh', 'ch', 'ny', 'zh', 'ts'];

/** Order index for each Latin vowel spelling, after a consonant. */
const VOWEL_AFTER_CONSONANT: [string, number][] = [['ie', 4], ['ee', 4], ['e', 0], ['u', 1], ['i', 2], ['a', 3], ['o', 6]];
/** Standalone vowels: 'a' is the carrier's own first form (አ), 'e' is እ. */
const VOWEL_ALONE: [string, number][] = [['ie', 4], ['ee', 4], ['a', 0], ['u', 1], ['i', 2], ['e', 5], ['o', 6]];

/** Common Ethiopian names and places, so the usual spelling wins over the letter-by-letter guess. */
const WORDS: Record<string, string> = {
  abebe: 'አበበ', kebede: 'ከበደ', bekele: 'በቀለ', almaz: 'አልማዝ', tigist: 'ትዕግስት', hana: 'ሐና', dawit: 'ዳዊት',
  selam: 'ሰላም', meron: 'ሜሮን', yonas: 'ዮናስ', tesfaye: 'ተስፋዬ', mulugeta: 'ሙሉጌታ', abeba: 'አበባ', ababa: 'አበባ',
  addis: 'አዲስ', alemu: 'አለሙ', girma: 'ግርማ', haile: 'ኃይሌ', mekdes: 'መቅደስ', liya: 'ሊያ', saba: 'ሳባ',
  yared: 'ያሬድ', biniam: 'ቢንያም', eyerusalem: 'ኢየሩሳሌም', mahlet: 'ማህሌት', fikre: 'ፍቅሬ', tsion: 'ጽዮን',
  adama: 'አዳማ', hawassa: 'ሐዋሳ', gondar: 'ጎንደር', mekelle: 'መቀሌ', bahir: 'ባሕር', dar: 'ዳር', dire: 'ድሬ',
  dawa: 'ዳዋ', jimma: 'ጅማ', harar: 'ሐረር', dessie: 'ደሴ', bole: 'ቦሌ', piassa: 'ፒያሳ', kebele: 'ቀበሌ',
  ethiopia: 'ኢትዮጵያ', chaltu: 'ጫልቱ', lemlem: 'ለምለም', worku: 'ወርቁ', aster: 'አስቴር', solomon: 'ሰለሞን',
};

const isVowel = (ch: string) => /[aeiou]/i.test(ch);

function matchVowel(word: string, at: number, table: [string, number][]): [number, number] | null {
  for (const [spelling, order] of table) {
    if (word.slice(at, at + spelling.length).toLowerCase() === spelling) return [order, spelling.length];
  }
  return null;
}

function transliterateWord(word: string): string {
  const known = WORDS[word.toLowerCase()];
  if (known) return known;
  let out = '';
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    // Consonant (case matters only for the single uppercase letters T, C, P, S, H, N).
    const digraph = DIGRAPHS.find((d) => word.slice(i, i + 2).toLowerCase() === d);
    const key = digraph ?? (ch in SERIES ? ch : ch.toLowerCase() in SERIES ? ch.toLowerCase() : undefined);
    if (key) {
      i += key.length;
      // Doubled consonants (gemination) are written once in Fidel: "dd" in "addis".
      while (word.slice(i, i + key.length).toLowerCase() === key.toLowerCase()) i += key.length;
      const vowel = matchVowel(word, i, VOWEL_AFTER_CONSONANT);
      const order = vowel ? vowel[0] : 5;
      if (vowel) i += vowel[1];
      out += String.fromCodePoint(SERIES[key] + order);
      continue;
    }
    if (isVowel(ch)) {
      const vowel = matchVowel(word, i, VOWEL_ALONE);
      if (vowel) {
        out += String.fromCodePoint(GLOTTAL + vowel[0]);
        i += vowel[1];
        continue;
      }
    }
    out += ch; // digits, punctuation, letters we do not map
    i += 1;
  }
  return out;
}

/** Turn Latin letters into Fidel, word by word. Spaces, digits and punctuation are kept. */
export function toFidel(latin: string): string {
  return latin.replace(/[A-Za-z']+/g, (word) => transliterateWord(word.replace(/'/g, '')));
}

/** The seven forms of the series the character belongs to, or [] for anything that is not a series letter. */
export function fidelOrders(char: string): string[] {
  const code = char.codePointAt(0);
  if (code === undefined || code < 0x1200 || code > 0x135a) return [];
  const base = code - ((code - 0x1200) % 8);
  return Array.from({ length: 7 }, (_, order) => String.fromCodePoint(base + order));
}
