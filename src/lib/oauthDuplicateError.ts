import type { TFunction } from 'i18next';

const CODE_TO_KEY: Record<string, string> = {
  duplicate: 'oauthErrorDuplicateProvider',
  duplicate_provider: 'oauthErrorDuplicateProvider',
  provider_already_configured: 'oauthErrorDuplicateProvider',
  social_app_duplicate: 'oauthErrorDuplicateProvider',
  already_configured: 'oauthErrorDuplicateProvider',
};

export function translateOAuthDuplicateError(t: TFunction, errorCode: string | null): string {
  if (errorCode) {
    const key = CODE_TO_KEY[errorCode.toLowerCase()];
    if (key) return t(key);
  }
  return t('oauthErrorDuplicateProvider');
}
