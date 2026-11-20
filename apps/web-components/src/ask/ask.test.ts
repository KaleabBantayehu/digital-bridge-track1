import { describe, expect, it } from 'vitest';
import { answerHelpQuestion } from '@db/shared-schemas';

// Pitch day: judges ask the product one question in English and the same question in Amharic.
describe('bilingual help answers', () => {
  const pairs: Array<[string, string, string]> = [
    ['Do I need an ID to register?', 'ለመመዝገብ መታወቂያ ያስፈልገኛል?', 'id'],
    ['Will employers see my disability?', 'የአካል ጉዳቴን ቀጣሪ ያያል?', 'privacy'],
    ['What happens if I lose internet?', 'ኢንተርኔት ቢቋረጥ ምን ይሆናል?', 'offline'],
    ['How do I find a job?', 'ሥራ እንዴት አገኛለሁ?', 'jobs'],
    ['Can a blind person use this?', 'ዓይነ ስውር ሰው መጠቀም ይችላል?', 'access'],
    ['How much does it cost?', 'ዋጋው ስንት ነው?', 'time'],
  ];

  it.each(pairs)('answers "%s" and "%s" with the same entry in each language', (en, am, id) => {
    const english = answerHelpQuestion(en, 'am');
    const amharic = answerHelpQuestion(am, 'en');
    expect(english).toMatchObject({ id, lang: 'en', matched: true });
    expect(amharic).toMatchObject({ id, lang: 'am', matched: true });
    expect(amharic.answer).toMatch(/[ሀ-፿]/);
  });

  it('falls back politely in the question language', () => {
    expect(answerHelpQuestion('hello there')).toMatchObject({ id: 'fallback', lang: 'en', matched: false });
  });

  it('does not match "id" inside other words', () => {
    expect(answerHelpQuestion('Do you provide video?').id).not.toBe('id');
  });
});
