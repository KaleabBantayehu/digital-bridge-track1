import type { OnboardingProfile } from '@db/shared-schemas';
import type { Dev2Services } from '../wizard/services';
import type { ApiClient } from './ApiClient';

export function createDev2Services(
  client: ApiClient,
  getProfile: () => OnboardingProfile,
  deleteProfile: () => Promise<void>,
): Dev2Services {
  return {
    async requestResumeSms(profile) {
      const result = await client.requestResumeSms(profile);
      const resumeUrl = new URL(window.location.href);
      resumeUrl.searchParams.delete('resumeToken');
      resumeUrl.searchParams.set('resume', result.token);
      return { code: result.token, expiresAt: result.expiresAt, devLink: resumeUrl.toString() };
    },
    restoreFromCode: (code) => client.restoreFromResumeCode(code),
    async requestPartnerVouch(input) {
      const result = await client.partnerVouch({
        profile: getProfile(),
        partnerOrg: input.partnerId,
        agentName: input.agentId,
      });
      return { referralCode: result.reference, status: result.status };
    },
    async listJobs() {
      return (await client.getJobs()).jobs;
    },
    postJob: (input) => client.createJob(input),
    submitApplication: (input) => client.apply(input),
    async deleteAllData(profileId) {
      if (getProfile().id !== profileId) {
        throw new Error('The active profile does not match the deletion request.');
      }
      await deleteProfile();
    },
  };
}
