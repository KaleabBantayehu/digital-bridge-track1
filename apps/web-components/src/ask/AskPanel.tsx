import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Briefcase, Building2, CalendarDays, Clock, CreditCard, Hand, Info, Keyboard, Languages, Lock, MessageCircleQuestion, Mic, Square, WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { answerHelpQuestion, HELP_ENTRIES, type HelpAnswer, type Lang } from '@db/shared-schemas';
import { makeT } from '../i18n';
import { scriptClass } from '../i18n/script';
import { cleanId, cx, ui } from '../wizard/ui';
import { useVisionMode } from '../wizard/vision';
import { getSpeechRecognition, setFieldListening, speechLocale, type SpeechRecognitionLike } from '../voice/speech';
import { SignPanel } from '../voice/SignPanel';
import { ReadAloudButton } from '../tts/ReadAloudButton';
import { joinTranscripts } from './askVoice';

export interface AskPanelProps {
  lang?: Lang;
  audioBaseUrl?: string;
}

const SUGGESTED = ['id', 'privacy', 'offline', 'jobs'];
/** Stop listening this long after the learner's last words (never before they start speaking). */
const SILENCE_MS = 4000;
/** A "no-speech" error this soon after start means the engine never really listened (common for am-ET). */
const IMMEDIATE_FAIL_MS = 1500;
const CARD_ICONS: Record<string, LucideIcon> = {
  what: Info, id: CreditCard, privacy: Lock, offline: WifiOff, access: Keyboard, language: Languages,
  jobs: Briefcase, employer: Building2, time: Clock, calendar: CalendarDays,
};

/**
 * "Ask a question" help box. Answers come from the shared bilingual help core, so the widget answers instantly and
 * offline, and gives the same answer as POST /api/v1/help/ask. An Amharic question gets an Amharic answer.
 * Questions can be typed, spoken (written live into the box) or asked in sign language (picture cards, or a signed
 * video kept on this device for an interpreter). Questions are not stored on a server or sent anywhere.
 */
