import { describe, expect, it } from 'vitest';
import { isCorsOriginAllowed } from './config';

describe('config', () => {
  it('isCorsOriginAllowed accepts localhost dev origins', () => {
    expect(isCorsOriginAllowed('http://localhost:4200')).toBe(true);
    expect(isCorsOriginAllowed('http://127.0.0.1:4200')).toBe(true);
  });

  it('isCorsOriginAllowed accepts vercel preview URLs', () => {
    expect(isCorsOriginAllowed('https://voice-data-entry-web.vercel.app')).toBe(true);
    expect(isCorsOriginAllowed('https://my-branch.vercel.app')).toBe(true);
  });

  it('isCorsOriginAllowed rejects unknown origins', () => {
    expect(isCorsOriginAllowed('https://evil.example.com')).toBe(false);
  });

  it('isCorsOriginAllowed allows missing origin (same-origin tools)', () => {
    expect(isCorsOriginAllowed(undefined)).toBe(true);
  });
});
