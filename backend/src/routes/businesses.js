import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const businessesRouter = Router();

const createBusinessSchema = z.object({
  name: z.string().trim().min(1).max(160)
});

const updateBusinessSchema = z.object({
  name: z.string().trim().min(1).max(160)
});

const updateSettingsSchema = z.object({
  logo_url: z.string().url().nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().trim().max(50).nullable().optional(),
  currency_code: z.string().trim().length(3).transform(v => v.toUpperCase()).optional(),
  tax_rate: z.number().min(0).max(1).optional(),
  max_discount_percent: z.number().min(0).max(100).optional(),
  receipt_footer: z.string().trim().max(500).nullable().optional()
});

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'manager', 'cashier', 'inventory_staff'])
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'manager', 'cashier', 'inventory_staff']).optional(),
  status: z.enum(['active', 'disabled']).optional()
});

// List all businesses for the authenticated user
businessesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('business_members')
      .select('role, status, businesses(id, name, created_at, created_by)')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return next(error);

    const businesses = (data || []).map(item => ({
      ...item.businesses,
      role: item.role,
      status: item.status
    }));

    return res.json({ success: true, data: businesses });
  } catch (error) {
    return next(error);
  }
});

// Create a new business
businessesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const payload = createBusinessSchema.parse(req.body);

    const { data: business, error } = await req.supabase
      .from('businesses')
      .insert({
        name: payload.name,
        created_by: req.user.id
      })
      .select('id, name, created_by, created_at')
      .single();

    if (error) return next(error);

    return res.status(201).json({ success: true, data: business });
  } catch (error) {
    return next(error);
  }
});

// Get business details
businessesRouter.get(
  '/:businessId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const { data: business, error } = await req.supabase
        .from('businesses')
        .select('id, name, created_at, created_by')
        .eq('id', req.business.id)
        .single();

      if (error) return next(error);

      const { data: settings } = await req.supabase
        .from('business_settings')
        .select('*')
        .eq('business_id', req.business.id)
        .maybeSingle();

      return res.json({
        success: true,
        data: {
          ...business,
          role: req.business.role,
          settings: settings || {}
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Update business name (admin only)
businessesRouter.patch(
  '/:businessId',
  requireAuth,
  requireBusinessRoles('admin'),
  async (req, res, next) => {
    try {
      const payload = updateBusinessSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('businesses')
        .update({ name: payload.name, updated_at: new Date().toISOString() })
        .eq('id', req.business.id)
        .select('id, name, updated_at')
        .single();

      if (error) return next(error);

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Get business settings
businessesRouter.get(
  '/:businessId/settings',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const { data, error } = await req.supabase
        .from('business_settings')
        .select('*')
        .eq('business_id', req.business.id)
        .single();

      if (error) return next(error);

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Update business settings (admin, manager)
businessesRouter.put(
  '/:businessId/settings',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const payload = updateSettingsSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('business_settings')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', req.business.id)
        .select('*')
        .single();

      if (error) return next(error);

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// List members of business (admin, manager)
businessesRouter.get(
  '/:businessId/members',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const { data, error } = await req.supabase
        .from('business_members')
        .select('user_id, role, status, created_at, user_profiles(id, display_name, phone)')
        .eq('business_id', req.business.id)
        .order('created_at', { ascending: false });

      if (error) return next(error);

      const members = (data || []).map(m => ({
        user_id: m.user_id,
        role: m.role,
        status: m.status,
        created_at: m.created_at,
        display_name: m.user_profiles?.display_name || '',
        phone: m.user_profiles?.phone || ''
      }));

      return res.json({ success: true, data: members });
    } catch (error) {
      return next(error);
    }
  }
);

// Add/Invite member (admin only)
businessesRouter.post(
  '/:businessId/members',
  requireAuth,
  requireBusinessRoles('admin'),
  async (req, res, next) => {
    try {
      const payload = addMemberSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('business_members')
        .insert({
          business_id: req.business.id,
          user_id: payload.user_id,
          role: payload.role,
          status: 'active',
          invited_by: req.user.id
        })
        .select('business_id, user_id, role, status, created_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return next(new HttpError(409, 'MEMBER_EXISTS', 'This user is already a member of this business.'));
        }
        return next(error);
      }

      return res.status(201).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Update member role or status (admin only)
businessesRouter.patch(
  '/:businessId/members/:userId',
  requireAuth,
  requireBusinessRoles('admin'),
  async (req, res, next) => {
    try {
      const payload = updateMemberSchema.parse(req.body);
      const targetUserId = z.string().uuid().parse(req.params.userId);

      if (targetUserId === req.user.id && payload.status === 'disabled') {
        return next(new HttpError(400, 'CANNOT_DISABLE_SELF', 'Admins cannot disable their own membership.'));
      }

      const { data, error } = await req.supabase
        .from('business_members')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', req.business.id)
        .eq('user_id', targetUserId)
        .select('business_id, user_id, role, status, updated_at')
        .single();

      if (error) return next(error);

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Remove member (admin only)
businessesRouter.delete(
  '/:businessId/members/:userId',
  requireAuth,
  requireBusinessRoles('admin'),
  async (req, res, next) => {
    try {
      const targetUserId = z.string().uuid().parse(req.params.userId);

      if (targetUserId === req.user.id) {
        return next(new HttpError(400, 'CANNOT_REMOVE_SELF', 'Admins cannot remove themselves from their business.'));
      }

      const { error } = await req.supabase
        .from('business_members')
        .delete()
        .eq('business_id', req.business.id)
        .eq('user_id', targetUserId);

      if (error) return next(error);

      return res.json({ success: true, data: { removed: true } });
    } catch (error) {
      return next(error);
    }
  }
);
