import { describe, expect, it } from 'vitest';
import {
  OAUTH_APP_DUPLICATE_PROVIDER_CODE,
  parseOAuthApiFieldErrors,
  parseOAuthApiErrorPayload,
} from '@/lib/oauthApiErrors';

describe('parseOAuthApiErrorPayload', () => {
  it('parses identity oauth_app_duplicate_provider conflict', () => {
    const parsed = parseOAuthApiErrorPayload(
      {
        error_code: OAUTH_APP_DUPLICATE_PROVIDER_CODE,
        social_app_id: 123,
      },
      409,
    );
    expect(parsed.isDuplicate).toBe(true);
    expect(parsed.errorCode).toBe(OAUTH_APP_DUPLICATE_PROVIDER_CODE);
    expect(parsed.existingSocialAppId).toBe(123);
  });

  it('prefers social_app_id over legacy existing_social_app_id', () => {
    const parsed = parseOAuthApiErrorPayload(
      {
        error_code: OAUTH_APP_DUPLICATE_PROVIDER_CODE,
        social_app_id: 5,
        existing_social_app_id: 99,
      },
      409,
    );
    expect(parsed.existingSocialAppId).toBe(5);
  });

  it('falls back to legacy duplicate fields', () => {
    const parsed = parseOAuthApiErrorPayload(
      {
        code: 'duplicate_provider',
        existing_social_app_id: 42,
        detail: 'Provider already configured',
      },
      409,
    );
    expect(parsed.isDuplicate).toBe(true);
    expect(parsed.errorCode).toBe('duplicate_provider');
    expect(parsed.existingSocialAppId).toBe(42);
  });

  it('treats legacy duplicate code on 400 as duplicate', () => {
    const parsed = parseOAuthApiErrorPayload({ error_code: 'duplicate', social_app_id: 7 }, 400);
    expect(parsed.isDuplicate).toBe(true);
    expect(parsed.existingSocialAppId).toBe(7);
  });
});

describe('parseOAuthApiFieldErrors', () => {
  it('returns detail message and field errors', () => {
    const parsed = parseOAuthApiFieldErrors({
      detail: 'Invalid client_id',
      client_id: ['Too short'],
    });
    expect(parsed.message).toBe('Invalid client_id');
    expect(parsed.fieldErrors.client_id).toBe('Too short');
  });
});
