import { describe, expect, it } from 'vitest';
import { answerHelpQuestion } from '@db/shared-schemas';
import { bestAlternative, joinTranscripts, normaliseTranscript } from './askVoice';

const result = (alts: Array<[string, number?]>, isFinal = true) =>
  Object.assign(alts.map(([transcript, confidence]) => ({ transcript, confidence })), { isFinal });

describe('db-ask voice transcript', () => {
  it('writes interim and final words into one clean question', () => {
    const list = [result([['Do I need ']]), result([[' an ID to sign up']], false)];
    expect(joinTranscripts(list)).toBe('Do I need an ID to sign up');
  });

  it('does not repeat words when Android resends the text so far', () => {
    const list = [result([['how']]), result([['how do I']]), result([['how do I find a job']])];
    expect(joinTranscripts(list)).toBe('how do I find a job');
  });

  it('keeps Amharic transcripts and picks the most confident of 3 alternatives', () => {
    expect(bestAlternative(result([['ስራ', 0.4], ['ሥራ እንዴት አገኛለሁ', 0.9], ['ስራ እንዴት', 0.6]]))).toBe('ሥራ እንዴት አገኛለሁ');
    const spoken = joinTranscripts([result([['ሥራ እንዴት አገኛለሁ', 0.9]])]);
    expect(answerHelpQuestion(spoken).id).toBe('jobs');
  });

  it('trims and collapses spaces, and ignores empty results', () => {
    expect(normaliseTranscript('  ኢንተርኔት   ቢቋረጥ ')).toBe('ኢንተርኔት ቢቋረጥ');
    expect(joinTranscripts([result([['   ']]), result([['hello']])])).toBe('hello');
  });
});

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
