import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const expensesRouter = Router({ mergeParams: true });

const createExpenseSchema = z.object({
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  amount: z.number().min(0.01),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').default(() => new Date().toISOString().slice(0, 10))
});

const updateExpenseSchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  amount: z.number().min(0.01).optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional()
});

// List expenses
expensesRouter.get(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
      const offset = (page - 1) * limit;

      const category = req.query.category ? String(req.query.category).trim() : '';
      const startDate = req.query.startDate ? String(req.query.startDate).trim() : '';
      const endDate = req.query.endDate ? String(req.query.endDate).trim() : '';

      let query = req.supabase
        .from('expenses')
        .select(`
          id, category, description, amount, expense_date, created_at,
          user_profiles(display_name)
        `, { count: 'exact' })
        .eq('business_id', req.business.id)
        .order('expense_date', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      if (startDate) {
        query = query.gte('expense_date', startDate);
      }

      if (endDate) {
        query = query.lte('expense_date', endDate);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map(e => ({
        ...e,
        recorded_by_name: e.user_profiles?.display_name || 'Staff'
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

// Create expense
expensesRouter.post(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const payload = createExpenseSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('expenses')
        .insert({
          business_id: req.business.id,
          category: payload.category,
          description: payload.description,
          amount: payload.amount,
          expense_date: payload.expense_date,
          recorded_by: req.user.id
        })
        .select('*')
        .single();

      if (error) return next(error);

      return res.status(201).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Update expense
expensesRouter.put(
  '/:expenseId',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const expenseId = z.string().uuid().parse(req.params.expenseId);
      const payload = updateExpenseSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('expenses')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', req.business.id)
        .eq('id', expenseId)
        .select('*')
        .single();

      if (error) return next(error);

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Delete expense
expensesRouter.delete(
  '/:expenseId',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const expenseId = z.string().uuid().parse(req.params.expenseId);

      const { error } = await req.supabase
        .from('expenses')
        .delete()
        .eq('business_id', req.business.id)
        .eq('id', expenseId);

      if (error) return next(error);

      return res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      return next(error);
    }
  }
);
