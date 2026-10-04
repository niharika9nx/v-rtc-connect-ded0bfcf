import { afterEach, describe, expect, it, vi } from 'vitest';

type CorsModule = typeof import('../supabase/functions/_shared/cors.ts');

async function loadCors(allowedOrigin?: string): Promise<CorsModule> {
  vi.resetModules();
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => (key === 'ALLOWED_ORIGIN' ? allowedOrigin : undefined),
    },
  });
  return import('../supabase/functions/_shared/cors.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cors helpers with no ALLOWED_ORIGIN configured', () => {
  it('allows local development origins', async () => {
    const { isAllowedOrigin } = await loadCors(undefined);
    expect(isAllowedOrigin('http://localhost:8080')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:8080')).toBe(true);
  });

  it('denies unknown origins and null', async () => {
    const { isAllowedOrigin } = await loadCors(undefined);
    expect(isAllowedOrigin('https://v-rtc-connect.vercel.app')).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });

  it('returns CORS headers only for allowed origins', async () => {
    const { corsHeaders } = await loadCors(undefined);
    expect(
      corsHeaders('http://localhost:8080')['Access-Control-Allow-Origin'],
    ).toBe('http://localhost:8080');
    expect(corsHeaders('https://evil.com')).toEqual({});
  });

  it('responds to OPTIONS preflight and passes through other methods', async () => {
    const { handleCors } = await loadCors(undefined);
    const ok = handleCors(
      new Request('https://x/fn', {
        method: 'OPTIONS',
        headers: { origin: 'http://localhost:8080' },
      }),
    );
    expect(ok?.status).toBe(204);

    const blocked = handleCors(
      new Request('https://x/fn', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.com' },
      }),
    );
    expect(blocked?.status).toBe(403);

    expect(
      handleCors(new Request('https://x/fn', { method: 'POST' })),
    ).toBeNull();
  });
});

describe('cors helpers with ALLOWED_ORIGIN configured', () => {
  it('allows configured origins and normalizes trailing slashes', async () => {
    const { isAllowedOrigin, corsHeaders } = await loadCors(
      'https://v-rtc-connect.vercel.app/, https://www.example.com',
    );
    expect(isAllowedOrigin('https://v-rtc-connect.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://v-rtc-connect.vercel.app/')).toBe(true);
    expect(isAllowedOrigin('https://www.example.com')).toBe(true);
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(
      corsHeaders('https://v-rtc-connect.vercel.app/')[
        'Access-Control-Allow-Origin'
      ],
    ).toBe('https://v-rtc-connect.vercel.app');
  });

  it('still allows local development origins', async () => {
    const { isAllowedOrigin } = await loadCors('https://v-rtc-connect.vercel.app');
    expect(isAllowedOrigin('http://localhost:8080')).toBe(true);
  });
});
