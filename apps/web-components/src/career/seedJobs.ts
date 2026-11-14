import type { JobListing } from '@db/shared-schemas';

/** Realistic Ethiopian demo listings used when no API is reachable. `location` holds a loc.* key suffix. */
export const SEED_JOBS: JobListing[] = [
  {
    id: 'job-001', title: { en: 'Customer Support Agent', am: 'የደንበኞች አገልግሎት ሠራተኛ' }, employer: 'Ethio Telecom', location: 'addis_ababa', remote: false,
    description: 'Answer customer questions by chat and email. Full training is given in the first month.',
    offeredAccommodations: ['screen_reader_software', 'written_not_phone', 'flexible_hours', 'quiet_workspace'], createdAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'job-002', title: { en: 'Junior Data Entry Clerk', am: 'ጀማሪ የመረጃ ማስገቢያ ሠራተኛ' }, employer: 'Hibret Bank', location: 'addis_ababa', remote: true,
    description: 'Enter and check customer records. You can work from home three days a week.',
    offeredAccommodations: ['remote', 'flexible_hours', 'screen_reader_software', 'extra_time'], createdAt: '2026-11-02T08:00:00Z',
  },
  {
    id: 'job-003', title: { en: 'Front-End Developer (Intern)', am: 'የፊት ገጽ ዲቬሎፐር (ተለማማጅ)' }, employer: 'Gebeya Inc.', location: 'addis_ababa', remote: true,
    description: 'Build accessible web pages with React. Mentoring from senior engineers.',
    offeredAccommodations: ['remote', 'flexible_hours', 'screen_reader_software', 'sign_language_captions', 'written_not_phone'], createdAt: '2026-11-03T08:00:00Z',
  },
  {
    id: 'job-004', title: { en: 'Hotel Reception Assistant', am: 'የሆቴል እንግዳ መቀበያ ረዳት' }, employer: 'Kuriftu Resort', location: 'bahir_dar', remote: false,
    description: 'Welcome guests and manage bookings. Step-free building with a lift.',
    offeredAccommodations: ['step_free_venue', 'wheelchair_accessible_office', 'high_contrast_large_text'], createdAt: '2026-11-04T08:00:00Z',
  },
  {
    id: 'job-005', title: { en: 'Community Health Data Officer', am: 'የማኅበረሰብ ጤና መረጃ ባለሙያ' }, employer: 'Hawassa University', location: 'hawassa', remote: false,
    description: 'Collect and summarise community survey results on a tablet.',
    offeredAccommodations: ['audio_instructions', 'extra_time', 'step_free_venue', 'wheelchair_accessible_office'], createdAt: '2026-11-05T08:00:00Z',
  },
  {
    id: 'job-006', title: { en: 'Call Centre Quality Reviewer', am: 'የጥሪ ማዕከል ጥራት ገምጋሚ' }, employer: 'Safaricom Ethiopia', location: 'addis_ababa', remote: false,
    description: 'Review written transcripts of customer calls and give feedback.',
    offeredAccommodations: ['quiet_workspace', 'written_not_phone', 'sign_language_captions', 'wheelchair_accessible_office'], createdAt: '2026-11-06T08:00:00Z',
  },
  {
    id: 'job-007', title: { en: 'Bookkeeping Assistant', am: 'የሂሳብ አያያዝ ረዳት' }, employer: 'Adama Textile Cooperative', location: 'adama', remote: false,
    description: 'Record daily sales and expenses. Large-print forms available.',
    offeredAccommodations: ['high_contrast_large_text', 'extra_time', 'quiet_workspace'], createdAt: '2026-11-07T08:00:00Z',
  },
  {
    id: 'job-008', title: { en: 'Online Tutor (Amharic Literacy)', am: 'የመስመር ላይ አስጠኚ (የአማርኛ ማንበብና መጻፍ)' }, employer: 'Tomorrow is Better', location: 'dire_dawa', remote: true,
    description: 'Teach reading and writing to adult learners by video call.',
    offeredAccommodations: ['remote', 'flexible_hours', 'sign_language_captions', 'audio_instructions'], createdAt: '2026-11-08T08:00:00Z',
  },
];

export const LOCATION_KEYS = ['addis_ababa', 'bahir_dar', 'hawassa', 'adama', 'dire_dawa', 'mekelle'] as const;
