import { describe, expect, it } from 'vitest';
import { matchCommand } from './commands';

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
    expect(matchCommand('what can I say')).toBe('help');
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
