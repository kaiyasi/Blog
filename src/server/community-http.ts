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
  return !origin || origin === new URL(request.url).origin;
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
