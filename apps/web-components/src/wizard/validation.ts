import { normaliseEtPhone, type IdentityVerification, type OnboardingProfile, type VoiceNotes } from '@db/shared-schemas';
import { hasVoiceNote } from '../voice/voiceNotes';
import type { FieldErrors } from './types';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Draft of the "Refer me" form. The schema types partnerVoucher.consent.given as literal `true`,
 * so a half-filled form cannot live in the profile; it lives here until consent is given.
 */
export interface PartnerDraft {
  partnerId: string;
  agentId: string;
  consent: boolean;
}

export const partnerDraftFrom = (p: OnboardingProfile): PartnerDraft => ({
  partnerId: p.identity?.partnerVoucher?.partnerId ?? '',
  agentId: p.identity?.partnerVoucher?.agentId ?? '',
  consent: !!p.identity?.partnerVoucher?.consent.given,
});

/** Validate one step on "Continue" (never on every keystroke). Returns field -> ErrorCode, in DOM order. */
/** A kept voice note (Guide v2 §5) answers a free-text field when speech-to-text is unavailable. */
export function validateStep(step: number, p: OnboardingProfile, partner: PartnerDraft, voiceNotes: VoiceNotes = {}): FieldErrors {
  const errors: FieldErrors = {};
  switch (step) {
    case 0:
      if (!p.consent.saveAnswers) errors.saveAnswers = 'CONSENT_REQUIRED';
      break;
    case 1:
      if (!p.name.givenName.trim() && !hasVoiceNote(voiceNotes, 'givenName')) errors.givenName = 'REQUIRED';
      if (!p.name.familyName.trim() && !hasVoiceNote(voiceNotes, 'familyName')) errors.familyName = 'REQUIRED';
      break;
    case 2: {
      const phone = p.contact.phone?.trim() ?? '';
      if (!phone && !p.contact.viaPartner) errors.phone = 'REQUIRED';
      else if (phone && !normaliseEtPhone(phone)) errors.phone = 'INVALID_ET_PHONE';
      const email = p.contact.email?.trim() ?? '';
      if (email && !EMAIL_RE.test(email)) errors.email = 'INVALID_EMAIL';
      break;
    }
    case 3:
      if (!p.dateOfBirth) errors.dob = 'INVALID_ET_DATE';
      break;
    case 4: {
      const id = p.identity;
      if (!id) {
        errors.route = 'REQUIRED';
        break;
      }
      if ((id.route === 'national_id_or_passport' || id.route === 'refugee_id') && !id.referenceNumber?.trim()) errors.referenceNumber = 'REQUIRED';
      if (id.route === 'community_document' && !id.documentKind) errors.documentKind = 'REQUIRED';
      if (id.route === 'partner_voucher') {
        if (!partner.partnerId) errors.partnerId = 'REQUIRED';
        if (!partner.agentId.trim()) errors.agentId = 'REQUIRED';
        if (!partner.consent) errors.partnerConsent = 'CONSENT_REQUIRED';
      }
      break;
    }
    default:
      break; // Steps 5 (support, optional) and 6 (review) have no required fields.
  }
  return errors;
}

export function buildPartnerVoucher(
  draft: PartnerDraft,
  existing?: IdentityVerification['partnerVoucher'],
): NonNullable<IdentityVerification['partnerVoucher']> {
  const sameRequest = existing && existing.partnerId === draft.partnerId && existing.agentId === draft.agentId.trim();
  return {
    partnerId: draft.partnerId,
    agentId: draft.agentId.trim(),
    referralCode: sameRequest ? existing.referralCode : undefined,
    consent: sameRequest ? existing.consent : { given: true, method: 'checkbox', recordedAt: new Date().toISOString() },
    status: sameRequest ? existing.status : 'requested',
  };
}

/** Normalise values once a step passes validation (phone -> +2519XXXXXXXX, partner draft -> voucher request). */
export function normaliseStep(step: number, p: OnboardingProfile, partner: PartnerDraft): Partial<OnboardingProfile> | null {
  if (step === 2 && p.contact.phone) {
    const phone = normaliseEtPhone(p.contact.phone);
    if (phone && phone !== p.contact.phone) return { contact: { ...p.contact, phone } };
  }
  if (step === 4 && p.identity?.route === 'partner_voucher') {
    return { identity: { route: 'partner_voucher', partnerVoucher: buildPartnerVoucher(partner, p.identity.partnerVoucher) } };
  }
  return null;
}
