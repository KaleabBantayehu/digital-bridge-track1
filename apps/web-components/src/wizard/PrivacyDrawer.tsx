import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, Trash2, X } from 'lucide-react';
import type { Lang, OnboardingProfile } from '@db/shared-schemas';
import { t } from '../i18n';
import { cleanId, ui } from './ui';

export interface PrivacyDrawerProps {
  lang: Lang;
  open: boolean;
  onClose: () => void;
  profile: OnboardingProfile;
  /** Clears store + local storage + API data. Resolves when done. */
  onDelete: () => Promise<void>;
  announce: (message: string) => void;
}

/** Native <dialog> + showModal(): Esc closes, focus is trapped and returns to the opener (WCAG 2.1.2, 2.4.3). */
export const PrivacyDrawer: React.FC<PrivacyDrawerProps> = ({ lang, open, onClose, profile, onDelete, announce }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = cleanId(useId());
  const previewId = cleanId(useId());
  const [exportJson, setExportJson] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const root = dialog.getRootNode() as Document | ShadowRoot;
      openerRef.current = (root.activeElement as HTMLElement | null) ?? null;
      setExportJson('');
      setConfirming(false);
      setStatus('');
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const handleClose = () => {
    onClose();
    openerRef.current?.focus();
  };

  const exportData = () => {
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), profile }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    setExportJson(json);
    setDownloadUrl(url);
    setStatus(t(lang, 'privacy.exportReady'));
    announce(t(lang, 'privacy.exportReady'));
    // Let React render the href first, then trigger the download.
    requestAnimationFrame(() => downloadRef.current?.click());
  };

  const confirmDelete = async () => {
    await onDelete();
    setConfirming(false);
    setExportJson('');
    setStatus(t(lang, 'privacy.deleted'));
    announce(t(lang, 'privacy.deleted'));
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onClose={handleClose} className={ui.dialog} lang={lang}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id={titleId} className="text-xl font-bold">{t(lang, 'privacy.title')}</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label={t(lang, 'common.close')} className={ui.btnQuiet}>
            <X aria-hidden="true" focusable="false" className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4">{t(lang, 'privacy.body')}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={exportData} className={ui.btnSecondary}>
            <Download aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t(lang, 'privacy.export')}
          </button>
          {!confirming && (
            <button type="button" onClick={() => setConfirming(true)} className={`${ui.btnSecondary} !text-red-800 !border-red-800`}>
              <Trash2 aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'privacy.delete')}
            </button>
          )}
        </div>
        <a ref={downloadRef} href={downloadUrl || undefined} download="digital-bridge-my-data.json" hidden tabIndex={-1}>
          {t(lang, 'privacy.export')}
        </a>

        {confirming && (
          <div className="mb-4 rounded-md border-2 border-red-800 bg-white p-3">
            <p className="mb-3 font-semibold">{t(lang, 'privacy.confirm')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" ref={confirmRef} onClick={confirmDelete} className={`${ui.btnPrimary} !bg-red-800 !border-red-800`}>
                {t(lang, 'privacy.confirmYes')}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={ui.btnQuiet}>
                {t(lang, 'common.cancel')}
              </button>
            </div>
          </div>
        )}

        {status && <p className="mb-3 font-semibold">{status}</p>}

        {exportJson && (
          <div className="mb-4">
            <label htmlFor={previewId} className={ui.label}>{t(lang, 'privacy.preview')}</label>
            <textarea id={previewId} readOnly value={exportJson} rows={8} lang="en" className={`${ui.input} font-mono text-sm`} />
          </div>
        )}

        <button type="button" onClick={() => dialogRef.current?.close()} className={ui.btnPrimary}>
          {t(lang, 'common.close')}
        </button>
      </div>
    </dialog>
  );
};
