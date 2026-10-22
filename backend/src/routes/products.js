import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const productsRouter = Router({ mergeParams: true });

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  cost_price: z.number().min(0).default(0),
  selling_price: z.number().min(0),
  initial_stock: z.number().int().min(0).default(0),
  stock_threshold: z.number().int().min(0).default(5),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true)
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  cost_price: z.number().min(0).optional(),
  selling_price: z.number().min(0).optional(),
  stock_threshold: z.number().int().min(0).optional(),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional()
});

// List products with pagination, search, category/supplier filters, and sorting
productsRouter.get(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const search = req.query.search ? String(req.query.search).trim() : '';
      const categoryId = req.query.categoryId ? String(req.query.categoryId).trim() : '';
      const supplierId = req.query.supplierId ? String(req.query.supplierId).trim() : '';
      const stockStatus = req.query.stockStatus ? String(req.query.stockStatus).trim() : 'all'; // all, in_stock, low_stock, out_of_stock
      const sortBy = ['name', 'selling_price', 'cost_price', 'stock_quantity', 'created_at'].includes(req.query.sortBy)
        ? req.query.sortBy
        : 'created_at';
      const sortOrder = req.query.sortOrder === 'asc' ? true : false;

      let query = req.supabase
        .from('products')
        .select(`
          id, business_id, category_id, supplier_id, name, sku, description,
          cost_price, selling_price, stock_quantity, stock_threshold,
          image_url, is_active, created_at, updated_at,
          categories(id, name),
          suppliers(id, name)
        `, { count: 'exact' })
        .eq('business_id', req.business.id);

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      if (stockStatus === 'in_stock') {
        query = query.gt('stock_quantity', 0);
      } else if (stockStatus === 'out_of_stock') {
        query = query.eq('stock_quantity', 0);
      }

      query = query
        .order(sortBy, { ascending: sortOrder })
        .range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) return next(error);

      // Add low_stock indicator client flag based on threshold
      let formatted = (data || []).map(p => ({
        ...p,
        category_name: p.categories?.name || 'Uncategorized',
        supplier_name: p.suppliers?.name || 'None',
        is_low_stock: p.stock_quantity <= p.stock_threshold && p.stock_quantity > 0,
        is_out_of_stock: p.stock_quantity === 0
      }));

      if (stockStatus === 'low_stock') {
        formatted = formatted.filter(p => p.is_low_stock);
      }

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

// Get single product details
productsRouter.get(
  '/:productId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const productId = z.string().uuid().parse(req.params.productId);

      const { data, error } = await req.supabase
        .from('products')
        .select(`
          id, business_id, category_id, supplier_id, name, sku, description,
          cost_price, selling_price, stock_quantity, stock_threshold,
          image_url, is_active, created_at, updated_at,
          categories(id, name),
          suppliers(id, name)
        `)
        .eq('business_id', req.business.id)
        .eq('id', productId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return next(new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.'));
        }
        return next(error);
      }

      return res.json({
        success: true,
        data: {
          ...data,
          category_name: data.categories?.name || 'Uncategorized',
          supplier_name: data.suppliers?.name || 'None',
          is_low_stock: data.stock_quantity <= data.stock_threshold && data.stock_quantity > 0,
          is_out_of_stock: data.stock_quantity === 0
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Create product (admin, manager, inventory_staff)
productsRouter.post(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const payload = createProductSchema.parse(req.body);

      // Insert product
      const { data: product, error } = await req.supabase
        .from('products')
        .insert({
          business_id: req.business.id,
          category_id: payload.category_id || null,
          supplier_id: payload.supplier_id || null,
          name: payload.name,
          sku: payload.sku,
          description: payload.description || null,
          cost_price: payload.cost_price,
          selling_price: payload.selling_price,
          stock_threshold: payload.stock_threshold,
          image_url: payload.image_url || null,
          is_active: payload.is_active
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          return next(new HttpError(409, 'SKU_EXISTS', `A product with SKU "${payload.sku}" already exists in this business.`));
        }
        return next(error);
      }

      // If initial stock > 0, adjust stock using the atomic procedure so movement and audit log are created
      if (payload.initial_stock > 0) {
        await req.supabase.rpc('perform_stock_adjustment', {
          p_business_id: req.business.id,
          p_product_id: product.id,
          p_quantity_delta: payload.initial_stock,
          p_reason: 'Initial stock on product creation'
        });
        product.stock_quantity = payload.initial_stock;
      }

      return res.status(201).json({ success: true, data: product });
    } catch (error) {
      return next(error);
    }
  }
);

// Update product (admin, manager, inventory_staff)
productsRouter.put(
  '/:productId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const productId = z.string().uuid().parse(req.params.productId);
      const payload = updateProductSchema.parse(req.body);

      const { data, error } = await req.supabase
        .from('products')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', req.business.id)
        .eq('id', productId)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          return next(new HttpError(409, 'SKU_EXISTS', 'A product with this SKU already exists.'));
        }
        return next(error);
      }

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Delete product (admin, manager)
// Checks if sale_items exist; if so, soft-deletes (is_active = false) to preserve financial integrity
productsRouter.delete(
  '/:productId',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const productId = z.string().uuid().parse(req.params.productId);

      // Check if product was referenced in sales
      const { count: salesCount } = await req.supabase
        .from('sale_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', req.business.id)
        .eq('product_id', productId);

      if (salesCount && salesCount > 0) {
        // Soft delete: deactivate product
        await req.supabase
          .from('products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('business_id', req.business.id)
          .eq('id', productId);

        return res.json({
          success: true,
          data: {
            deleted: false,
            deactivated: true,
            message: 'Product has historical sales records. It has been deactivated instead of deleted to protect accounting audit trails.'
          }
        });
      }

      // If no sales history, safe to delete
      const { error } = await req.supabase
        .from('products')
        .delete()
        .eq('business_id', req.business.id)
        .eq('id', productId);

      if (error) return next(error);

      return res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      return next(error);
    }
  }
);

// Get stock movement history for a specific product
productsRouter.get(
  '/:productId/movements',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const productId = z.string().uuid().parse(req.params.productId);

      const { data, error } = await req.supabase
        .from('inventory_movements')
        .select(`
          id, movement_type, quantity_delta, quantity_after, reason,
          created_at, sale_id, purchase_receipt_id, refund_id,
          user_profiles(display_name)
        `)
        .eq('business_id', req.business.id)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return next(error);

      const movements = (data || []).map(m => ({
        id: m.id,
        movement_type: m.movement_type,
        quantity_delta: m.quantity_delta,
        quantity_after: m.quantity_after,
        reason: m.reason || '',
        created_at: m.created_at,
        actor_name: m.user_profiles?.display_name || 'System'
      }));

      return res.json({ success: true, data: movements });
    } catch (error) {
      return next(error);
    }
  }
);
