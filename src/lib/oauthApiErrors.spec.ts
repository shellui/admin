import { describe, expect, it } from 'vitest';
import { parseOAuthApiFieldErrors, parseOAuthApiErrorPayload } from '@/lib/oauthApiErrors';

describe('parseOAuthApiErrorPayload', () => {
  it('detects duplicate errors with existing app id', () => {
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

  it('treats HTTP 409 as duplicate when code is present on 400', () => {
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
