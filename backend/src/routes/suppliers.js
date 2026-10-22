import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const suppliersRouter = Router({ mergeParams: true });

const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contact_name: z.string().trim().max(100).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  is_active: z.boolean().default(true)
});

const updateSupplierSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  contact_name: z.string().trim().max(100).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  is_active: z.boolean().optional()
});

// List suppliers with search
suppliersRouter.get(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const search = req.query.search ? String(req.query.search).trim() : '';

      let query = req.supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', req.business.id)
        .order('name', { ascending: true });

      if (search) {
        query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) return next(error);

      return res.json({ success: true, data: data || [] });
    } catch (error) {
      return next(error);
    }
  }
);

// Get supplier details with purchases
suppliersRouter.get(
  '/:supplierId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const supplierId = z.string().uuid().parse(req.params.supplierId);

      const { data: supplier, error } = await req.supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', req.business.id)
        .eq('id', supplierId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return next(new HttpError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found.'));
        }
        return next(error);
      }

      // Fetch recent purchases from this supplier
      const { data: purchases } = await req.supabase
        .from('purchases')
        .select('id, purchase_number, status, payment_status, subtotal, created_at')
        .eq('business_id', req.business.id)
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .limit(20);

      return res.json({
        success: true,
        data: {
          ...supplier,
          purchases: purchases || []
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Create supplier (admin, manager, inventory_staff)
suppliersRouter.post(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const payload = createSupplierSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('suppliers')
        .insert({
          business_id: req.business.id,
          ...payload
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

// Update supplier (admin, manager, inventory_staff)
suppliersRouter.put(
  '/:supplierId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const supplierId = z.string().uuid().parse(req.params.supplierId);
      const payload = updateSupplierSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('suppliers')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', req.business.id)
        .eq('id', supplierId)
        .select('*')
        .single();

      if (error) return next(error);

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Delete supplier (admin, manager)
suppliersRouter.delete(
  '/:supplierId',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const supplierId = z.string().uuid().parse(req.params.supplierId);

      // Check if products or purchases are linked
      const { count: prodCount } = await req.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', req.business.id)
        .eq('supplier_id', supplierId);

      if (prodCount && prodCount > 0) {
        return next(
          new HttpError(
            409,
            'SUPPLIER_IN_USE',
            `Cannot delete this supplier because ${prodCount} product(s) are associated with them.`
          )
        );
      }

      const { error } = await req.supabase
        .from('suppliers')
        .delete()
        .eq('business_id', req.business.id)
        .eq('id', supplierId);

      if (error) return next(error);

      return res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      return next(error);
    }
  }
);
