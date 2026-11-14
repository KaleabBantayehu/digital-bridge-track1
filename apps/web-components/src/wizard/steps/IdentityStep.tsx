import React, { useState } from 'react';
import { AlertCircle, BadgeCheck, FileText, Handshake, Contact } from 'lucide-react';
import type { IdentityRoute, IdentityVerification } from '@db/shared-schemas';
import { TextField } from '../../fields/TextField';
import { CheckboxField } from '../../fields/CheckboxField';
import { SelectField } from '../../fields/SelectField';
import { fieldId, type StepProps } from '../types';
import { buildPartnerVoucher } from '../validation';
import { ui } from '../ui';

/** Partner organisations named in the brief. Names are proper nouns in Latin script, tagged lang="en". */
export const PARTNER_ORGS = [
  { id: 'aaapd', name: 'AAAPD' },
  { id: 'snv', name: 'SNV Ethiopia' },
  { id: 'mercy-corps', name: 'Mercy Corps' },
  { id: 'tomorrow-is-better', name: 'Tomorrow is Better' },
];

const ROUTES: { route: IdentityRoute; Icon: typeof Contact }[] = [
  { route: 'national_id_or_passport', Icon: Contact },
  { route: 'refugee_id', Icon: BadgeCheck },
  { route: 'community_document', Icon: FileText },
  { route: 'partner_voucher', Icon: Handshake },
];

const DOC_KINDS = ['school_certificate', 'birth_record', 'ward_letter'] as const;

