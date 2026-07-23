import { defineMiddleware } from 'astro:middleware';
import { adminEntryPath, hasAdminEntryGrant } from './server/admin-entry';
import { isAdminAuthenticated } from './server/admin-auth';

const hiddenResponse = () => new Response('Not Found', {
  status: 404,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
  },
});

export const onRequest = defineMiddleware(async (context, next) => {
  const entryPath = adminEntryPath();
  if (!entryPath) return next();

  if (context.url.pathname === '/admin' || context.url.pathname.startsWith('/admin/')) {
    return hiddenResponse();
  }

  if (context.url.pathname !== entryPath) return next();
  if (!hasAdminEntryGrant(context.request) && !isAdminAuthenticated(context.request)) return hiddenResponse();

  const response = await next('/admin');
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
