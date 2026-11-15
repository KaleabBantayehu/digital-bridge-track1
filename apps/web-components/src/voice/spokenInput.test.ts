import { describe, expect, it } from 'vitest';
import { normaliseEtPhone } from '@db/shared-schemas';
import {
  collapseSpelledLetters, normaliseSpoken, parseMonthName, parseNumberWords, parseSpokenDate, spokenToCode, spokenToEmail,
  spokenToPhone,
} from './spokenInput';

describe('spoken phone numbers', () => {
  it('turns Amharic number words into digits', () => {
    const heard = 'ዜሮ ዘጠኝ አንድ አንድ ሁለት ሶስት አራት አምስት ስድስት ሰባት';
    expect(spokenToPhone(heard)).toBe('0911234567');
    expect(normaliseEtPhone(spokenToPhone(heard))).toBe('+251911234567');
  });

  it('accepts digits mixed with words, Ethiopic numerals and "double"', () => {
    expect(spokenToPhone('zero nine double one 234 567')).toBe('0911234567');
    expect(spokenToPhone('ዜሮ ፱ ፩ ፩ 234 567')).toBe('0911234567');
    expect(spokenToPhone('plus 251 911 234 567')).toBe('+251911234567');
  });

  it('lets the shared validator read Ethiopic numerals too', () => {
    expect(normaliseEtPhone('0፱፩፩ 234 567')).toBe('+251911234567');
  });
});

describe('spoken e-mail addresses', () => {
  it('handles "at" and "dot" in English and Amharic', () => {
    expect(spokenToEmail('abebe at gmail dot com')).toBe('abebe@gmail.com');
    expect(spokenToEmail('abebe አት gmail ዶት com')).toBe('abebe@gmail.com');
    expect(spokenToEmail('selam underscore two at ethio dot et')).toBe('selam_2@ethio.et');
  });
});

describe('spoken ID numbers', () => {
  it('joins letters and digits', () => {
    expect(spokenToCode('et one two three four five six seven')).toBe('ET1234567');
  });
});

describe('spelled-out answers (co-designer finding)', () => {
  it('joins letters spoken one by one', () => {
    expect(collapseSpelledLetters('a b e b e')).toBe('Abebe');
    expect(collapseSpelledLetters('K A L E A B')).toBe('Kaleab');
    expect(collapseSpelledLetters('my name is a b e b e')).toBe('my name is Abebe');
    expect(collapseSpelledLetters('Selam')).toBe('Selam');
  });

  it('spelled e-mail addresses come out lower case without spaces', () => {
    expect(normaliseSpoken('K A L E A B at gmail dot com', 'email')).toBe('kaleab@gmail.com');
  });
});

describe('hyphen and underscore (round-2 finding)', () => {
  it('works in e-mail addresses, ID codes and names', () => {
    expect(spokenToEmail('selam underscore tadesse at gmail dot com')).toBe('selam_tadesse@gmail.com');
    expect(spokenToEmail('abebe hyphen k at ethio dot et')).toBe('abebe-k@ethio.et');
    expect(spokenToCode('d b hyphen four f seven')).toBe('DB-4F7');
    expect(spokenToCode('a b ሰረዝ one two')).toBe('AB-12');
    expect(spokenToCode('a b underscore one')).toBe('AB_1');
    expect(normaliseSpoken('Mary hyphen Jane', 'text')).toBe('Mary-Jane');
    expect(normaliseSpoken('ሰላም ሰረዝ ታደሰ', 'text')).toBe('ሰላም-ታደሰ');
  });
});

describe('spoken numbers and dates (round-2 finding: date of birth by voice)', () => {
  it('reads number words in English and Amharic', () => {
    expect(parseNumberWords(['fifteen'])).toEqual([15]);
    expect(parseNumberWords(['nineteen', 'ninety', 'five'])).toEqual([1995]);
    expect(parseNumberWords(['one', 'thousand', 'nine', 'hundred', 'ninety', 'five'])).toEqual([1995]);
    expect(parseNumberWords(['two', 'thousand', 'fifteen'])).toEqual([2015]);
    expect(parseNumberWords(['ሁለት', 'ሺህ'])).toEqual([2000]);
    expect(parseNumberWords(['ሁለት', 'ሺህ', 'አስራ', 'አምስት'])).toEqual([2015]);
    expect(parseNumberWords(['አንድ', 'ሺህ', 'ዘጠኝ', 'መቶ', 'ዘጠና', 'አምስት'])).toEqual([1995]);
    expect(parseNumberWords(['ሃያ', 'ሰባት'])).toEqual([27]);
  });

  it('reads Ethiopian month names, spelling variants and near misses', () => {
    expect(parseMonthName('Meskerem')).toBe(1);
    expect(parseMonthName('መስከረም')).toBe(1);
    expect(parseMonthName('ህዳር')).toBe(3);
    expect(parseMonthName('ኅዳር')).toBe(3);
    expect(parseMonthName('ታህሳስ')).toBe(4);
    expect(parseMonthName('Pagume')).toBe(13);
    expect(parseMonthName('ጳጉሜ')).toBe(13);
    expect(parseMonthName('Yekatiti')).toBe(6);
    expect(parseMonthName('March', 'gregorian')).toBe(3);
    expect(parseMonthName('hello')).toBeUndefined();
  });

  it('parses a whole spoken date of birth', () => {
    expect(parseSpokenDate('15 Meskerem 1995')).toEqual({ day: 15, month: 1, year: 1995 });
    expect(parseSpokenDate('መስከረም አስራ አምስት አንድ ሺህ ዘጠኝ መቶ ዘጠና አምስት')).toEqual({ day: 15, month: 1, year: 1995 });
    expect(parseSpokenDate('fifteen one nineteen ninety five')).toEqual({ day: 15, month: 1, year: 1995 });
    expect(parseSpokenDate('15/1/1995')).toEqual({ day: 15, month: 1, year: 1995 });
    expect(parseSpokenDate('ሃያ ሰባት ጳጉሜ 2000')).toEqual({ day: 27, month: 13, year: 2000 });
    expect(parseSpokenDate('1996')).toEqual({ year: 1996 });
  });
});
