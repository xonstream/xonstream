import type { Bindings } from './types';

// Helper for base64url encoding/decoding
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// Generate JWT token with HMAC-SHA256
export async function signJwt(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${data}.${encodedSignature}`;
}

// Verify JWT token with HMAC-SHA256
export async function verifyJwt(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(base64UrlDecode(encodedSignature), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));

    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    // Check expiration if present
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Admin Auth Middleware for Hono
export async function adminAuthMiddleware(c: any, next: any) {
  // Check authorization header
  const authHeader = c.req.header('Authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    // Check cookie
    const cookies = c.req.header('Cookie') || '';
    const match = cookies.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return c.json({ success: false, message: 'Unauthorized: Missing token' }, 401);
  }

  const secret = c.env.ADMIN_SECRET || 'xonstream';
  const decoded = await verifyJwt(token, secret);

  const expectedUser = c.env.ADMIN_USERNAME || 'admin';
  if (!decoded || decoded.username !== expectedUser) {
    return c.json({ success: false, message: 'Unauthorized: Invalid token' }, 401);
  }

  c.set('user', decoded);
  await next();
}
