// Bilingual help answers shared by the API (POST /api/v1/help/ask) and the <db-ask> widget.
// Pure keyword matching: no paid AI service, works offline, and gives the same answer through every door.

export type HelpLang = 'en' | 'am';

export interface HelpEntry {
  id: string;
  question: { en: string; am: string };
  answer: { en: string; am: string };
  /** Lower-case English keywords and Amharic stems. A match on any of them scores the entry. */
  keywords: string[];
}

export interface HelpAnswer {
  id: string;
  lang: HelpLang;
  question: string;
  answer: string;
  matched: boolean;
}

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: 'what',
    question: { en: 'What is Digital Bridge?', am: 'ዲጂታል ብሪጅ ምንድን ነው?' },
    answer: {
      en: 'Digital Bridge helps you create a learner profile, tell us what support you need, and find jobs that offer that support. It works in English and Amharic, by keyboard, screen reader or voice.',
      am: 'ዲጂታል ብሪጅ የተማሪ መገለጫ እንዲፈጥሩ፣ የሚፈልጉትን ድጋፍ እንዲነግሩን እና ያንን ድጋፍ የሚሰጡ ስራዎችን እንዲያገኙ ይረዳዎታል። በእንግሊዝኛ እና በአማርኛ፣ በቁልፍ ሰሌዳ፣ በስክሪን አንባቢ ወይም በድምፅ ይሰራል።',
    },
    keywords: ['what is', 'what does', 'digital bridge', 'about', 'purpose', 'ምንድን', 'ምንድነው', 'ምን ያደርጋል', 'ብሪጅ', 'ስለ'],
  },
  {
    id: 'id',
    question: { en: 'Do I need an ID or passport to sign up?', am: 'ለመመዝገብ መታወቂያ ወይም ፓስፖርት ያስፈልገኛል?' },
    answer: {
      en: 'No. An ID is never required. You can use a national ID or passport, a refugee ID, a community document, or a voucher from a partner organisation.',
      am: 'አያስፈልግም። መታወቂያ ግዴታ አይደለም። ብሔራዊ መታወቂያ ወይም ፓስፖርት፣ የስደተኛ መታወቂያ፣ የማህበረሰብ ሰነድ ወይም ከአጋር ድርጅት የተሰጠ ማረጋገጫ መጠቀም ይችላሉ።',
    },
    keywords: ['id', 'passport', 'document', 'kebele', 'refugee', 'identity', 'voucher', 'መታወቂያ', 'ፓስፖርት', 'ሰነድ', 'ቀበሌ', 'ስደተኛ'],
  },
  {
    id: 'privacy',
    question: { en: 'Who can see my disability or support needs?', am: 'የአካል ጉዳቴን ወይም የድጋፍ ፍላጎቴን ማን ማየት ይችላል?' },
    answer: {
      en: 'Only you. Your support needs stay private and are never shared with an employer unless you tick the box that allows it. You can change your mind at any time.',
      am: 'እርስዎ ብቻ። የድጋፍ ፍላጎትዎ ሚስጥር ሆኖ ይቆያል፣ እርስዎ ካልፈቀዱ በስተቀር ለቀጣሪ አይጋራም። ውሳኔዎን በማንኛውም ጊዜ መቀየር ይችላሉ።',
    },
    keywords: ['disability', 'private', 'privacy', 'share', 'shared', 'see my', 'employer see', 'secret', 'safe', 'አካል ጉዳ', 'ሚስጥር', 'ግላዊ', 'ማን ማየት', 'ይጋራ', 'ማጋራ'],
  },
  {
    id: 'offline',
    question: { en: 'What happens if my internet drops?', am: 'ኢንተርኔት ቢቋረጥ ምን ይሆናል?' },
    answer: {
      en: 'Nothing is lost. Your answers are saved on this device and sent automatically when you are back online. A message shows how many answers are waiting and when they are synced.',
      am: 'ምንም አይጠፋም። መልሶችዎ በዚህ መሳሪያ ላይ ይቀመጣሉ፣ ኢንተርኔት ሲመለስ በራሱ ይላካሉ። ስንት መልስ እንደሚጠብቅ እና መቼ እንደተላከ መልዕክት ያሳያል።',
    },
    keywords: ['internet', 'offline', 'network', 'connection', 'data', 'drops', 'lost', 'save', 'ኢንተርኔት', 'ኔትወርክ', 'ኔትዎርክ', 'ቢቋረጥ', 'ይጠፋ', 'ዳታ', 'ይቀመጣ'],
  },
  {
    id: 'access',
    question: { en: 'Can I use it without a mouse or with a screen reader?', am: 'ያለ ማውስ ወይም በስክሪን አንባቢ መጠቀም እችላለሁ?' },
    answer: {
      en: 'Yes. Every step works by keyboard alone: Tab to move, Enter or Space to choose. It is tested with NVDA and TalkBack, and you can also answer by voice or press Read aloud.',
      am: 'አዎ። እያንዳንዱ ደረጃ በቁልፍ ሰሌዳ ብቻ ይሰራል፤ ለመንቀሳቀስ Tab፣ ለመምረጥ Enter ወይም Space ይጫኑ። በNVDA እና TalkBack ተፈትኗል፣ በድምፅም መመለስ ወይም "ጮክ ብሎ አንብብ" መጫን ይችላሉ።',
    },
    keywords: ['keyboard', 'mouse', 'screen reader', 'blind', 'voice', 'speak', 'nvda', 'talkback', 'accessible', 'deaf', 'sign', 'ቁልፍ ሰሌዳ', 'ኪቦርድ', 'ማውስ', 'ስክሪን አንባቢ', 'ዓይነ ስውር', 'አይነ ስውር', 'ድምፅ', 'ድምጽ', 'መስማት'],
  },
  {
    id: 'language',
    question: { en: 'How do I change the language?', am: 'ቋንቋውን እንዴት እቀይራለሁ?' },
    answer: {
      en: 'Use the English or Amharic button at the top of the page. Your answers are kept when you switch, and Amharic uses the Ethiopian calendar for dates.',
      am: 'በገጹ አናት ላይ ያለውን "English" ወይም "አማርኛ" ቁልፍ ይጫኑ። ቋንቋ ሲቀይሩ መልሶችዎ አይጠፉም፣ አማርኛ ለቀኖች የኢትዮጵያን ዘመን አቆጣጠር ይጠቀማል።',
    },
    keywords: ['language', 'amharic', 'english', 'translate', 'switch', 'ቋንቋ', 'አማርኛ', 'እንግሊዝኛ', 'ቀይር', 'እቀይራ'],
  },
  {
    id: 'jobs',
    question: { en: 'How do I find a job that fits my needs?', am: 'ፍላጎቴን የሚያሟላ ስራ እንዴት አገኛለሁ?' },
    answer: {
      en: 'Open Career Gateway. Filter jobs by the support they offer, such as remote work, flexible hours, screen reader software or a wheelchair accessible office, then apply with one form.',
      am: 'የሙያ መግቢያን ይክፈቱ። ስራዎችን በሚሰጡት ድጋፍ ያጣሩ፣ ለምሳሌ ከቤት መስራት፣ ተለዋዋጭ ሰዓት፣ የስክሪን አንባቢ ሶፍትዌር ወይም ለዊልቸር ተደራሽ ቢሮ፣ ከዚያ በአንድ ቅጽ ያመልክቱ።',
    },
    keywords: ['job', 'jobs', 'work', 'career', 'apply', 'employment', 'vacancy', 'ስራ', 'ሥራ', 'ሙያ', 'ማመልከት', 'ያመልክ', 'ቅጥር'],
  },
  {
    id: 'employer',
    question: { en: 'I am an employer. How do I offer accommodations?', am: 'ቀጣሪ ነኝ። ማመቻቸቶችን እንዴት አቀርባለሁ?' },
    answer: {
      en: 'Use the employer form on the jobs page. Tick the support you offer. The form suggests low cost adjustments, like screen reader software or flexible hours, with a short note on each.',
      am: 'በስራ ገጹ ላይ ያለውን የቀጣሪ ቅጽ ይጠቀሙ። የሚሰጡትን ድጋፍ ይምረጡ። ቅጹ እንደ ስክሪን አንባቢ ሶፍትዌር ወይም ተለዋዋጭ ሰዓት ያሉ ዝቅተኛ ወጪ ማስተካከያዎችን ከአጭር ማብራሪያ ጋር ይጠቁማል።',
    },
    keywords: ['employer', 'company', 'hire', 'hiring', 'post a job', 'accommodation', 'adjustment', 'ቀጣሪ', 'ድርጅት', 'መቅጠር', 'ማመቻቸ', 'ማስተካከያ'],
  },
  {
    id: 'time',
    question: { en: 'How long does it take and does it cost anything?', am: 'ምን ያህል ጊዜ ይወስዳል? ክፍያ አለው?' },
    answer: {
      en: 'It is free and takes about five minutes over a few short steps. There is no time limit, and you can stop and continue later on the same device.',
      am: 'ነፃ ነው፣ በጥቂት አጭር ደረጃዎች አምስት ደቂቃ ያህል ይወስዳል። የጊዜ ገደብ የለም፣ አቁመው በኋላ በዚሁ መሳሪያ መቀጠል ይችላሉ።',
    },
    keywords: ['how long', 'time', 'minutes', 'cost', 'free', 'pay', 'price', 'later', 'continue', 'resume', 'ጊዜ', 'ደቂቃ', 'ክፍያ', 'ነፃ', 'ነጻ', 'ዋጋ', 'በኋላ', 'መቀጠል'],
  },
  {
    id: 'calendar',
    question: { en: 'Can I enter my birth date in the Ethiopian calendar?', am: 'የትውልድ ቀኔን በኢትዮጵያ ዘመን አቆጣጠር ማስገባት እችላለሁ?' },
    answer: {
      en: 'Yes. Choose the Ethiopian or Gregorian calendar, including the 13th month Pagume. We convert the date for you.',
      am: 'አዎ። የኢትዮጵያን ወይም የግሪጎሪያን ዘመን አቆጣጠር ይምረጡ፣ 13ኛውን ወር ጳጉሜንም ጨምሮ። ቀኑን እኛ እንቀይርልዎታለን።',
    },
    keywords: ['birth', 'date', 'calendar', 'ethiopian', 'pagume', 'age', 'ትውልድ', 'ቀን', 'ዘመን', 'አቆጣጠር', 'ጳጉሜ', 'ዕድሜ', 'እድሜ'],
  },
];