export const IdentityStep: React.FC<StepProps> = ({
  lang, t, simple, idBase, profile, update, errorFor, announce, services, partnerDraft, setPartnerDraft,
}) => {
  const identity = profile.identity;
  const [requesting, setRequesting] = useState(false);
  const routeError = errorFor('route');

  const setIdentity = (next: IdentityVerification) => update({ identity: next });
  const chooseRoute = (route: IdentityRoute) => {
    if (identity?.route === route) return;
    setIdentity({ route }); // switching routes drops data from the old route (data minimisation)
  };

  const changeDraft = (partial: Partial<typeof partnerDraft>) => {
    const draft = { ...partnerDraft, ...partial };
    setPartnerDraft(draft);
    if (draft.consent && draft.partnerId && draft.agentId.trim()) {
      setIdentity({ route: 'partner_voucher', partnerVoucher: buildPartnerVoucher(draft, identity?.partnerVoucher) });
    } else if (identity?.partnerVoucher) {
      setIdentity({ route: 'partner_voucher' }); // consent withdrawn: forget the voucher request
    }
  };

  const requestVoucher = async () => {
    if (!partnerDraft.consent || !partnerDraft.partnerId || !partnerDraft.agentId.trim()) return;
    setRequesting(true);
    announce(t('partner.requesting'));
    try {
      const result = await services.requestPartnerVouch({ partnerId: partnerDraft.partnerId, agentId: partnerDraft.agentId.trim(), profileId: profile.id });
      const voucher = buildPartnerVoucher(partnerDraft, identity?.partnerVoucher);
      setIdentity({ route: 'partner_voucher', partnerVoucher: { ...voucher, referralCode: result.referralCode, status: result.status } });
      announce(t('partner.vouched', { code: result.referralCode }));
    } finally {
      setRequesting(false);
    }
  };

  const routeErrorId = routeError ? `${fieldId(idBase, 'route')}-error` : undefined;

  return (
    <>
      <fieldset className={ui.fieldset} aria-describedby={routeErrorId}>
        <legend className={ui.legend}>
          {t('id.legend')} <span className="font-normal">{t('wizard.required')}</span>
        </legend>
        {routeError && (
          <p id={routeErrorId} className={ui.error}>
            <AlertCircle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            <span>{routeError}</span>
          </p>
        )}
        {ROUTES.map(({ route, Icon }, index) => {
          const id = index === 0 ? fieldId(idBase, 'route') : fieldId(idBase, `route-${route}`);
          const hintId = `${id}-hint`;
          return (
            <div key={route} className={`${ui.checkRow} border-b border-stone-200 last:border-b-0`}>
              <input
                id={id}
                type="radio"
                name={fieldId(idBase, 'identity-route')}
                value={route}
                checked={identity?.route === route}
                onChange={() => chooseRoute(route)}
                aria-describedby={hintId}
                aria-invalid={routeError ? true : undefined}
                className={ui.checkbox}
              />
              <label htmlFor={id} className="cursor-pointer">
                <span className="flex items-center gap-2 font-semibold">
                  {simple && <Icon aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0 text-terracotta" />}
                  {t(`id.${route}`)}
                </span>
                <span id={hintId} className="block text-sm text-stone-700">
                  {t(`id.${route}.hint`)}
                </span>
              </label>
            </div>
          );
        })}
      </fieldset>

      {(identity?.route === 'national_id_or_passport' || identity?.route === 'refugee_id') && (
        <TextField
          id={fieldId(idBase, 'referenceNumber')}
          spokenKind="code"
          lang={lang}
          label={t('field.referenceNumber')}
          hint={t('field.referenceNumber.hint')}
          value={identity.referenceNumber ?? ''}
          onChange={(v) => setIdentity({ ...identity, referenceNumber: v })}
          error={errorFor('referenceNumber')}
          autoComplete="off"
          spellCheck={false}
          required
          announce={announce}
        />
      )}

      {identity?.route === 'community_document' && (
        <>
          <SelectField
            id={fieldId(idBase, 'documentKind')}
            label={t('field.documentKind')}
            value={identity.documentKind ?? ''}
            onChange={(v) => setIdentity({ ...identity, documentKind: (v || undefined) as IdentityVerification['documentKind'] })}
            options={DOC_KINDS.map((kind) => ({ value: kind, label: t(`doc.${kind}`) }))}
            placeholder={t('wizard.choose')}
            error={errorFor('documentKind')}
            required
            requiredText={t('wizard.required')}
          />
          <TextField
            id={fieldId(idBase, 'docReference')}
            spokenKind="code"
            lang={lang}
            label={t('field.docReference')}
            hint={t('field.docReference.hint')}
            value={identity.referenceNumber ?? ''}
            onChange={(v) => setIdentity({ ...identity, referenceNumber: v })}
            autoComplete="off"
            spellCheck={false}
            optional
            announce={announce}
          />
        </>
      )}

      {identity?.route === 'partner_voucher' && (
        <div className={ui.card}>
          <SelectField
            id={fieldId(idBase, 'partnerId')}
            label={t('field.partnerId')}
            value={partnerDraft.partnerId}
            onChange={(v) => changeDraft({ partnerId: v })}
            options={PARTNER_ORGS.map((o) => ({ value: o.id, label: o.name, lang: 'en' }))}
            placeholder={t('wizard.choose')}
            error={errorFor('partnerId')}
            required
            requiredText={t('wizard.required')}
          />
          <TextField
            id={fieldId(idBase, 'agentId')}
            spokenKind="code"
            lang={lang}
            label={t('field.agentId')}
            hint={t('field.agentId.hint')}
            value={partnerDraft.agentId}
            onChange={(v) => changeDraft({ agentId: v })}
            error={errorFor('agentId')}
            autoComplete="off"
            spellCheck={false}
            required
            announce={announce}
          />
          <CheckboxField
            id={fieldId(idBase, 'partnerConsent')}
            label={t('partner.consent')}
            checked={partnerDraft.consent}
            onChange={(v) => changeDraft({ consent: v })}
            error={errorFor('partnerConsent')}
            required
            requiredText={t('wizard.required')}
          />
          <button
            type="button"
            onClick={requestVoucher}
            disabled={requesting || !partnerDraft.consent || !partnerDraft.partnerId || !partnerDraft.agentId.trim()}
            className={`${ui.btnSecondary} mt-2`}
          >
            <Handshake aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t('partner.request')}
          </button>
          {identity.partnerVoucher?.status === 'vouched' && identity.partnerVoucher.referralCode && (
            <p className="mt-3 flex items-center gap-2 font-semibold">
              <BadgeCheck aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0 text-green-800" />
              {t('partner.vouched', { code: identity.partnerVoucher.referralCode })}
            </p>
          )}
        </div>
      )}
    </>
  );
};
