import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Circle, Delete, Hand, RotateCcw, Square, Video, VideoOff, X } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t as translate, type I18nKey } from '../i18n';
import { cleanId, cx, ui } from '../wizard/ui';
import { blobToDataUrl } from './speech';
import { setVoiceNote } from './voiceNotes';
import type { SpokenKind } from './spokenInput';

export interface SignPanelProps {
  lang: Lang;
  fieldLabel: string;
  /** Where a kept sign-language video is stored (same map as voice notes, so a kept video answers the field). */
  voiceNoteKey?: string;
  spokenKind: SpokenKind;
  onUse: (text: string) => void;
  onClose: () => void;
  announce?: (message: string) => void;
}

const MAX_VIDEO_MS = 20_000;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function pickVideoMime(): string | undefined {
  const types = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type));
}

/**
 * Sign language answer (co-designer finding: "also sign language support").
 *
 * Honest by design: nothing here recognises signs automatically (no browser-only model can read Ethiopian Sign
 * Language reliably today). The learner can
 *  1. record a short sign-language video that a person who knows EthSL reviews - kept like a voice note, so the field
 *     is answered and the learner continues without typing;
 *  2. build the answer from number, letter and word cards; and
 *  3. optionally drive the cards with "camera wave control": hand movement on the left / middle / right of the camera
 *     picture moves back / chooses / moves forward (a switch-style input, not sign recognition).
 * Everything runs in the browser; no video leaves the device.
 */
