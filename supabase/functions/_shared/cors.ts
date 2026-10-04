// Comma-separated list of production origins, e.g.
// ALLOWED_ORIGIN="https://app.example.com,https://www.app.example.com"
const CONFIGURED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

// Local development servers are always allowed so the app works without extra
// configuration. Vite is configured to run on port 8080 (see vite.config.ts).
const DEV_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const ALLOWED_ORIGINS = [...new Set([...CONFIGURED_ORIGINS, ...DEV_ORIGINS])];

if (CONFIGURED_ORIGINS.length === 0) {
  console.warn(
    'ALLOWED_ORIGIN is not set. Only local development origins are accepted. ' +
      'Set ALLOWED_ORIGIN to a comma-separated list of production origins.',
  );
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''));
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin!.replace(/\/$/, ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  const headers = corsHeaders(req.headers.get('origin'));
  if (Object.keys(headers).length === 0) {
    return new Response('Origin not allowed', { status: 403 });
  }
  return new Response(null, { status: 204, headers });
}
