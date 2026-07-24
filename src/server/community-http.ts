const limits = new Map<string, number[]>();

export const communityJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  let normalizedOrigin: string;
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    normalizedOrigin = parsed.origin;
  } catch {
    return false;
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  const protocol = forwardedProtocol || requestUrl.protocol.replace(':', '');
  const accepted = new Set([requestUrl.origin]);
  if (host && ['http', 'https'].includes(protocol)) accepted.add(`${protocol}://${host}`);
  return accepted.has(normalizedOrigin);
}

export function rateLimited(request: Request, scope: string, maximum: number, windowMs: number) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'local';
  const key = `${scope}:${address}`;
  const threshold = Date.now() - windowMs;
  const recent = (limits.get(key) ?? []).filter(time => time > threshold);
  recent.push(Date.now());
  limits.set(key, recent);
  return recent.length > maximum;
}

export const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
