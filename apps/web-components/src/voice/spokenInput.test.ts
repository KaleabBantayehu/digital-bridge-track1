import { describe, expect, it } from 'vitest';
import { normaliseEtPhone } from '@db/shared-schemas';
import { spokenToCode, spokenToEmail, spokenToPhone } from './spokenInput';

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
