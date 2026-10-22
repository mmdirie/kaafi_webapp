import { HttpError } from '../utils/http-error.js';

function getBearerToken(header) {
  if (typeof header !== 'string') {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function createRequireAuth({
  createClient
}) {
  if (typeof createClient !== 'function') {
    throw new TypeError('createRequireAuth requires a Supabase client factory.');
  }

  return async function requireAuth(req, res, next) {
    const accessToken = getBearerToken(req.get('authorization'));

    if (!accessToken) {
      return next(new HttpError(401, 'AUTH_REQUIRED', 'A bearer access token is required.'));
    }

    let supabase;
    try {
      supabase = createClient(accessToken);
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error) {
        const status = error.status === 401 || error.status === 403 ? 401 : 503;
        const code = status === 401 ? 'INVALID_ACCESS_TOKEN' : 'AUTH_PROVIDER_UNAVAILABLE';
        const message = status === 401
          ? 'The access token is invalid or expired.'
          : 'Authentication could not be verified right now.';
        return next(new HttpError(status, code, message));
      }

      if (!data?.user?.id) {
        return next(new HttpError(401, 'INVALID_ACCESS_TOKEN', 'The access token is invalid or expired.'));
      }

      req.user = data.user;
      req.supabase = supabase;
      req.accessToken = accessToken;
      return next();
    } catch (error) {
      req.log?.error({ err: error }, 'Supabase authentication request failed');
      return next(new HttpError(
        503,
        'AUTH_PROVIDER_UNAVAILABLE',
        'Authentication could not be verified right now.'
      ));
    }
  };
}
