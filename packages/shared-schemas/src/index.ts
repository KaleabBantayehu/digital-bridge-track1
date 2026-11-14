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

// ---------------------------------------------------------------------------
// ADDITIVE (Dev 2, Sprint 1): Ethiopian <-> Gregorian calendar conversion.
// Julian Day Number method (Amete Mihret epoch). Pure functions, no deps.
// ---------------------------------------------------------------------------
const ETHIOPIAN_EPOCH_JDN = 1723856;

function gregorianToJdn(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000) + 2440588;
}

export function ethiopianToGregorian(date: EthiopianDate): { year: number; month: number; day: number; iso: string } {
  const jdn = ETHIOPIAN_EPOCH_JDN + 365 + 365 * (date.year - 1) + Math.floor(date.year / 4) + 30 * date.month + date.day - 31;
  const d = new Date((jdn - 2440588) * 86400000);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return { year, month, day, iso: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

export function gregorianToEthiopian(year: number, month: number, day: number): EthiopianDate {
  const offset = gregorianToJdn(year, month, day) - ETHIOPIAN_EPOCH_JDN;
  const r = ((offset % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor(offset / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

export function isValidEthiopianDate(date: EthiopianDate): boolean {
  return Number.isInteger(date.year) && date.month >= 1 && date.month <= 13 && date.day >= 1 && date.day <= daysInEthiopianMonth(date.year, date.month);
}

export const GREGORIAN_MONTHS: { number: number; en: string; am: string }[] = [
  { number: 1, en: 'January', am: 'ጃንዩወሪ' },
  { number: 2, en: 'February', am: 'ፌብሩወሪ' },
  { number: 3, en: 'March', am: 'ማርች' },
  { number: 4, en: 'April', am: 'ኤፕሪል' },
  { number: 5, en: 'May', am: 'ሜይ' },
  { number: 6, en: 'June', am: 'ጁን' },
  { number: 7, en: 'July', am: 'ጁላይ' },
  { number: 8, en: 'August', am: 'ኦገስት' },
  { number: 9, en: 'September', am: 'ሴፕቴምበር' },
  { number: 10, en: 'October', am: 'ኦክቶበር' },
  { number: 11, en: 'November', am: 'ኖቬምበር' },
  { number: 12, en: 'December', am: 'ዲሴምበር' },
];

// ---------------------------------------------------------------------------
// ADDITIVE (Dev 2, Sprint 1): UI i18n dictionaries. `am` is typed against the
// `en` keys, so a missing Amharic string is a compile error.
// Placeholders use {name}; the UI's t() helper fills them.
// ---------------------------------------------------------------------------
const I18N_EN = {
  'app.name': 'Digital Bridge onboarding',
  'banner.intro': 'One question at a time. There is no time limit. Your answers are saved on this device. You can answer every question by voice.',
  'banner.partnerAssisted': 'A partner organisation staff member is helping you. You stay in control of every answer.',

  'wizard.next': 'Continue',
  'wizard.back': 'Back',
  'wizard.finish': 'Finish onboarding',
  'wizard.stepOf': 'Step {current} of {total}',
  'wizard.stepHeading': 'Step {current} of {total}: {title}',
  'wizard.progressLabel': 'Onboarding progress',
  'wizard.required': '(required)',
  'wizard.optional': '(optional)',
  'wizard.saved': 'Your answer is saved on this device.',
  'wizard.choose': 'Choose…',

  'errors.summaryTitle': 'There is a problem',
  'errors.summaryIntro': 'Fix the following to continue. Select an item to go to that question.',

  'help.groupLabel': 'Help and settings',
  'help.readAloud': 'Read aloud',
  'help.stopReading': 'Stop reading',
  'help.reading': 'Reading aloud.',
  'help.stopped': 'Stopped reading.',
  'help.noVoice': 'This device has no voice for this language. Please read the text on the screen.',
  'help.noTts': 'Read aloud is not available in this browser. Please read the text on the screen.',
  'help.simpleWords': 'Simple words',
  'help.simpleOn': 'Simple words are on.',
  'help.simpleOff': 'Simple words are off.',
  'help.needHelp': 'Need help',
  'help.privacy': 'My data',
  'help.dialogTitle': 'Getting help',
  'help.dialogBody1': 'You can stop at any time. Your answers stay saved on this device, and there is no time limit.',
  'help.dialogBody2': 'Use the microphone button next to a question to answer by voice. You can always check and change what we heard.',
  'help.dialogBody3': 'Turn on "Simple words" for shorter instructions, or "Read aloud" to hear the question.',
  'help.dialogBody4': 'A staff member from a partner organisation (for example AAAPD or Tomorrow is Better) can sit with you and help. You decide every answer.',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.yes': 'Yes',
  'common.no': 'No',

  'lang.switchTo': 'Change language',
  'lang.changed': 'Language changed to English.',
  'lang.selfName': 'English',

  'step0.title': 'Welcome — before we start',
  'step0.hint': 'This takes about 10 minutes. Here is how it works.',
  'step0.hint.simple': 'We ask a few questions. Take your time.',
  'step0.point1': 'One question at a time.',
  'step0.point2': 'There is no time limit. Nothing is deleted if you stop.',
  'step0.point3': 'Your answers are saved on this device as you type.',
  'step0.point4': 'You can answer every question by voice, and check it before it is used.',
  'consent.legend': 'Your choices about your data',
  'consent.saveAnswers': 'Save my answers so I can continue',
  'consent.saveAnswers.hint': 'Needed to continue. Your answers are saved on this device and with Digital Bridge.',
  'consent.smsResume': 'Send me a text message (SMS) link so I can continue another day',
  'consent.shareWithEmployers': 'Let employers I apply to see my name and contact details',
  'consent.privacyButton': 'Read how we protect your data',

  'step1.title': 'What is your name?',
  'step1.hint': 'Write your name the way you want employers to see it.',
  'step1.hint.simple': 'Write your name.',
  'field.givenName': 'First name',
  'field.givenName.hint': 'For example Abebe',
  'field.familyName': "Father's name",
  'field.familyName.hint': 'For example Kebede',

  'step2.title': 'How can we contact you?',
  'step2.hint': 'We use this only to send you updates about your learning and jobs.',
  'step2.hint.simple': 'Write your phone number.',
  'field.phone': 'Phone number',
  'field.phone.hint': '10 digits, for example 0911 234 567',
  'field.email': 'Email address',
  'field.email.hint': 'For example name@example.com',
  'field.viaPartner': 'I share a phone — contact me through my partner organisation',
  'sms.heading': 'Continue later by SMS',
  'sms.body': 'We can send you a text message with a link. It works one time, for 24 hours.',
  'sms.send': 'Save & send SMS resume link',
  'sms.sending': 'Sending your link…',
  'sms.sent': 'We sent a resume link to {phone}. It works one time, for 24 hours. Your code is {code}.',
  'sms.devLink': 'Test link (shown because SMS is simulated in this demo):',
  'sms.needPhone': 'Enter a valid phone number first, so we can text you.',
  'sms.restoreHeading': 'Do you have a resume code?',
  'field.resumeCode': 'Resume code',
  'field.resumeCode.hint': 'The code from your text message, for example DB-4F7K2Q',
  'sms.restore': 'Restore my answers',
  'sms.restored': 'Your answers are back. You can continue.',

  'step3.title': 'When were you born?',
  'step3.hint': 'Choose the calendar you know best. We change it for you.',
  'step3.hint.simple': 'Choose your birthday.',
  'dob.legend': 'Date of birth',
  'dob.calendarLegend': 'Which calendar?',
  'dob.ethiopian': 'Ethiopian calendar',
  'dob.gregorian': 'Gregorian (European) calendar',
  'dob.day': 'Day',
  'dob.month': 'Month',
  'dob.year': 'Year',
  'dob.inGregorian': 'In the Gregorian calendar: {date}',
  'dob.inEthiopian': 'In the Ethiopian calendar: {date}',
  'dob.pagumeNote': 'Pagume has 5 days, or 6 days in a leap year.',
  'field.dob': 'Date of birth',

  'step4.title': 'How can we confirm who you are?',
  'step4.hint': 'Choose any one way. You do not need a Kebele ID or a passport.',
  'step4.hint.simple': 'Choose one way to show who you are.',
  'id.legend': 'Choose one way',
  'id.national_id_or_passport': 'National ID, Kebele ID or passport',
  'id.national_id_or_passport.hint': 'Type the number on your card.',
  'id.refugee_id': 'Refugee or returnee ID (UNHCR / RRS)',
  'id.refugee_id.hint': 'Type the number on your refugee or returnee card.',
  'id.community_document': 'School certificate, birth record or community letter',
  'id.community_document.hint': 'Any official paper with your name on it.',
  'id.partner_voucher': 'Refer me through a partner organisation',
  'id.partner_voucher.hint': 'A partner organisation you know confirms who you are. No document needed.',
  'field.route': 'Way to confirm who you are',
  'field.referenceNumber': 'ID number',
  'field.referenceNumber.hint': 'Type it as it appears on the card. You can say it by voice.',
  'field.documentKind': 'Type of document',
  'field.docReference': 'Reference number on the document',
  'field.docReference.hint': 'If the paper has a number, type it here.',
  'doc.school_certificate': 'School certificate',
  'doc.birth_record': 'Birth record',
  'doc.ward_letter': 'Letter from your kebele or community',
  'field.partnerId': 'Partner organisation',
  'field.agentId': 'Name of the staff member helping you',
  'field.agentId.hint': 'For example Selam Tesfaye',
  'field.partnerConsent': 'Consent',
  'partner.consent': 'I agree that this organisation can confirm who I am to Digital Bridge',
  'partner.request': 'Ask the partner to confirm me',
  'partner.requesting': 'Asking the partner organisation…',
  'partner.vouched': 'Confirmed. Your voucher code is {code}.',

  'step5.title': 'What support helps you learn and work best?',
  'step5.hint': 'Choose anything that helps you. You can skip this question.',
  'step5.hint.simple': 'What helps you? You can skip.',
  'support.noProof': 'No medical proof required. This stays private and is never shared without your permission.',
  'support.legend': 'Support that helps me',
  'support.tellProvider': 'Share these choices with my learning provider so they can prepare',
  'field.otherText': 'Tell us in your own words',
  'field.otherText.hint': 'For example: I prefer a seat near the door.',

  'need.screen_reader_materials': 'Materials that work with a screen reader',
  'need.sign_language_captions': 'Sign language or captions',
  'need.step_free_venue': 'Step-free building (no stairs)',
  'need.extra_time': 'Extra time',
  'need.high_contrast_large_text': 'Large text or high contrast',
  'need.audio_instructions': 'Instructions I can listen to',
  'need.written_not_phone': 'Written messages instead of phone calls',
  'need.quiet_workspace': 'A quiet place to work',
  'need.other': 'Something else',
  'need.remote': 'Remote work (from home)',
  'need.flexible_hours': 'Flexible hours',
  'need.wheelchair_accessible_office': 'Wheelchair-accessible office',
  'need.screen_reader_software': 'Screen reader software provided',

  'step6.title': 'Check your answers',
  'step6.hint': 'Check everything is right. Choose "Edit" to change an answer.',
  'step6.hint.simple': 'Check your answers.',
  'review.consent': 'Your choices',
  'review.name': 'Name',
  'review.contact': 'Contact',
  'review.dob': 'Date of birth',
  'review.identity': 'Confirming who you are',
  'review.support': 'Support (private)',
  'review.edit': 'Edit',
  'review.editSection': 'Edit {section}',
  'review.notGiven': 'Not given',
  'review.none': 'None chosen',
  'review.viaPartner': 'Through my partner organisation',
  'review.finishedTitle': 'You have finished onboarding',
  'review.finishedBody': 'Thank you. Your profile is ready. You can now look for jobs in the Career Gateway.',

  'privacy.title': 'Your data',
  'privacy.body': 'You control your data. You can download a copy or delete it at any time. Your support choices are kept separate and are never shown to employers unless you say so.',
  'privacy.export': 'Download my data (JSON)',
  'privacy.exportReady': 'Your data file is ready. A copy is shown below.',
  'privacy.preview': 'A copy of your data',
  'privacy.delete': 'Delete my data',
  'privacy.confirm': 'Are you sure? This removes all your answers from this device and from Digital Bridge. This cannot be undone.',
  'privacy.confirmYes': 'Yes, delete everything',
  'privacy.deleted': 'Your data has been deleted.',

  'voice.answer': 'Answer {field} by voice',
  'voice.stop': 'Stop listening',
  'voice.listening': 'Listening… speak now.',
  'voice.heard': 'Heard: {text}',
  'voice.reviewLabel': 'Review what we heard (you can edit this)',
  'voice.use': 'Use this answer',
  'voice.retry': 'Try again',
  'voice.unsupported': 'Voice input is not available in this browser. You can type, or use the microphone on your phone keyboard.',
  'voice.denied': 'The microphone is blocked. You can type your answer instead.',
  'voice.nothing': 'We did not hear anything. Try again or type your answer.',
  'voice.used': 'Answer added. You can still change it.',
  'voice.error': 'Voice input stopped. You can type your answer instead.',

  'career.title': 'Career Gateway — find a job',
  'career.intro': 'Jobs from employers who offer workplace support.',
  'career.viewLabel': 'Career Gateway view',
  'career.tabJobs': 'Find jobs',
  'career.tabEmployer': 'I am an employer',
  'career.loading': 'Loading jobs…',
  'filter.legend': 'Support I need',
  'filter.private': 'Employers never see what you select here.',
  'filter.count': 'Showing {count} jobs matching your support preferences',
  'filter.none': 'No jobs offer all of these yet. Try removing one choice.',
  'filter.clear': 'Clear my choices',
  'job.listLabel': 'Jobs',
  'job.offers': 'Support offered',
  'job.remote': 'Remote',
  'job.deadline': 'Apply by {date}',
  'job.apply': 'Apply for {title} at {employer} ({location})',
  'job.readAloud': 'Read aloud: {title}',
  'job.applied': 'Applied',
  'apply.title': 'Apply for {title}',
  'apply.prefilled': 'We filled in these details from your onboarding. You can change them.',
  'field.applicantName': 'Your full name',
  'field.coverNote': 'Why do you want this job?',
  'field.coverNote.hint': 'A few sentences are enough. You can answer by voice.',
  'apply.share': 'Share my support needs with this employer',
  'apply.shareHint': 'Only if you tick this box. The employer will see: {items}',
  'apply.shareNone': 'You have not chosen any support needs. Nothing will be shared.',
  'apply.submit': 'Send application',
  'apply.sent': 'Your application for {title} was sent.',
  'employer.title': 'Post a job with workplace support',
  'employer.intro': 'Tell candidates which support your workplace offers. Candidates never tell you what they filtered by.',
  'employer.offersLegend': 'Support this job offers',
  'employer.submit': 'Post job',
  'employer.posted': 'Your job "{title}" is posted.',
  'field.jobTitle': 'Job title',
  'field.jobTitle.hint': 'For example Customer Support Agent',
  'field.employerName': 'Employer name',
  'field.location': 'Location',
  'field.remoteJob': 'This job can be done from home',
  'field.description': 'Job description',
  'field.description.hint': 'What will the person do? Use short, plain sentences.',
  'field.contactEmail': 'Contact email for applications',
  'loc.addis_ababa': 'Addis Ababa',
  'loc.bahir_dar': 'Bahir Dar',
  'loc.hawassa': 'Hawassa',
  'loc.adama': 'Adama',
  'loc.dire_dawa': 'Dire Dawa',
  'loc.mekelle': 'Mekelle',
} as const;

export type I18nKey = keyof typeof I18N_EN;

const I18N_AM: Record<I18nKey, string> = {
  'app.name': 'የዲጂታል ብሪጅ ምዝገባ',
  'banner.intro': 'በአንድ ጊዜ አንድ ጥያቄ። የጊዜ ገደብ የለም። መልሶችዎ በዚህ መሣሪያ ላይ ይቀመጣሉ። ሁሉንም ጥያቄዎች በድምጽ መመለስ ይችላሉ።',
  'banner.partnerAssisted': 'የአጋር ድርጅት ሠራተኛ እየረዳዎት ነው። እያንዳንዱን መልስ የሚወስኑት እርስዎ ነዎት።',

  'wizard.next': 'ቀጥል',
  'wizard.back': 'ተመለስ',
  'wizard.finish': 'ምዝገባውን ጨርስ',
  'wizard.stepOf': 'ደረጃ {current} ከ {total}',
  'wizard.stepHeading': 'ደረጃ {current} ከ {total}፦ {title}',
  'wizard.progressLabel': 'የምዝገባ ሂደት',
  'wizard.required': '(ግዴታ)',
  'wizard.optional': '(አማራጭ)',
  'wizard.saved': 'መልስዎ በዚህ መሣሪያ ላይ ተቀምጧል።',
  'wizard.choose': 'ይምረጡ…',

  'errors.summaryTitle': 'ችግር አለ',
  'errors.summaryIntro': 'ለመቀጠል የሚከተሉትን ያስተካክሉ። ወደ ጥያቄው ለመሄድ አንዱን ይምረጡ።',

  'help.groupLabel': 'እገዛ እና ቅንብሮች',
  'help.readAloud': 'ጮክ ብለህ አንብብ',
  'help.stopReading': 'ማንበብ አቁም',
  'help.reading': 'ጮክ ብሎ እያነበበ ነው።',
  'help.stopped': 'ማንበብ ቆሟል።',
  'help.noVoice': 'ይህ መሣሪያ ለዚህ ቋንቋ ድምጽ የለውም። እባክዎ በማያ ገጹ ላይ ያለውን ጽሑፍ ያንብቡ።',
  'help.noTts': 'በዚህ አሳሽ ላይ ጮክ ብሎ ማንበብ አይሠራም። እባክዎ በማያ ገጹ ላይ ያለውን ጽሑፍ ያንብቡ።',
  'help.simpleWords': 'ቀላል ቃላት',
  'help.simpleOn': 'ቀላል ቃላት በርተዋል።',
  'help.simpleOff': 'ቀላል ቃላት ጠፍተዋል።',
  'help.needHelp': 'እገዛ ያስፈልገኛል',
  'help.privacy': 'የእኔ መረጃ',
  'help.dialogTitle': 'እገዛ ማግኘት',
  'help.dialogBody1': 'በማንኛውም ጊዜ ማቆም ይችላሉ። መልሶችዎ በዚህ መሣሪያ ላይ ተቀምጠው ይቆያሉ፤ የጊዜ ገደብም የለም።',
  'help.dialogBody2': 'በድምጽ ለመመለስ ከጥያቄው አጠገብ ያለውን የማይክሮፎን ቁልፍ ይጠቀሙ። የሰማነውን ሁልጊዜ ማረጋገጥና መቀየር ይችላሉ።',
  'help.dialogBody3': 'አጭር መመሪያ ለማግኘት "ቀላል ቃላት"ን፣ ጥያቄውን ለመስማት ደግሞ "ጮክ ብለህ አንብብ"ን ያብሩ።',
  'help.dialogBody4': 'የአጋር ድርጅት ሠራተኛ (ለምሳሌ AAAPD ወይም Tomorrow is Better) አብሮዎት ተቀምጦ ሊረዳዎት ይችላል። እያንዳንዱን መልስ የሚወስኑት እርስዎ ነዎት።',
  'common.close': 'ዝጋ',
  'common.cancel': 'ሰርዝ',
  'common.yes': 'አዎ',
  'common.no': 'አይ',

  'lang.switchTo': 'ቋንቋ ቀይር',
  'lang.changed': 'ቋንቋው ወደ አማርኛ ተቀይሯል።',
  'lang.selfName': 'አማርኛ',

  'step0.title': 'እንኳን ደህና መጡ — ከመጀመራችን በፊት',
  'step0.hint': 'ይህ 10 ደቂቃ ያህል ይወስዳል። እንዴት እንደሚሠራ ይኸውና።',
  'step0.hint.simple': 'ጥቂት ጥያቄዎችን እንጠይቃለን። ጊዜዎን ይውሰዱ።',
  'step0.point1': 'በአንድ ጊዜ አንድ ጥያቄ።',
  'step0.point2': 'የጊዜ ገደብ የለም። ቢያቆሙም ምንም አይጠፋም።',
  'step0.point3': 'ሲጽፉ መልሶችዎ በዚህ መሣሪያ ላይ ይቀመጣሉ።',
  'step0.point4': 'ሁሉንም ጥያቄዎች በድምጽ መመለስ፣ ከመጠቀሙም በፊት ማረጋገጥ ይችላሉ።',
  'consent.legend': 'ስለ መረጃዎ የእርስዎ ምርጫዎች',
  'consent.saveAnswers': 'እንድቀጥል መልሶቼን አስቀምጥ',
  'consent.saveAnswers.hint': 'ለመቀጠል ያስፈልጋል። መልሶችዎ በዚህ መሣሪያ እና በዲጂታል ብሪጅ ይቀመጣሉ።',
  'consent.smsResume': 'በሌላ ቀን እንድቀጥል የጽሑፍ መልእክት (SMS) ማስፈንጠሪያ ላክልኝ',
  'consent.shareWithEmployers': 'የማመለክትባቸው ቀጣሪዎች ስሜንና አድራሻዬን እንዲያዩ ፍቀድ',
  'consent.privacyButton': 'መረጃዎን እንዴት እንደምንጠብቅ ያንብቡ',

  'step1.title': 'ስምዎ ማን ነው?',
  'step1.hint': 'ቀጣሪዎች እንዲያዩት በሚፈልጉት መንገድ ስምዎን ይጻፉ።',
  'step1.hint.simple': 'ስምዎን ይጻፉ።',
  'field.givenName': 'ስም',
  'field.givenName.hint': 'ለምሳሌ አበበ',
  'field.familyName': 'የአባት ስም',
  'field.familyName.hint': 'ለምሳሌ ከበደ',

  'step2.title': 'እንዴት እናግኝዎ?',
  'step2.hint': 'ይህንን የምንጠቀመው ስለ ትምህርትዎና ስለ ሥራዎች መረጃ ለመላክ ብቻ ነው።',
  'step2.hint.simple': 'ስልክ ቁጥርዎን ይጻፉ።',
  'field.phone': 'ስልክ ቁጥር',
  'field.phone.hint': '10 ቁጥሮች፣ ለምሳሌ 0911 234 567',
  'field.email': 'ኢሜይል አድራሻ',
  'field.email.hint': 'ለምሳሌ name@example.com',
  'field.viaPartner': 'ስልክ የምጋራው ከሌሎች ጋር ነው — በአጋር ድርጅቴ በኩል አግኙኝ',
  'sms.heading': 'በኋላ በSMS ይቀጥሉ',
  'sms.body': 'ማስፈንጠሪያ ያለው የጽሑፍ መልእክት ልንልክልዎ እንችላለን። አንድ ጊዜ ብቻ፣ ለ24 ሰዓት ይሠራል።',
  'sms.send': 'አስቀምጥና የመቀጠያ SMS ላክ',
  'sms.sending': 'ማስፈንጠሪያዎን እየላክን ነው…',
  'sms.sent': 'የመቀጠያ ማስፈንጠሪያ ወደ {phone} ልከናል። አንድ ጊዜ ብቻ፣ ለ24 ሰዓት ይሠራል። ኮድዎ {code} ነው።',
  'sms.devLink': 'የሙከራ ማስፈንጠሪያ (በዚህ ማሳያ SMS የሚላከው በማስመሰል ስለሆነ ይታያል)፦',
  'sms.needPhone': 'መልእክት እንድንልክልዎ መጀመሪያ ትክክለኛ ስልክ ቁጥር ያስገቡ።',
  'sms.restoreHeading': 'የመቀጠያ ኮድ አለዎት?',
  'field.resumeCode': 'የመቀጠያ ኮድ',
  'field.resumeCode.hint': 'ከጽሑፍ መልእክትዎ የተገኘው ኮድ፣ ለምሳሌ DB-4F7K2Q',
  'sms.restore': 'መልሶቼን መልስ',
  'sms.restored': 'መልሶችዎ ተመልሰዋል። መቀጠል ይችላሉ።',

  'step3.title': 'መቼ ተወለዱ?',
  'step3.hint': 'በደንብ የሚያውቁትን የቀን መቁጠሪያ ይምረጡ። እኛ እንቀይርልዎታለን።',
  'step3.hint.simple': 'የልደት ቀንዎን ይምረጡ።',
  'dob.legend': 'የትውልድ ቀን',
  'dob.calendarLegend': 'የትኛው የቀን መቁጠሪያ?',
  'dob.ethiopian': 'የኢትዮጵያ የቀን መቁጠሪያ',
  'dob.gregorian': 'የግሪጎሪያን (የአውሮፓ) የቀን መቁጠሪያ',
  'dob.day': 'ቀን',
  'dob.month': 'ወር',
  'dob.year': 'ዓመት',
  'dob.inGregorian': 'በግሪጎሪያን የቀን መቁጠሪያ፦ {date}',
  'dob.inEthiopian': 'በኢትዮጵያ የቀን መቁጠሪያ፦ {date}',
  'dob.pagumeNote': 'ጳጉሜ 5 ቀናት አሏት፤ በዘመነ ዮሐንስ 6 ቀናት።',
  'field.dob': 'የትውልድ ቀን',

  'step4.title': 'ማንነትዎን እንዴት እናረጋግጥ?',
  'step4.hint': 'ማንኛውንም አንድ መንገድ ይምረጡ። የቀበሌ መታወቂያ ወይም ፓስፖርት አያስፈልግዎትም።',
  'step4.hint.simple': 'ማንነትዎን የሚያሳዩበት አንድ መንገድ ይምረጡ።',
  'id.legend': 'አንድ መንገድ ይምረጡ',
  'id.national_id_or_passport': 'ብሔራዊ መታወቂያ፣ የቀበሌ መታወቂያ ወይም ፓስፖርት',
  'id.national_id_or_passport.hint': 'በካርድዎ ላይ ያለውን ቁጥር ይጻፉ።',
  'id.refugee_id': 'የስደተኛ ወይም የተመላሽ መታወቂያ (UNHCR / RRS)',
  'id.refugee_id.hint': 'በስደተኛ ወይም በተመላሽ ካርድዎ ላይ ያለውን ቁጥር ይጻፉ።',
  'id.community_document': 'የትምህርት ማስረጃ፣ የልደት ምዝገባ ወይም የማኅበረሰብ ደብዳቤ',
  'id.community_document.hint': 'ስምዎ የተጻፈበት ማንኛውም ይፋዊ ወረቀት።',
  'id.partner_voucher': 'በአጋር ድርጅት በኩል ይጠቁሙኝ',
  'id.partner_voucher.hint': 'የሚያውቁት የአጋር ድርጅት ማንነትዎን ያረጋግጣል። ሰነድ አያስፈልግም።',
  'field.route': 'ማንነትን የማረጋገጫ መንገድ',
  'field.referenceNumber': 'የመታወቂያ ቁጥር',
  'field.referenceNumber.hint': 'በካርዱ ላይ እንዳለው ይጻፉ። በድምጽም መናገር ይችላሉ።',
  'field.documentKind': 'የሰነድ ዓይነት',
  'field.docReference': 'በሰነዱ ላይ ያለው የማጣቀሻ ቁጥር',
  'field.docReference.hint': 'ወረቀቱ ቁጥር ካለው እዚህ ይጻፉት።',
  'doc.school_certificate': 'የትምህርት ማስረጃ',
  'doc.birth_record': 'የልደት ምዝገባ',
  'doc.ward_letter': 'ከቀበሌዎ ወይም ከማኅበረሰብዎ የተሰጠ ደብዳቤ',
  'field.partnerId': 'የአጋር ድርጅት',
  'field.agentId': 'እየረዳዎት ያለው ሠራተኛ ስም',
  'field.agentId.hint': 'ለምሳሌ ሰላም ተስፋዬ',
  'field.partnerConsent': 'ፈቃድ',
  'partner.consent': 'ይህ ድርጅት ማንነቴን ለዲጂታል ብሪጅ እንዲያረጋግጥ እስማማለሁ',
  'partner.request': 'አጋሩ እንዲያረጋግጠኝ ጠይቅ',
  'partner.requesting': 'የአጋር ድርጅቱን እየጠየቅን ነው…',
  'partner.vouched': 'ተረጋግጧል። የማረጋገጫ ኮድዎ {code} ነው።',

  'step5.title': 'ለመማርና ለመሥራት የሚረዳዎት ምን ዓይነት ድጋፍ ነው?',
  'step5.hint': 'የሚረዳዎትን ማንኛውንም ይምረጡ። ይህን ጥያቄ መዝለል ይችላሉ።',
  'step5.hint.simple': 'ምን ይረዳዎታል? መዝለል ይችላሉ።',
  'support.noProof': 'የሕክምና ማስረጃ አያስፈልግም። ይህ በሚስጥር ይያዛል፤ ያለእርስዎ ፈቃድ ለማንም አይሰጥም።',
  'support.legend': 'የሚረዳኝ ድጋፍ',
  'support.tellProvider': 'እንዲዘጋጁ እነዚህን ምርጫዎች ለትምህርት አቅራቢዬ አጋራ',
  'field.otherText': 'በራስዎ ቃላት ይንገሩን',
  'field.otherText.hint': 'ለምሳሌ፦ ከበሩ አጠገብ መቀመጥ እመርጣለሁ።',

  'need.screen_reader_materials': 'በስክሪን አንባቢ የሚሠሩ ጽሑፎች',
  'need.sign_language_captions': 'የምልክት ቋንቋ ወይም የጽሑፍ ትርጉም',
  'need.step_free_venue': 'ደረጃ የሌለው ሕንፃ',
  'need.extra_time': 'ተጨማሪ ጊዜ',
  'need.high_contrast_large_text': 'ትልቅ ጽሑፍ ወይም ከፍተኛ ንፅፅር',
  'need.audio_instructions': 'ማዳመጥ የምችለው መመሪያ',
  'need.written_not_phone': 'ከስልክ ጥሪ ይልቅ የጽሑፍ መልእክት',
  'need.quiet_workspace': 'ጸጥ ያለ የሥራ ቦታ',
  'need.other': 'ሌላ ነገር',
  'need.remote': 'ከቤት መሥራት',
  'need.flexible_hours': 'ተለዋዋጭ የሥራ ሰዓት',
  'need.wheelchair_accessible_office': 'ለዊልቼር ተደራሽ የሆነ ቢሮ',
  'need.screen_reader_software': 'የስክሪን አንባቢ ሶፍትዌር ይቀርባል',

  'step6.title': 'መልሶችዎን ያረጋግጡ',
  'step6.hint': 'ሁሉም ትክክል መሆኑን ያረጋግጡ። መልስ ለመቀየር "አስተካክል"ን ይምረጡ።',
  'step6.hint.simple': 'መልሶችዎን ይመልከቱ።',
  'review.consent': 'የእርስዎ ምርጫዎች',
  'review.name': 'ስም',
  'review.contact': 'አድራሻ',
  'review.dob': 'የትውልድ ቀን',
  'review.identity': 'ማንነትን ማረጋገጥ',
  'review.support': 'ድጋፍ (የግል)',
  'review.edit': 'አስተካክል',
  'review.editSection': '{section}ን አስተካክል',
  'review.notGiven': 'አልተሰጠም',
  'review.none': 'ምንም አልተመረጠም',
  'review.viaPartner': 'በአጋር ድርጅቴ በኩል',
  'review.finishedTitle': 'ምዝገባውን ጨርሰዋል',
  'review.finishedBody': 'እናመሰግናለን። መገለጫዎ ዝግጁ ነው። አሁን በሥራ መግቢያው ሥራ መፈለግ ይችላሉ።',

  'privacy.title': 'የእርስዎ መረጃ',
  'privacy.body': 'መረጃዎን የሚቆጣጠሩት እርስዎ ነዎት። በማንኛውም ጊዜ ቅጂ ማውረድ ወይም መሰረዝ ይችላሉ። የድጋፍ ምርጫዎችዎ ለብቻቸው ይቀመጣሉ፤ እርስዎ ካልፈቀዱ ለቀጣሪዎች አይታዩም።',
  'privacy.export': 'መረጃዬን አውርድ (JSON)',
  'privacy.exportReady': 'የመረጃ ፋይልዎ ዝግጁ ነው። ቅጂው ከታች ይታያል።',
  'privacy.preview': 'የመረጃዎ ቅጂ',
  'privacy.delete': 'መረጃዬን ሰርዝ',
  'privacy.confirm': 'እርግጠኛ ነዎት? ይህ ሁሉንም መልሶችዎን ከዚህ መሣሪያና ከዲጂታል ብሪጅ ያጠፋል። መልሶ ማግኘት አይቻልም።',
  'privacy.confirmYes': 'አዎ፣ ሁሉንም ሰርዝ',
  'privacy.deleted': 'መረጃዎ ተሰርዟል።',

  'voice.answer': '{field}ን በድምጽ ይመልሱ',
  'voice.stop': 'ማዳመጥ አቁም',
  'voice.listening': 'እያዳመጥን ነው… አሁን ይናገሩ።',
  'voice.heard': 'የሰማነው፦ {text}',
  'voice.reviewLabel': 'የሰማነውን ይመልከቱ (ማስተካከል ይችላሉ)',
  'voice.use': 'ይህን መልስ ተጠቀም',
  'voice.retry': 'እንደገና ሞክር',
  'voice.unsupported': 'በዚህ አሳሽ ላይ የድምጽ ግብዓት አይሠራም። መጻፍ ወይም የስልክዎን ቁልፍ ሰሌዳ ማይክሮፎን መጠቀም ይችላሉ።',
  'voice.denied': 'ማይክሮፎኑ ታግዷል። በምትኩ መልስዎን መጻፍ ይችላሉ።',
  'voice.nothing': 'ምንም አልሰማንም። እንደገና ይሞክሩ ወይም መልስዎን ይጻፉ።',
  'voice.used': 'መልሱ ገብቷል። አሁንም መቀየር ይችላሉ።',
  'voice.error': 'የድምጽ ግብዓቱ ቆሟል። በምትኩ መልስዎን መጻፍ ይችላሉ።',

  'career.title': 'የሥራ መግቢያ — ሥራ ይፈልጉ',
  'career.intro': 'የሥራ ቦታ ድጋፍ ከሚሰጡ ቀጣሪዎች የተገኙ ሥራዎች።',
  'career.viewLabel': 'የሥራ መግቢያ ማሳያ',
  'career.tabJobs': 'ሥራ ፈልግ',
  'career.tabEmployer': 'ቀጣሪ ነኝ',
  'career.loading': 'ሥራዎችን እየጫንን ነው…',
  'filter.legend': 'የሚያስፈልገኝ ድጋፍ',
  'filter.private': 'እዚህ የሚመርጡትን ቀጣሪዎች በፍጹም አያዩም።',
  'filter.count': 'ከድጋፍ ምርጫዎ ጋር የሚዛመዱ {count} ሥራዎች ተገኝተዋል',
  'filter.none': 'እስካሁን እነዚህን ሁሉ የሚያቀርብ ሥራ የለም። አንዱን ምርጫ አንስተው ይሞክሩ።',
  'filter.clear': 'ምርጫዎቼን አጽዳ',
  'job.listLabel': 'ሥራዎች',
  'job.offers': 'የሚቀርብ ድጋፍ',
  'job.remote': 'ከቤት',
  'job.deadline': 'እስከ {date} ያመልክቱ',
  'job.apply': 'በ{employer} ({location}) ለ{title} ያመልክቱ',
  'job.readAloud': 'ጮክ ብለህ አንብብ፦ {title}',
  'job.applied': 'አመልክተዋል',
  'apply.title': 'ለ{title} ያመልክቱ',
  'apply.prefilled': 'እነዚህን መረጃዎች ከምዝገባዎ ሞልተናል። መቀየር ይችላሉ።',
  'field.applicantName': 'ሙሉ ስምዎ',
  'field.coverNote': 'ይህን ሥራ ለምን ይፈልጋሉ?',
  'field.coverNote.hint': 'ጥቂት ዓረፍተ ነገሮች በቂ ናቸው። በድምጽ መመለስ ይችላሉ።',
  'apply.share': 'የድጋፍ ፍላጎቶቼን ለዚህ ቀጣሪ አጋራ',
  'apply.shareHint': 'ይህን ሳጥን ምልክት ካደረጉ ብቻ። ቀጣሪው የሚያየው፦ {items}',
  'apply.shareNone': 'ምንም የድጋፍ ፍላጎት አልመረጡም። ምንም አይጋራም።',
  'apply.submit': 'ማመልከቻ ላክ',
  'apply.sent': 'ለ{title} ያቀረቡት ማመልከቻ ተልኳል።',
  'employer.title': 'የሥራ ቦታ ድጋፍ ያለው ሥራ ይለጥፉ',
  'employer.intro': 'የሥራ ቦታዎ የሚሰጠውን ድጋፍ ለአመልካቾች ይንገሩ። አመልካቾች በምን እንደመረጡ ለእርስዎ አይነገርም።',
  'employer.offersLegend': 'ይህ ሥራ የሚያቀርበው ድጋፍ',
  'employer.submit': 'ሥራውን ለጥፍ',
  'employer.posted': '"{title}" የተሰኘው ሥራዎ ተለጥፏል።',
  'field.jobTitle': 'የሥራ መደብ',
  'field.jobTitle.hint': 'ለምሳሌ የደንበኞች አገልግሎት ሠራተኛ',
  'field.employerName': 'የቀጣሪው ስም',
  'field.location': 'ቦታ',
  'field.remoteJob': 'ይህ ሥራ ከቤት ሊሠራ ይችላል',
  'field.description': 'የሥራ መግለጫ',
  'field.description.hint': 'ሰውየው ምን ይሠራል? አጭርና ግልጽ ዓረፍተ ነገሮችን ይጠቀሙ።',
  'field.contactEmail': 'ለማመልከቻ የሚሆን ኢሜይል',
  'loc.addis_ababa': 'አዲስ አበባ',
  'loc.bahir_dar': 'ባሕር ዳር',
  'loc.hawassa': 'ሀዋሳ',
  'loc.adama': 'አዳማ',
  'loc.dire_dawa': 'ድሬዳዋ',
  'loc.mekelle': 'መቀሌ',
};

export const I18N: Record<Lang, Record<I18nKey, string>> = { en: I18N_EN, am: I18N_AM };