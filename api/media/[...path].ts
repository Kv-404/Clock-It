const ALLOWED = /^[0-9a-f-]{36}\/(photos|videos)\/[A-Za-z0-9._-]+$/i;

function objectPath(request: Request): string | null {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const raw = pathname.replace(/^\/(?:api\/)?media\//, '').replace(/^\/+/, '');
  if (!ALLOWED.test(raw) || raw.includes('..')) return null;
  return raw;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const path = objectPath(request);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!path || !supabaseUrl || !key) {
    return new Response('Not found', { status: 404 });
  }

  const upstream = await fetch(`${supabaseUrl}/storage/v1/object/captures/${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
