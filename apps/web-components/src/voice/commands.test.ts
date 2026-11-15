import { describe, expect, it } from 'vitest';
import { matchCommand, matchNumber } from './commands';

describe('matchCommand', () => {
  it('understands Amharic commands', () => {
    expect(matchCommand('ቀጥል')).toBe('next');
    expect(matchCommand('ወደ ኋላ')).toBe('back');
    expect(matchCommand('ድገም።')).toBe('repeat');
    expect(matchCommand('ወደ ታች')).toBe('down');
    expect(matchCommand('ምረጥ')).toBe('choose');
    expect(matchCommand('አቁም')).toBe('stop');
  });

  it('understands English commands, longest phrase first', () => {
    expect(matchCommand('Next.')).toBe('next');
    expect(matchCommand('next item')).toBe('down');
    expect(matchCommand('go back')).toBe('back');
    expect(matchCommand('what can I say')).toBe('commands');
    expect(matchCommand('help')).toBe('help');
    expect(matchCommand('እርዳታ')).toBe('help');
  });

  it('uses the last command in a run-on transcript and ignores other words', () => {
    expect(matchCommand('um okay down')).toBe('down');
    expect(matchCommand('please continue')).toBe('next');
    expect(matchCommand('the weather is nice')).toBeNull();
  });

  it('matches whole words only', () => {
    expect(matchCommand('backpack')).toBeNull();
    expect(matchCommand('upload')).toBeNull();
  });
});

describe('matchNumber', () => {
  it('reads digits, English and Amharic number words, Ethiopic numerals and prefixes', () => {
    expect(matchNumber('3')).toBe(3);
    expect(matchNumber('three')).toBe(3);
    expect(matchNumber('number seven')).toBe(7);
    expect(matchNumber('ሶስት')).toBe(3);
    expect(matchNumber('ቁጥር ፭')).toBe(5);
    expect(matchNumber('12')).toBe(12);
  });

  it('ignores numbers inside a sentence', () => {
    expect(matchNumber('I am 25 years old')).toBeNull();
    expect(matchNumber('next')).toBeNull();
  });
});
