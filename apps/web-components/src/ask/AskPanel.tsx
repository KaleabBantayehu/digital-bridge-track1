import React, { useEffect, useId, useRef, useState } from 'react';
import { Mic, MessageCircleQuestion, Square } from 'lucide-react';
import { answerHelpQuestion, HELP_ENTRIES, type HelpAnswer, type Lang } from '@db/shared-schemas';
import { makeT } from '../i18n';
import { scriptClass } from '../i18n/script';
import { LiveRegion, useAnnouncer } from '../wizard/LiveRegion';
import { cleanId, cx, ui } from '../wizard/ui';
import { getSpeechRecognition, speechLocale, type SpeechRecognitionLike } from '../voice/speech';
import { ReadAloudButton } from '../tts/ReadAloudButton';

export interface AskPanelProps {
  lang?: Lang;
  audioBaseUrl?: string;
}

const SUGGESTED = ['id', 'privacy', 'offline', 'jobs'];

/**
 * "Ask a question" help box. Answers come from the shared bilingual help core, so the widget answers instantly and
 * offline, and gives the same answer as POST /api/v1/help/ask. An Amharic question gets an Amharic answer.
 * Questions are not stored or sent anywhere.
 */
export const AskPanel: React.FC<AskPanelProps> = ({ lang = 'en', audioBaseUrl }) => {
  const t = makeT(lang);
  const { announcement, announce } = useAnnouncer();
  const idBase = `ask-${cleanId(useId())}`;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<HelpAnswer | null>(null);
  const [asked, setAsked] = useState('');
  const [error, setError] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const answerRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canListen = getSpeechRecognition() !== null;

  useEffect(() => () => recognition.current?.abort(), []);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(true);
      announce(t('ask.empty'));
      inputRef.current?.focus();
      return;
    }
    setError(false);
    const result = answerHelpQuestion(trimmed, lang);
    setAsked(trimmed);
    setAnswer(result);
    announce(result.answer);
    // Move focus to the answer heading so keyboard and screen reader users land on it (2.4.3).
    requestAnimationFrame(() => answerRef.current?.focus());
  };

  const toggleVoice = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      announce(t('ask.voiceUnavailable'));
      return;
    }
    const engine = new Ctor();
    engine.lang = speechLocale(lang);
    engine.continuous = false;
    engine.interimResults = false;
    engine.maxAlternatives = 1;
    engine.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? '';
      // Never auto-submit speech: put it in the editable field and let the user press Ask (CLAUDE.md 3.8).
      setQuestion(heard);
      announce(t('ask.heard', { text: heard }));
      inputRef.current?.focus();
    };
    engine.onerror = () => announce(t('ask.voiceUnavailable'));
    engine.onend = () => setListening(false);
    recognition.current = engine;
    try {
      engine.start();
      setListening(true);
      announce(t('ask.listening'));
    } catch {
      setListening(false);
      announce(t('ask.voiceUnavailable'));
    }
  };

  const headingId = `${idBase}-heading`;
  const inputId = `${idBase}-input`;
  const hintId = `${idBase}-hint`;
  const errorId = `${idBase}-error`;

  return (
    <section aria-labelledby={headingId} lang={lang} className={cx(ui.card, 'my-4 text-ink', scriptClass(lang))}>
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
            className={cx(ui.input, error && ui.inputInvalid)}
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="submit" className={ui.btnPrimary}>{t('ask.submit')}</button>
          {canListen && (
            <button type="button" aria-pressed={listening} onClick={toggleVoice} className={ui.btnToggle(listening)}>
              {listening
                ? <Square aria-hidden="true" focusable="false" className="h-5 w-5" />
                : <Mic aria-hidden="true" focusable="false" className="h-5 w-5" />}
              {listening ? t('ask.voiceStop') : t('ask.voice')}
            </button>
          )}
        </div>
      </form>

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
          <p className="mb-3">{answer.answer}</p>
          <ReadAloudButton
            lang={answer.lang}
            text={answer.answer}
            label={makeT(answer.lang)('ask.readAloud')}
            announce={announce}
            audioBaseUrl={audioBaseUrl}
          />
        </div>
      )}

      <LiveRegion announcement={announcement} />
    </section>
  );
};
