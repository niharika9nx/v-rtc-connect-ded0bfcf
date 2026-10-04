import { describe, expect, it } from 'vitest';
import {
  extractBearerToken,
  constantTimeEqual,
} from '../supabase/functions/_shared/auth.ts';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://example.com', { headers });

describe('extractBearerToken', () => {
  it('returns null when the Authorization header is missing', () => {
    expect(extractBearerToken(req())).toBeNull();
  });

  it('returns null for non-Bearer schemes', () => {
    expect(extractBearerToken(req({ Authorization: 'Basic abc' }))).toBeNull();
    expect(extractBearerToken(req({ Authorization: 'bearer abc' }))).toBeNull();
  });

  it('returns null for an empty bearer token', () => {
    expect(extractBearerToken(req({ Authorization: 'Bearer    ' }))).toBeNull();
  });

  it('extracts and trims the token', () => {
    expect(extractBearerToken(req({ Authorization: 'Bearer  abc.def  ' }))).toBe(
      'abc.def',
    );
  });
});

describe('constantTimeEqual', () => {
  it('returns true for identical strings', async () => {
    expect(await constantTimeEqual('secret', 'secret')).toBe(true);
    expect(await constantTimeEqual('', '')).toBe(true);
  });

  it('returns false for different strings and lengths', async () => {
    expect(await constantTimeEqual('secret', 'secreu')).toBe(false);
    expect(await constantTimeEqual('secret', 'secret-longer')).toBe(false);
    expect(await constantTimeEqual('', 'x')).toBe(false);
  });
});