export const SignPanel: React.FC<SignPanelProps> = ({ lang, fieldLabel, voiceNoteKey, spokenKind, onUse, onClose, announce }) => {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key as I18nKey, vars);
  const uid = cleanId(useId());
  const titleId = `${uid}-title`;
  const resultId = `${uid}-result`;
  const previewLabelId = `${uid}-preview`;
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef(0);
  const secondsRef = useRef<number | undefined>(undefined);
  const limitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [camera, setCamera] = useState<'off' | 'on' | 'blocked'>('off');
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [note, setNote] = useState('');
  const [built, setBuilt] = useState('');
  const [current, setCurrent] = useState(0);
  const [wave, setWave] = useState(false);
  const [zones, setZones] = useState([0, 0, 0]);

  const words = [t('sign.wordYes'), t('sign.wordNo')];
  const cards = [...DIGITS, ...LETTERS, ...words];
  const canFilm = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const canRecord = canFilm && typeof MediaRecorder !== 'undefined' && !!voiceNoteKey;

  const say = (message: string) => {
    setNote(message);
    announce?.(message);
  };

  const stopCamera = () => {
    clearTimeout(limitRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
    setWave(false);
    setCamera((c) => (c === 'blocked' ? c : 'off'));
  };

  // Camera and recorder are always released when the panel closes (CLAUDE.md §2.11).
  useEffect(() => () => stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const startCamera = async () => {
    if (streamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
      streamRef.current = stream;
      setCamera('on');
      say(t('sign.cameraOn'));
      requestAnimationFrame(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          void liveVideoRef.current.play().catch(() => {});
        }
      });
      return true;
    } catch {
      setCamera('blocked');
      say(t('sign.cameraBlocked'));
      return false;
    }
  };

  // ---- Sign language video note ---------------------------------------------------------------------------------
  const startRecording = async () => {
    if (!(await startCamera()) || !streamRef.current) return;
    setPreviewUrl('');
    blobRef.current = null;
    const mimeType = pickVideoMime();
    const recorder = new MediaRecorder(streamRef.current, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 150_000 });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      clearTimeout(limitRef.current);
      secondsRef.current = (Date.now() - startedAtRef.current) / 1000;
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'video/webm' });
      if (!blob.size) {
        say(t('note.error'));
        return;
      }
      blobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
      say(t('sign.recorded'));
    };
    recorderRef.current = recorder;
    recorder.start();
    startedAtRef.current = Date.now();
    setRecording(true);
    say(t('sign.recording'));
    limitRef.current = setTimeout(() => recorder.state === 'recording' && recorder.stop(), MAX_VIDEO_MS);
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const keepVideo = async () => {
    if (!voiceNoteKey || !blobRef.current) return;
    let saved = false;
    try {
      saved = setVoiceNote(voiceNoteKey, await blobToDataUrl(blobRef.current), secondsRef.current);
    } catch {
      saved = false;
    }
    if (!saved) {
      say(t('note.tooBig'));
      return;
    }
    blobRef.current = null;
    setPreviewUrl('');
    say(t('sign.kept', { field: fieldLabel }));
  };

  // ---- Cards ------------------------------------------------------------------------------------------------------
  const addCard = (item: string) => {
    setBuilt((text) => {
      const isWord = item.length > 1;
      return isWord ? `${text}${text && !text.endsWith(' ') ? ' ' : ''}${item}` : `${text}${item}`;
    });
    announce?.(t('sign.added', { item }));
  };

  const useBuilt = () => {
    let text = built.trim();
    if (!text) return;
    if (spokenKind === 'email') text = text.toLowerCase().replace(/\s+/g, '');
    else if (spokenKind === 'code' || spokenKind === 'tel') text = text.toUpperCase().replace(/\s+/g, '');
    else text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    onUse(text);
    setBuilt('');
    announce?.(t('voice.used'));
  };

  // ---- Camera wave control (switch-style input, not sign recognition) --------------------------------------------
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    if (!wave || camera !== 'on') return;
    const canvas = canvasRef.current;
    const video = liveVideoRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !video || !ctx) return;
    let previous: Uint8ClampedArray | null = null;
    const streak = [0, 0, 0];
    let cooldown = 0;
    const timer = setInterval(() => {
      if (video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const energy = [0, 0, 0];
      if (previous) {
        for (let i = 0; i < frame.length; i += 4) {
          const x = (i / 4) % canvas.width;
          const diff = Math.abs(frame[i] - previous[i]) + Math.abs(frame[i + 1] - previous[i + 1]) + Math.abs(frame[i + 2] - previous[i + 2]);
          if (diff > 60) energy[Math.min(2, Math.floor((x / canvas.width) * 3))] += 1;
        }
      }
      previous = frame;
      // The picture is mirrored for the learner, so the camera's left third is the learner's right side.
      const mirrored = [energy[2], energy[1], energy[0]];
      const area = (canvas.width * canvas.height) / 3;
      const levels = mirrored.map((e) => Math.min(1, e / (area * 0.25)));
      setZones(levels);
      if (cooldown > 0) {
        cooldown--;
        return;
      }
      levels.forEach((level, zone) => {
        streak[zone] = level > 0.35 && level === Math.max(...levels) ? streak[zone] + 1 : 0;
      });
      const fired = streak.findIndex((n) => n >= 3);
      if (fired < 0) return;
      streak.fill(0);
      cooldown = 6;
      if (fired === 1) {
        const item = cards[currentRef.current];
        addCard(item);
        announce?.(t('sign.waveChose', { item }));
      } else {
        const next = (currentRef.current + (fired === 0 ? -1 : 1) + cards.length) % cards.length;
        setCurrent(next);
        announce?.(cards[next]);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [wave, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = (item: string, index: number) => (
    <button
      key={item}
      type="button"
      onClick={() => {
        setCurrent(index);
        addCard(item);
      }}
      aria-current={wave && index === current ? 'true' : undefined}
      className={cx(ui.btnSecondary, 'min-w-[48px] text-lg', item.length > 1 && 'text-base', wave && index === current && 'ring-4 ring-offset-2 ring-ink')}
    >
      {item}
    </button>
  );

  return (
    <div role="group" aria-labelledby={titleId} className="mt-3 rounded-xl border-2 border-terracotta bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h3 id={titleId} className="flex items-center gap-2 text-lg font-bold">
          <Hand aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
          {t('sign.title')}
        </h3>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className={ui.btnQuiet}>
          <X aria-hidden="true" focusable="false" className="h-5 w-5" />
        </button>
      </div>
      <p className="mb-1">{t('sign.intro')}</p>
      <p className={ui.hint}>{t('sign.honest')}</p>

      {canFilm && (
        <div role="group" aria-labelledby={`${uid}-video`} className="mt-3">
          <h4 id={`${uid}-video`} className="font-semibold mb-2">{t('sign.videoTitle')}</h4>
          <div className="flex flex-wrap gap-2">
            {camera !== 'on' ? (
              <button type="button" onClick={() => void startCamera()} className={ui.btnSecondary}>
                <Video aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
                {t('sign.cameraStart')}
              </button>
            ) : (
              <button type="button" onClick={stopCamera} className={ui.btnSecondary}>
                <VideoOff aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
                {t('sign.cameraStop')}
              </button>
            )}
            {canRecord && (
              <button
                type="button"
                onClick={recording ? stopRecording : () => void startRecording()}
                aria-pressed={recording}
                data-db-action="sign-record"
                className={ui.btnToggle(recording)}
              >
                {recording ? <Square aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" /> : <Circle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />}
                {recording ? t('note.stop') : t('sign.record')}
              </button>
            )}
          </div>
          {camera === 'on' && (
            <video
              ref={liveVideoRef}
              muted
              playsInline
              aria-label={t('sign.preview')}
              className="mt-2 w-full max-w-[20rem] rounded-lg border-2 border-ink [transform:scaleX(-1)]"
            />
          )}
          {previewUrl && (
            <div className="mt-3">
              <p id={previewLabelId} className={ui.label}>{t('sign.previewLabel', { field: fieldLabel })}</p>
              <video controls src={previewUrl} aria-labelledby={previewLabelId} className="w-full max-w-[20rem] rounded-lg" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => void keepVideo()} className={ui.btnPrimary}>
                  <Check aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
                  {t('sign.keep')}
                </button>
                <button type="button" onClick={() => void startRecording()} className={ui.btnSecondary}>
                  <RotateCcw aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
                  {t('note.again')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {note && <p className="mt-2 text-sm font-semibold" data-db-sign-status="">{note}</p>}

      <div role="group" aria-labelledby={`${uid}-cards`} className="mt-4">
        <h4 id={`${uid}-cards`} className="font-semibold mb-1">{t('sign.cardsTitle')}</h4>
        <p className={ui.hint}>{t('sign.cardsHint')}</p>

        {canFilm && (
          <div className="mt-2">
            <button
              type="button"
              aria-pressed={wave}
              aria-describedby={`${uid}-wave`}
              onClick={async () => {
                if (!wave && !(await startCamera())) return;
                setWave((on) => !on);
              }}
              className={ui.btnToggle(wave)}
            >
              <Hand aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t('sign.waveToggle')}
            </button>
            <p id={`${uid}-wave`} className={cx(ui.hint, 'mt-1')}>{t('sign.waveHint')}</p>
            {wave && (
              <div aria-hidden="true" className="mt-1 flex max-w-[20rem] gap-1">
                {zones.map((level, i) => (
                  <span key={i} className="h-3 flex-1 rounded-full bg-sand-light">
                    <span className="block h-3 rounded-full bg-terracotta" style={{ width: `${Math.round(level * 100)}%` }} />
                  </span>
                ))}
                <canvas ref={canvasRef} width={48} height={36} className="hidden" />
              </div>
            )}
          </div>
        )}

        {[
          ['sign.numbers', DIGITS, 0],
          ['sign.letters', LETTERS, DIGITS.length],
          ['sign.words', words, DIGITS.length + LETTERS.length],
        ].map(([key, items, offset]) => (
          <div key={key as string} role="group" aria-label={t(key as string)} className="mt-3">
            <p className="text-sm font-semibold mb-1" aria-hidden="true">{t(key as string)}</p>
            <div className="flex flex-wrap gap-2">{(items as string[]).map((item, i) => card(item, (offset as number) + i))}</div>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setBuilt((text) => `${text} `)} className={ui.btnQuiet}>
            {t('sign.space')}
          </button>
          <button type="button" onClick={() => setBuilt((text) => text.slice(0, -1))} className={ui.btnQuiet}>
            <Delete aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t('sign.delete')}
          </button>
        </div>

        <label htmlFor={resultId} className={cx(ui.label, 'mt-3')}>{t('sign.result')}</label>
        <input id={resultId} type="text" value={built} onChange={(e) => setBuilt(e.target.value)} className={ui.input} />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={useBuilt} disabled={!built.trim()} className={ui.btnPrimary}>
            <Check aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t('voice.use')}
          </button>
          <button type="button" onClick={() => setBuilt('')} disabled={!built} className={ui.btnQuiet}>
            {t('sign.clear')}
          </button>
        </div>
      </div>
    </div>
  );
};