const FALLBACK = {
  en: 'Sorry, I do not have an answer for that yet. Try asking about ID, privacy, jobs, language, keyboard use or what happens offline.',
  am: 'ይቅርታ፣ ለዚህ ጥያቄ እስካሁን መልስ የለኝም። ስለ መታወቂያ፣ ሚስጥርነት፣ ስራ፣ ቋንቋ፣ ቁልፍ ሰሌዳ አጠቃቀም ወይም ኢንተርኔት ሲቋረጥ ስለሚሆነው ይጠይቁ።',
};

/** Fold Ethiopic letters that sound the same (ሠ/ሰ, ሐ/ኀ/ሀ, ዐ/አ, ፀ/ጸ) and Latin case so spelling variants match. */
export function normaliseHelpText(raw: string): string {
  let out = '';
  for (const char of raw.toLowerCase()) {
    const code = char.codePointAt(0)!;
    const row = (start: number, target: number) => (code >= start && code < start + 8 ? target + (code - start) : -1);
    const folded = [row(0x1220, 0x1230), row(0x1210, 0x1200), row(0x1280, 0x1200), row(0x12d0, 0x12a0), row(0x1340, 0x1338)].find((value) => value >= 0);
    out += folded !== undefined ? String.fromCodePoint(folded) : char;
  }
  return out.replace(/[?!.,;:"'()።፣፤፥፦፧፨]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Amharic questions are answered in Amharic and English questions in English, whatever the page language is. */
export function detectHelpLang(question: string, fallback: HelpLang = 'en'): HelpLang {
  if (/[ሀ-፿]/.test(question)) return 'am';
  if (/[a-z]/i.test(question)) return 'en';
  return fallback;
}

export function answerHelpQuestion(question: string, preferred: HelpLang = 'en'): HelpAnswer {
  const lang = detectHelpLang(question, preferred);
  const text = ` ${normaliseHelpText(question)} `;
  let best: HelpEntry | undefined;
  let bestScore = 0;
  for (const entry of HELP_ENTRIES) {
    let score = 0;
    for (const keyword of entry.keywords) {
      const key = normaliseHelpText(keyword);
      // Latin keywords must match whole words ("id" must not match "provide"); Amharic stems match inside words.
      const hit = /[a-z]/.test(key) ? text.includes(` ${key} `) : text.includes(key);
      if (hit) score += key.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  if (!best) return { id: 'fallback', lang, question: question.trim(), answer: FALLBACK[lang], matched: false };
  return { id: best.id, lang, question: best.question[lang], answer: best.answer[lang], matched: true };
}
