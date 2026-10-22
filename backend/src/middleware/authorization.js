import { z } from 'zod';
import { HttpError } from '../utils/http-error.js';

const businessIdSchema = z.string().uuid();
const validRoles = new Set(['admin', 'manager', 'cashier', 'inventory_staff']);

export function requireBusinessRoles(...roles) {
  if (roles.length === 0 || roles.some((role) => !validRoles.has(role))) {
    throw new TypeError('requireBusinessRoles needs one or more valid business roles.');
  }

  return async function authorizeBusinessRole(req, res, next) {
    const parsedBusinessId = businessIdSchema.safeParse(req.params.businessId);
    if (!parsedBusinessId.success) {
      return next(new HttpError(400, 'INVALID_BUSINESS_ID', 'A valid business ID is required.'));
    }

    if (!req.user?.id || !req.supabase) {
      return next(new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.'));
    }

    try {
      const { data, error } = await req.supabase
        .from('business_members')
        .select('business_id, user_id, role, status')
        .eq('business_id', parsedBusinessId.data)
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        req.log?.error({ err: error }, 'Business membership lookup failed');
        return next(new HttpError(503, 'AUTHORIZATION_UNAVAILABLE', 'Business access could not be verified.'));
      }

      if (!data || !roles.includes(data.role)) {
        return next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to access this business resource.'));
      }

      req.business = {
        id: data.business_id,
        role: data.role
      };
      return next();
    } catch (error) {
      req.log?.error({ err: error }, 'Business authorization request failed');
      return next(new HttpError(503, 'AUTHORIZATION_UNAVAILABLE', 'Business access could not be verified.'));
    }
  };
}
