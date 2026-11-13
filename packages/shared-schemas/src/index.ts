import { z } from 'zod';

export type Lang = 'en' | 'am';
export type CalendarKind = 'ethiopian' | 'gregorian';
export type Localized = { en: string; am: string };
export type StepId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'consent' | 'name' | 'contact' | 'dob' | 'identity' | 'support' | 'review';

export interface EthiopianDate { year: number; month: number /* 1-13 */; day: number; }

export type SupportNeed =
  | 'screen_reader_materials' | 'sign_language_captions' | 'step_free_venue'
  | 'extra_time' | 'high_contrast_large_text' | 'audio_instructions'
  | 'written_not_phone' | 'quiet_workspace' | 'other';

export interface SupportPreferences {
  needs: SupportNeed[];
  otherText?: string;
  tellLearningProvider: boolean;
}

export type IdentityRoute = 'national_id_or_passport' | 'refugee_id' | 'community_document' | 'partner_voucher';

export interface IdentityVerification {
  route: IdentityRoute;
  referenceNumber?: string;
  documentUploadId?: string;
  documentKind?: 'school_certificate' | 'birth_record' | 'ward_letter';
  partnerVoucher?: {
    partnerId: string;
    referralCode?: string;
    agentId?: string;
    consent: { given: true; method: 'checkbox' | 'voice'; recordedAt: string; evidenceRef?: string };
    status: 'requested' | 'vouched' | 'rejected';
  };
}

export interface OnboardingProfile {
  id: string;
  partnerId: string;
  lang: Lang;
  consent: { saveAnswers: boolean; smsResume: boolean; shareWithEmployers: boolean; givenAt: string };
  name: { givenName: string; familyName: string };
  contact: { phone?: string; email?: string; viaPartner?: boolean };
  dateOfBirth?: { iso: string; displayCalendar: CalendarKind; ethiopian?: EthiopianDate };
  identity?: IdentityVerification;
  support?: SupportPreferences;
  progress: { currentStep: number; totalSteps: 6; completedSteps: number[]; completedAt?: string };
  revision: number;
  updatedAt: string;
}

export type SupportFilter = SupportNeed | 'remote' | 'flexible_hours' | 'wheelchair_accessible_office' | 'screen_reader_software';

export interface JobListing {
  id: string;
  title: Localized | string;
  employer: string;
  location: string;
  remote: boolean;
  deadlineIso?: string;
  description: string;
  offeredAccommodations: SupportFilter[];
  contactEmail?: string;
  createdAt: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  applicantProfileId: string;
  answers: { questionId: string; text: string; inputMode: 'typed' | 'voice'; audioRef?: string }[];
  adjustmentRequest?: { items: SupportFilter[]; note?: string; shareConsent: true };
  submittedAt: string;
}

export type ErrorCode =
  | 'REQUIRED' | 'INVALID_ET_PHONE' | 'INVALID_EMAIL' | 'INVALID_ET_DATE' | 'CONSENT_REQUIRED'
  | 'TOKEN_EXPIRED' | 'TOKEN_USED' | 'LTI_BAD_SIGNATURE' | 'LTI_BAD_NONCE' | 'LTI_BAD_AUDIENCE' | 'LTI_EXPIRED' | 'RATE_LIMITED';

export interface BilingualApiError {
  statusCode: number;
  error: 'ValidationError' | 'Unauthorized' | 'Forbidden' | 'NotFound' | 'Conflict' | 'RateLimited' | 'InternalError' | 'LtiLaunchRejected';
  summary: Localized;
  fields: { field: string; code: ErrorCode; message: Localized }[];
}

export const DB_EVENTS = {
  stepSaved: 'db:onboarding-step-saved',
  completed: 'db:onboarding-completed',
  supportRequested: 'db:support-requested',
  jobFilterChanged: 'db:job-filter-changed',
  jobApplied: 'db:job-applied',
  error: 'db:error',
} as const;

