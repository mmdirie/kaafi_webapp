import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { HttpError } from '../utils/http-error.js';

export const authRouter = Router();

const updateProfileSchema = z.object({
  display_name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(50).nullable().optional()
});

// Current user profile and memberships
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { data: profile, error: profileError } = await req.supabase
      .from('user_profiles')
      .select('id, display_name, phone, created_at, updated_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (profileError) {
      return next(profileError);
    }

    const { data: memberships, error: membershipsError } = await req.supabase
      .from('business_members')
      .select('business_id, role, status, businesses(id, name)')
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    if (membershipsError) {
      return next(membershipsError);
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email
        },
        profile: profile || { id: req.user.id, display_name: '', phone: '' },
        businesses: memberships || []
      }
    });
  } catch (error) {
    return next(error);
  }
});

// Update own profile
authRouter.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const payload = updateProfileSchema.parse(req.body);

    const { data, error } = await req.supabase
      .from('user_profiles')
      .upsert({
        id: req.user.id,
        ...payload,
        updated_at: new Date().toISOString()
      })
      .select('id, display_name, phone, updated_at')
      .single();

    if (error) return next(error);

    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});
