/**
 * Provider catalog. Resend and Amazon SES are available (SES needs email-service with `ses`). SMTP is a real provider name, but company SMTP
 * is off unless GET /provider reports `smtp_allowed`. Mailjet stays disabled until the service accepts it.
 */
export type EmailProviderId = 'resend' | 'ses' | 'smtp' | 'mailjet';

export type EmailProviderCredentialKind = 'api_key' | 'ses' | 'smtp';

export type EmailProviderDefinition = {
  id: EmailProviderId;
  available: boolean;
  credentialKind: EmailProviderCredentialKind;
};

export const EMAIL_PROVIDER_CATALOG: EmailProviderDefinition[] = [
  { id: 'resend', available: true, credentialKind: 'api_key' },
  { id: 'ses', available: true, credentialKind: 'ses' },
  { id: 'smtp', available: true, credentialKind: 'smtp' },
  { id: 'mailjet', available: false, credentialKind: 'api_key' },
];

export function emailProviderDefinition(id: string): EmailProviderDefinition | undefined {
  return EMAIL_PROVIDER_CATALOG.find((provider) => provider.id === id);
}

export function availableEmailProviders(): EmailProviderDefinition[] {
  return EMAIL_PROVIDER_CATALOG.filter((provider) => provider.available);
}

export const SES_DEFAULT_REGION = 'eu-central-2';

/** Common SES regions for the select. Any region matching `SES_REGION_PATTERN` is accepted. */
export const SES_REGIONS = [
  'eu-central-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'eu-south-1',
  'us-east-1',
  'us-east-2',
  'us-west-2',
  'ca-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
] as const;

export const SES_REGION_PATTERN = /^[a-z]{2}(-gov)?-[a-z]+-\d{1,2}$/;
export const SES_ACCESS_KEY_PATTERN = /^[A-Z0-9]{16,128}$/;
export const SES_CONFIGURATION_SET_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type SesDraft = {
  accessKeyId: string;
  region: string;
  configurationSet: string;
};

/** Field errors with the same keys and codes as email-service. */
export function validateSesDraft(
  draft: SesDraft,
  secretAccessKey: string,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const accessKeyId = draft.accessKeyId.trim();
  if (!accessKeyId) errors.access_key_id = ['required'];
  else if (!SES_ACCESS_KEY_PATTERN.test(accessKeyId)) errors.access_key_id = ['invalid_format'];
  if (!secretAccessKey.trim()) errors.secret_access_key = ['required'];
  if (!SES_REGION_PATTERN.test(draft.region.trim())) errors.region = ['invalid_region'];
  const configurationSet = draft.configurationSet.trim();
  if (configurationSet && !SES_CONFIGURATION_SET_PATTERN.test(configurationSet)) {
    errors.configuration_set = ['invalid_format'];
  }
  return errors;
}
