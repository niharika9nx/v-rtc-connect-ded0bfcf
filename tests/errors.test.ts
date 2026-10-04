import { describe, expect, it } from 'vitest';
import { errorMessage } from '../supabase/functions/_shared/errors.ts';

describe('errorMessage', () => {
  it('returns the message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values', () => {
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });
});
