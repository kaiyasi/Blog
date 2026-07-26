import { defineMiddleware } from 'astro:middleware';
import { hasAdminEntryGrant } from './server/admin-entry';
import { adminSessionEntryPath } from './server/admin-auth';

const hiddenResponse = async (render404: () => Promise<Response>) => {
  const response = await render404();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: 404, statusText: 'Not Found', headers });
};

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname === '/admin' || context.url.pathname.startsWith('/admin/')) {
    return hiddenResponse(() => next('/404'));
  }

  const sessionPath = adminSessionEntryPath(context.request);
  const hasEntry = hasAdminEntryGrant(context.request, context.url.pathname);
  const hasSession = sessionPath === context.url.pathname;
  if (!hasEntry && !hasSession) return next();

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
