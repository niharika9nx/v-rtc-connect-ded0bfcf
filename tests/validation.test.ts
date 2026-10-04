import { describe, expect, it } from 'vitest';
import {
  isUuid,
  isValidPassFilePath,
} from '../supabase/functions/_shared/validation.ts';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('isUuid', () => {
  it('accepts valid UUIDs case-insensitively', () => {
    expect(isUuid(VALID_UUID)).toBe(true);
    expect(isUuid(VALID_UUID.toUpperCase())).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid('123e4567-e89b-12d3-a456-42661417400')).toBe(false);
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000-extra')).toBe(false);
  });
});

describe('isValidPassFilePath', () => {
  it('accepts {uuid}/{filename}.{jpg|jpeg|png}', () => {
    expect(isValidPassFilePath(`${VALID_UUID}/pass.jpg`)).toBe(true);
    expect(isValidPassFilePath(`${VALID_UUID}/my pass.jpeg`)).toBe(true);
    expect(isValidPassFilePath(`${VALID_UUID}/photo.PNG`)).toBe(true);
  });

  it('rejects invalid folders, extensions, traversal and nested paths', () => {
    expect(isValidPassFilePath(`not-a-uuid/pass.jpg`)).toBe(false);
    expect(isValidPassFilePath(`${VALID_UUID}/pass.gif`)).toBe(false);
    expect(isValidPassFilePath(`${VALID_UUID}/pass`)).toBe(false);
    expect(isValidPassFilePath(`${VALID_UUID}/../secret.jpg`)).toBe(false);
    expect(isValidPassFilePath(`${VALID_UUID}/nested/pass.jpg`)).toBe(false);
    expect(isValidPassFilePath(null)).toBe(false);
    expect(isValidPassFilePath(42)).toBe(false);
  });
});