export const AskPanel: React.FC<AskPanelProps> = ({ lang = 'en', audioBaseUrl }) => {
  const t = makeT(lang);
  const vision = useVisionMode();
  const idBase = `ask-${cleanId(useId())}`;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<HelpAnswer | null>(null);
  const [asked, setAsked] = useState('');
  const [error, setError] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [amFailed, setAmFailed] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const answerRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const signButtonRef = useRef<HTMLButtonElement>(null);
  const canListen = getSpeechRecognition() !== null;

  // Release the microphone and hand it back to voice control when the widget goes away (CLAUDE.md 2.11).
  useEffect(() => () => {
    clearTimeout(silenceTimer.current);
    if (recognition.current) {
      recognition.current.onend = null;
      recognition.current.abort();
      setFieldListening(false);
    }
  }, []);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(true);
      setStatus(t('ask.empty'));
      inputRef.current?.focus();
      return;
    }
    setError(false);
    const result = answerHelpQuestion(trimmed, lang);
    setAsked(trimmed);
    setAnswer(result);
    setStatus(makeT(result.lang)('ask.answerReady'));
    // Move focus to the answer heading so keyboard and screen reader users land on it (2.4.3).
    requestAnimationFrame(() => answerRef.current?.focus());
  };

  const stopListening = () => {
    clearTimeout(silenceTimer.current);
    recognition.current?.stop();
  };

  const startListening = (voiceLang: Lang) => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setStatus(t('ask.voiceUnavailable'));
      return;
    }
    const engine = new Ctor();
    engine.lang = speechLocale(voiceLang);
    engine.continuous = true; // keep listening until the learner has actually spoken
    engine.interimResults = true; // write words into the box as they are heard
    engine.maxAlternatives = 3;
    const startedAt = Date.now();
    let heardSpeech = false;
    let failed = false;
    let lastText = '';

    const armSilenceStop = () => {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => engine.stop(), SILENCE_MS);
    };
    engine.onspeechstart = () => {
      heardSpeech = true;
      armSilenceStop();
    };
    engine.onresult = (event) => {
      const text = joinTranscripts(event.results);
      if (!text) return;
      heardSpeech = true;
      lastText = text;
      setQuestion(text);
      setError(false);
      armSilenceStop();
    };
    engine.onerror = (event) => {
      if (event.error === 'aborted') return;
      failed = true;
      clearTimeout(silenceTimer.current);
      const amharicNotReady =
        voiceLang === 'am' &&
        (event.error === 'language-not-supported' || (event.error === 'no-speech' && !heardSpeech && Date.now() - startedAt < IMMEDIATE_FAIL_MS));
      if (amharicNotReady) {
        setAmFailed(true);
        setStatus(t('ask.amUnavailable'));
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setStatus(t('ask.voiceDenied'));
      else if (event.error === 'no-speech') setStatus(t('ask.voiceNothing'));
      else setStatus(t('ask.voiceUnavailable'));
    };
    engine.onend = () => {
      clearTimeout(silenceTimer.current);
      recognition.current = null;
      setListening(false);
      setFieldListening(false); // voice control may listen again
      if (failed) return;
      if (lastText) {
        // Never auto-submit speech: the words stay editable in the box and the learner presses Ask (CLAUDE.md 3.8).
        setStatus(t('ask.heard', { text: lastText }));
        inputRef.current?.focus();
      } else if (!heardSpeech) setStatus(t('ask.voiceNothing'));
    };

    recognition.current = engine;
    try {
      setFieldListening(true); // pauses Alt+V voice control on every widget (db-voice-field:active)
      engine.start();
      setListening(true);
      setStatus(t('ask.listening'));
    } catch {
      recognition.current = null;
      setFieldListening(false);
      setListening(false);
      setStatus(t('ask.voiceUnavailable'));
    }
  };

  const toggleVoice = (voiceLang: Lang = lang) => {
    if (listening) stopListening();
    else startListening(voiceLang);
  };

  const toggleSign = () => {
    if (listening) stopListening();
    setSignOpen((open) => !open);
  };

  const closeSign = () => {
    setSignOpen(false);
    requestAnimationFrame(() => signButtonRef.current?.focus());
  };

  const headingId = `${idBase}-heading`;
  const inputId = `${idBase}-input`;
  const hintId = `${idBase}-hint`;
  const errorId = `${idBase}-error`;
  const signRegionId = `${idBase}-sign`;
  const cardsHeadingId = `${idBase}-cards`;

  return (
    <section
      aria-labelledby={headingId}
      lang={lang}
      data-vision-mode={vision}
      className={cx(ui.card, 'my-4 text-ink', scriptClass(lang))}
    >
      <h2 id={headingId} className="flex items-center gap-2 text-xl font-bold mb-2">
        <MessageCircleQuestion aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0" />
        {t('ask.heading')}
      </h2>
      <p className="mb-3">{t('ask.intro')}</p>

      <form
        noValidate
        aria-labelledby={headingId}
        onSubmit={(event) => {
          event.preventDefault();
          if (listening) stopListening();
          ask(question);
        }}
      >
        <div className={ui.field}>
          <label htmlFor={inputId} className={ui.label}>{t('ask.label')}</label>
          <p id={hintId} className={ui.hint}>{t('ask.hint')}</p>
          {error && <p id={errorId} className={ui.error}>{t('ask.empty')}</p>}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            autoComplete="off"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error || undefined}
            data-db-ask-input=""
            className={cx(ui.input, error && ui.inputInvalid)}
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <button type="submit" className={ui.btnPrimary}>{t('ask.submit')}</button>
          {canListen && (
            <button
              type="button"
              aria-pressed={listening}
              onClick={() => toggleVoice()}
              data-db-action="ask-voice"
              className={ui.btnToggle(listening)}
            >
              {listening
                ? <Square aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
                : <Mic aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />}
              {listening ? t('ask.voiceStop') : t('ask.voice')}
            </button>
          )}
          {canListen && amFailed && lang === 'am' && !listening && (
            <button type="button" lang="en" onClick={() => toggleVoice('en')} className={ui.btnSecondary}>
              <Mic aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {makeT('en')('ask.voiceEnglish')}
            </button>
          )}
          <button
            ref={signButtonRef}
            type="button"
            aria-expanded={signOpen}
            aria-controls={signRegionId}
            onClick={toggleSign}
            data-db-action="ask-sign"
            className={ui.btnToggle(signOpen)}
          >
            <Hand aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t('ask.sign')}
          </button>
        </div>
      </form>

      {/* The one live region of this widget: always in the DOM, visible, only its text changes (4.1.3). */}
      <p role="status" aria-live="polite" aria-atomic="true" data-db-ask-status="" className={cx('mb-4 min-h-[1.5rem] text-sm font-semibold')}>
        {status}
      </p>

      <div id={signRegionId} hidden={!signOpen}>
        {signOpen && (
          <>
            <div role="group" aria-labelledby={cardsHeadingId} className="mb-2">
              <h3 id={cardsHeadingId} className="font-semibold mb-1">{t('ask.signCards')}</h3>
              <p className={ui.hint}>{t('ask.signCardsHint')}</p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 list-none p-0 mt-2">
                {HELP_ENTRIES.map((entry) => {
                  const Icon = CARD_ICONS[entry.id] ?? Info;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={cx(ui.btnSecondary, 'w-full justify-start')}
                        onClick={() => {
                          setQuestion(entry.question[lang]);
                          ask(entry.question[lang]);
                        }}
                      >
                        <Icon aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0" />
                        <span>{entry.question[lang]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <SignPanel
              lang={lang}
              fieldLabel={t('ask.label')}
              voiceNoteKey="ask:question"
              spokenKind="text"
              onUse={(text) => {
                setQuestion(text);
                setStatus(t('ask.signUsed'));
                inputRef.current?.focus();
              }}
              onClose={closeSign}
              announce={setStatus}
            />
          </>
        )}
      </div>

      <h3 className="font-semibold mb-2">{t('ask.suggested')}</h3>
      <ul className="flex flex-wrap gap-2 mb-4 list-none p-0">
        {SUGGESTED.map((id) => {
          const entry = HELP_ENTRIES.find((item) => item.id === id);
          if (!entry) return null;
          return (
            <li key={id}>
              <button
                type="button"
                className={ui.btnPill}
                onClick={() => {
                  setQuestion(entry.question[lang]);
                  ask(entry.question[lang]);
                }}
              >
                {entry.question[lang]}
              </button>
            </li>
          );
        })}
      </ul>

      {answer && (
        <div lang={answer.lang} className={cx('rounded-xl border-2 border-ink bg-white p-4', scriptClass(answer.lang))}>
          <h3 ref={answerRef} tabIndex={-1} className="font-bold mb-1 scroll-my-24 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-terracotta-dark">
            {makeT(answer.lang)('ask.answerHeading')}
          </h3>
          <p className="text-sm text-stone-700 mb-2">
            {makeT(answer.lang)('ask.youAsked')}: <span>{asked}</span>
          </p>
          <p className="mb-3" data-db-ask-answer="">{answer.answer}</p>
          <ReadAloudButton
            lang={answer.lang}
            text={answer.answer}
            label={makeT(answer.lang)('ask.readAloud')}
            announce={setStatus}
            audioBaseUrl={audioBaseUrl}
          />
        </div>
      )}
    </section>
  );
};
