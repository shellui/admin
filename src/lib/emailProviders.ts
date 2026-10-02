/**
 * Provider catalog. Resend and SMTP are accepted by email-service.
 * Mailjet is listed so the selector can grow, and stays disabled until the service accepts it.
 */
export type EmailProviderId = 'resend' | 'smtp' | 'mailjet';

export type EmailProviderCredentialKind = 'api_key' | 'smtp';

export type EmailProviderDefinition = {
  id: EmailProviderId;
  available: boolean;
  credentialKind: EmailProviderCredentialKind;
};

export const EMAIL_PROVIDER_CATALOG: EmailProviderDefinition[] = [
  { id: 'resend', available: true, credentialKind: 'api_key' },
  { id: 'smtp', available: true, credentialKind: 'smtp' },
  { id: 'mailjet', available: false, credentialKind: 'api_key' },
];

export function emailProviderDefinition(id: string): EmailProviderDefinition | undefined {
  return EMAIL_PROVIDER_CATALOG.find((provider) => provider.id === id);
}

export function availableEmailProviders(): EmailProviderDefinition[] {
  return EMAIL_PROVIDER_CATALOG.filter((provider) => provider.available);
}