export const ETHIOPIAN_MONTHS: { number: number; en: string; am: string }[] = [
  { number: 1, en: 'Meskerem', am: 'መስከረም' },
  { number: 2, en: 'Tikimt', am: 'ጥቅምት' },
  { number: 3, en: 'Hidar', am: 'ኅዳር' },
  { number: 4, en: 'Tahsas', am: 'ታኅሣሥ' },
  { number: 5, en: 'Tir', am: 'ጥር' },
  { number: 6, en: 'Yekatit', am: 'የካቲት' },
  { number: 7, en: 'Megabit', am: 'መጋቢት' },
  { number: 8, en: 'Miazia', am: 'ሚያዝያ' },
  { number: 9, en: 'Ginbot', am: 'ግንቦት' },
  { number: 10, en: 'Sene', am: 'ሰኔ' },
  { number: 11, en: 'Hamle', am: 'ሐምሌ' },
  { number: 12, en: 'Nehase', am: 'ነሐሴ' },
  { number: 13, en: 'Pagume', am: 'ጳጉሜ' },
];

export function daysInEthiopianMonth(year: number, month: number): number {
  if (month >= 1 && month <= 12) return 30;
  if (month === 13) return year % 4 === 3 ? 6 : 5;
  return 30;
}

export function normaliseEtPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '');
  if (/^0[97]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^\+251[97]\d{8}$/.test(digits)) return digits;
  if (/^251[97]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

export const ERROR_MESSAGES: Record<ErrorCode, Localized> = {
  REQUIRED: { en: 'This field is required.', am: 'ይህ ቦታ መሞላት አለበት።' },
  INVALID_ET_PHONE: { en: 'Enter 10 digits, for example 0911 234 567', am: 'ባለ 10 ቁጥር ስልክ ያስገቡ፣ ለምሳሌ 0911 234 567' },
  INVALID_EMAIL: { en: 'Enter a valid email address, for example name@example.com', am: 'ትክክለኛ ኢሜይል ያስገቡ፣ ለምሳሌ name@example.com' },
  INVALID_ET_DATE: { en: 'Select a valid day, month, and year.', am: 'ትክክለኛ ቀን፣ ወር እና ዓመት ይምረጡ።' },
  CONSENT_REQUIRED: { en: 'Please confirm your consent to continue.', am: 'ለመቀጠል እባክዎ ፈቃድዎን ያረጋግጡ።' },
  TOKEN_EXPIRED: { en: 'This link has expired. Request a new link.', am: 'ይህ ማስፈንጠሪያ ጊዜው አልፎበታል። አዲስ ይጠይቁ።' },
  TOKEN_USED: { en: 'This link has already been used.', am: 'ይህ ማስፈንጠሪያ ጥቅም ላይ ውሏል።' },
  LTI_BAD_SIGNATURE: { en: 'LTI launch refused: invalid cryptographic signature.', am: 'የLTI መክፈቻ ተቀባይነት አላገኘም፦ የተሳሳተ ፊርማ።' },
  LTI_BAD_NONCE: { en: 'LTI launch refused: invalid or replayed nonce.', am: 'የLTI መክፈቻ ተቀባይነት አላገኘም፦ ድጋሚ ጥቅም ላይ የዋለ ኖንስ።' },
  LTI_BAD_AUDIENCE: { en: 'LTI launch refused: audience or issuer mismatch.', am: 'የLTI መክፈቻ ተቀባይነት አላገኘም፦ ያልተፈቀደ ምንጭ።' },
  LTI_EXPIRED: { en: 'LTI launch token has expired.', am: 'የLTI መክፈቻ ጊዜው አልፎበታል።' },
  RATE_LIMITED: { en: 'Too many requests. Please wait a moment and try again.', am: 'ብዙ ጥያቄዎች ተልከዋል። እባክዎ ትንሽ ቆይተው ይሞክሩ።' },
};