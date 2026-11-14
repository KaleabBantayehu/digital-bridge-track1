import type { ErrorCode, Lang, OnboardingProfile } from '@db/shared-schemas';
import type { I18nKey, Translate } from '../i18n';
import type { Dev2Services } from './services';
import type { PartnerDraft } from './validation';

export type FieldErrors = Partial<Record<string, ErrorCode>>;

export interface StepProps {
  lang: Lang;
  t: Translate;
  simple: boolean;
  /** Prefix for every field id in this widget (unique per shadow root). */
  idBase: string;
  profile: OnboardingProfile;
  /** Auto-saves on every change (Dev 1's store persists it). */
  update: (partial: Partial<OnboardingProfile>) => void;
  errors: FieldErrors;
  /** Localised error message for a field, if it has an error. */
  errorFor: (field: string) => string | undefined;
  announce: (message: string) => void;
  services: Dev2Services;
  openPrivacy: () => void;
  goToStep: (step: number) => void;
  partnerDraft: PartnerDraft;
  setPartnerDraft: (draft: PartnerDraft) => void;
  /** Optional (additive): true when the wizard is mounted as the "My Profile" editor (mode="edit"). */
  editMode?: boolean;
}

export const fieldId = (idBase: string, field: string) => `${idBase}-${field}`;

export interface StepDefinition {
  titleKey: I18nKey;
  hintKey: I18nKey;
  simpleHintKey: I18nKey;
}

/** Field name -> i18n label key, used by the Error Summary. */
export const FIELD_LABELS: Record<string, I18nKey> = {
  saveAnswers: 'consent.saveAnswers',
  givenName: 'field.givenName',
  familyName: 'field.familyName',
  phone: 'field.phone',
  email: 'field.email',
  dob: 'field.dob',
  route: 'field.route',
  referenceNumber: 'field.referenceNumber',
  documentKind: 'field.documentKind',
  partnerId: 'field.partnerId',
  agentId: 'field.agentId',
  partnerConsent: 'field.partnerConsent',
};
