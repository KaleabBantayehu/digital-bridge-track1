/**
 * Spoken commands for hands-free use (learners who cannot see the screen or cannot type / use a pointer).
 * Amharic and English words are both accepted whatever the UI language, because Amharic speech recognition is
 * often unavailable and the engine may fall back to English.
 */
export type VoiceCommand =
  | 'next' | 'back' | 'repeat' | 'down' | 'up' | 'choose' | 'answer' | 'help' | 'commands' | 'stop' | 'english' | 'amharic';

const PHRASES: Record<VoiceCommand, string[]> = {
  next: ['next', 'continue', 'forward', 'go forward', 'save', 'ቀጥል', 'ቀጥይ', 'ቀጣይ', 'ወደፊት', 'ወደ ፊት'],
  back: ['back', 'go back', 'previous', 'previous question', 'ተመለስ', 'ተመለሺ', 'ወደኋላ', 'ወደ ኋላ'],
  repeat: ['repeat', 'again', 'read', 'read aloud', 'say again', 'read again', 'ድገም', 'ደግም', 'አንብብ', 'እንደገና'],
  down: ['down', 'next item', 'next field', 'tab', 'ታች', 'ወደ ታች', 'ወደታች'],
  up: ['up', 'previous item', 'previous field', 'ላይ', 'ወደ ላይ', 'ወደላይ'],
  choose: ['choose', 'select', 'ok', 'okay', 'press', 'click', 'tick', 'enter', 'yes', 'ምረጥ', 'ምረጪ', 'እሺ', 'አዎ', 'ተጫን'],
  answer: ['answer', 'dictate', 'speak', 'መልስ', 'ተናገር'],
  // "help" opens the widget's Need help dialog (co-designer finding); "commands" reads the command list.
  help: ['help', 'need help', 'help me', 'እርዳታ', 'እገዛ', 'እርዱኝ'],
  commands: ['commands', 'what can i say', 'list commands', 'ትዕዛዝ', 'ትዕዛዞች'],
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

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  // Amharic (with spellings speech engines produce)
  'አንድ': 1, 'ሁለት': 2, 'ሶስት': 3, 'ሦስት': 3, 'አራት': 4, 'አምስት': 5, 'ስድስት': 6, 'ሰባት': 7, 'ስምንት': 8, 'ዘጠኝ': 9,
  'አስር': 10, 'አሥር': 10,
};
/** Words people put before the number ("number 3", "item 3", "ቁጥር 3"). */
const NUMBER_PREFIX = new Set(['number', 'item', 'no', 'ቁጥር']);

/**
 * "3", "three", "number three", "ሶስት", "ቁጥር ፫" -> 3. Only when the whole utterance is a number (optionally with a
 * prefix), so a number inside a sentence is never mistaken for a command.
 */
export function matchNumber(transcript: string): number | null {
  const words = tokenise(transcript.replace(/[፩-፱]/g, (ch) => String(ch.charCodeAt(0) - 0x1368)));
  const rest = words.length > 1 && NUMBER_PREFIX.has(words[0]) ? words.slice(1) : words;
  if (rest.length !== 1) return null;
  const word = rest[0];
  if (/^\d{1,2}$/.test(word)) return Number(word) || null;
  return NUMBER_WORDS[word] ?? null;
}
