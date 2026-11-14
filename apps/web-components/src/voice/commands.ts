/**
 * Spoken commands for hands-free use (learners who cannot see the screen or cannot type / use a pointer).
 * Amharic and English words are both accepted whatever the UI language, because Amharic speech recognition is
 * often unavailable and the engine may fall back to English.
 */
export type VoiceCommand =
  | 'next' | 'back' | 'repeat' | 'down' | 'up' | 'choose' | 'answer' | 'help' | 'stop' | 'english' | 'amharic';

const PHRASES: Record<VoiceCommand, string[]> = {
  next: ['next', 'continue', 'forward', 'go forward', 'save', 'ቀጥል', 'ቀጥይ', 'ቀጣይ', 'ወደፊት', 'ወደ ፊት'],
  back: ['back', 'go back', 'previous', 'previous question', 'ተመለስ', 'ተመለሺ', 'ወደኋላ', 'ወደ ኋላ'],
  repeat: ['repeat', 'again', 'read', 'read aloud', 'say again', 'read again', 'ድገም', 'ደግም', 'አንብብ', 'እንደገና'],
  down: ['down', 'next item', 'next field', 'tab', 'ታች', 'ወደ ታች', 'ወደታች'],
  up: ['up', 'previous item', 'previous field', 'ላይ', 'ወደ ላይ', 'ወደላይ'],
  choose: ['choose', 'select', 'ok', 'okay', 'press', 'click', 'tick', 'enter', 'yes', 'ምረጥ', 'ምረጪ', 'እሺ', 'አዎ', 'ተጫን'],
  answer: ['answer', 'dictate', 'speak', 'መልስ', 'ተናገር'],
  help: ['help', 'commands', 'what can i say', 'እርዳታ', 'እገዛ', 'ትዕዛዝ', 'ትዕዛዞች'],
  stop: ['stop', 'stop listening', 'voice off', 'exit', 'አቁም', 'አቁሚ', 'ዝም'],
  english: ['english', 'እንግሊዝኛ'],
  amharic: ['amharic', 'አማርኛ'],
};

/** Every phrase as a token list, longest first, so "next item" wins over "next" and "go back" over "back". */
const MATCHERS = (Object.entries(PHRASES) as [VoiceCommand, string[]][])
  .flatMap(([command, phrases]) => phrases.map((phrase) => ({ command, tokens: phrase.split(' ') })))
  .sort((a, b) => b.tokens.length - a.tokens.length);

const tokenise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,!?¿¡።፣፤፥፦'"«»]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** The command in a transcript (whole words only), or null. Uses the LAST command said in a run-on transcript. */
export function matchCommand(transcript: string): VoiceCommand | null {
  const words = tokenise(transcript);
  for (let end = words.length; end > 0; end--) {
    for (const { command, tokens } of MATCHERS) {
      const start = end - tokens.length;
      if (start >= 0 && tokens.every((token, i) => words[start + i] === token)) return command;
    }
  }
  return null;
}
