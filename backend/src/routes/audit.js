import { Router } from 'express';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';

export const auditRouter = Router({ mergeParams: true });

auditRouter.get(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
      const offset = (page - 1) * limit;

      const action = req.query.action ? String(req.query.action).trim() : '';
      const entityType = req.query.entityType ? String(req.query.entityType).trim() : '';

      let query = req.supabase
        .from('audit_logs')
        .select(`
          id, action, entity_type, entity_id, details, created_at,
          user_profiles(display_name)
        `, { count: 'exact' })
        .eq('business_id', req.business.id)
        .order('created_at', { ascending: false });

      if (action) {
        query = query.eq('action', action);
      }

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map(a => ({
        id: a.id,
        action: a.action,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        details: a.details || {},
        created_at: a.created_at,
        actor_name: a.user_profiles?.display_name || 'System'
      }));

      return res.json({
        success: true,
        data: formatted,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);
