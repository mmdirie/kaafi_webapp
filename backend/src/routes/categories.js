import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const categoriesRouter = Router({ mergeParams: true });

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable()
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable()
});

// List categories for a business with product count
categoriesRouter.get(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const search = req.query.search ? String(req.query.search).trim() : '';

      let query = req.supabase
        .from('categories')
        .select('id, name, description, created_at, updated_at, products(count)')
        .eq('business_id', req.business.id)
        .order('name', { ascending: true });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        created_at: cat.created_at,
        updated_at: cat.updated_at,
        product_count: cat.products?.[0]?.count || 0
      }));

      return res.json({ success: true, data: formatted });
    } catch (error) {
      return next(error);
    }
  }
);

// Get single category
categoriesRouter.get(
  '/:categoryId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const categoryId = z.string().uuid().parse(req.params.categoryId);

      const { data, error } = await req.supabase
        .from('categories')
        .select('id, name, description, created_at, updated_at, products(count)')
        .eq('business_id', req.business.id)
        .eq('id', categoryId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return next(new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found.'));
        }
        return next(error);
      }

      return res.json({
        success: true,
        data: {
          ...data,
          product_count: data.products?.[0]?.count || 0
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Create category (admin, manager)
categoriesRouter.post(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const payload = createCategorySchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('categories')
        .insert({
          business_id: req.business.id,
          name: payload.name,
          description: payload.description || null
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          return next(new HttpError(409, 'CATEGORY_EXISTS', `A category named "${payload.name}" already exists.`));
        }
        return next(error);
      }

      return res.status(201).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Update category (admin, manager)
categoriesRouter.put(
  '/:categoryId',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const categoryId = z.string().uuid().parse(req.params.categoryId);
      const payload = updateCategorySchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('categories')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', req.business.id)
        .eq('id', categoryId)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          return next(new HttpError(409, 'CATEGORY_EXISTS', 'A category with this name already exists.'));
        }
        return next(error);
      }

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Delete category (admin, manager)
// Enforces requirement: Prevent deletion when a category is still in use!
categoriesRouter.delete(
  '/:categoryId',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const categoryId = z.string().uuid().parse(req.params.categoryId);

      // Check if products are using this category
      const { count, error: countError } = await req.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', req.business.id)
        .eq('category_id', categoryId);

      if (countError) return next(countError);

      if (count && count > 0) {
        return next(
          new HttpError(
            409,
            'CATEGORY_IN_USE',
            `Cannot delete this category because ${count} product(s) are assigned to it. Please reassign or delete the products first.`
          )
        );
      }

      const { error } = await req.supabase
        .from('categories')
        .delete()
        .eq('business_id', req.business.id)
        .eq('id', categoryId);

      if (error) return next(error);

      return res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      return next(error);
    }
  }
);
