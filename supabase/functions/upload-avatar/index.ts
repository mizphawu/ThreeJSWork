const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase Edge Function environment is not configured.');
}

const AVATAR_TYPES: Record<string, { extension: string }> = {
  'image/jpeg': { extension: 'jpg' },
  'image/png': { extension: 'png' },
  'image/webp': { extension: 'webp' }
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}

function hasValidImageSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/png') {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }

  if (type === 'image/jpeg') {
    return bytes.length >= 3
      && bytes[0] === 0xff
      && bytes[1] === 0xd8
      && bytes[2] === 0xff;
  }

  return type === 'image/webp'
    && bytes.length >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
}

async function hasActivePlayerSession(sessionToken: string) {
  const response = await fetch(
    new URL('/rest/v1/rpc/cone_clash_get_session', SUPABASE_URL),
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_session_token: sessionToken })
    }
  );

  if (!response.ok) {
    console.error('Session validation RPC failed:', await response.text());
    throw new Error('Session validation failed.');
  }

  const sessions: unknown = await response.json();
  if (!Array.isArray(sessions)) {
    throw new Error('Session validation returned an invalid response.');
  }

  return sessions.some((session: { role?: unknown }) => session?.role === 'user');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const sessionToken = request.headers.get('x-session-token') ?? '';
  if (!SESSION_TOKEN_PATTERN.test(sessionToken)) {
    return jsonResponse({ error: 'Sign in before uploading an avatar.' }, 401);
  }

  let hasValidSession: boolean;
  try {
    hasValidSession = await hasActivePlayerSession(sessionToken);
  } catch (error) {
    console.error('Avatar session validation failed:', error);
    return jsonResponse({ error: 'Unable to verify your session. Please try again.' }, 502);
  }

  if (!hasValidSession) {
    return jsonResponse({ error: 'Sign in before uploading an avatar.' }, 401);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_SIZE + 65536) {
    return jsonResponse({ error: 'Avatar images must be 5 MB or smaller.' }, 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Upload a valid image file.' }, 400);
  }

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return jsonResponse({ error: 'Choose an avatar image to upload.' }, 400);
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return jsonResponse({ error: 'Avatar images must be 5 MB or smaller.' }, 413);
  }

  const avatarType = AVATAR_TYPES[file.type];
  if (!avatarType) {
    return jsonResponse({ error: 'Only JPEG, PNG, and WebP avatars are allowed.' }, 415);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidImageSignature(file.type, bytes)) {
    return jsonResponse({ error: 'The file contents do not match an allowed image type.' }, 415);
  }

  const fileName = `${crypto.randomUUID()}.${avatarType.extension}`;
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(
      new URL(`/storage/v1/object/avatars/${fileName}`, SUPABASE_URL),
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': file.type,
          'Cache-Control': '3600',
          'x-upsert': 'false'
        },
        body: bytes
      }
    );
  } catch (error) {
    console.error('Avatar storage request failed:', error);
    return jsonResponse({ error: 'Avatar upload failed. Please try again.' }, 502);
  }

  if (!uploadResponse.ok) {
    console.error('Avatar storage rejected upload:', await uploadResponse.text());
    return jsonResponse({ error: 'Avatar upload failed. Please try again.' }, 502);
  }

  const publicUrl = new URL(
    `/storage/v1/object/public/avatars/${fileName}`,
    SUPABASE_URL
  ).toString();
  return jsonResponse({ publicUrl });
});
