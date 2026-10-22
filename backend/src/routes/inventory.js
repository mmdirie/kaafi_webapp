import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const inventoryRouter = Router({ mergeParams: true });

const adjustStockSchema = z.object({
  product_id: z.string().uuid(),
  quantity_delta: z.number().int().refine(val => val !== 0, {
    message: 'Quantity delta must be non-zero'
  }),
  reason: z.string().trim().min(1).max(500)
});

// Perform atomic stock adjustment (stock in / stock out / correction)
inventoryRouter.post(
  '/adjust',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const payload = adjustStockSchema.parse(req.body);

      const { data, error } = await req.supabase.rpc('perform_stock_adjustment', {
        p_business_id: req.business.id,
        p_product_id: payload.product_id,
        p_quantity_delta: payload.quantity_delta,
        p_reason: payload.reason
      });

      if (error) {
        return next(new HttpError(400, 'STOCK_ADJUSTMENT_FAILED', error.message));
      }

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// List inventory movements
inventoryRouter.get(
  '/movements',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff', 'cashier'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
      const offset = (page - 1) * limit;

      const movementType = req.query.type ? String(req.query.type).trim() : '';
      const productId = req.query.productId ? String(req.query.productId).trim() : '';
      const startDate = req.query.startDate ? String(req.query.startDate).trim() : '';
      const endDate = req.query.endDate ? String(req.query.endDate).trim() : '';

      let query = req.supabase
        .from('inventory_movements')
        .select(`
          id, product_id, movement_type, quantity_delta, quantity_after,
          reason, created_at, sale_id, purchase_receipt_id, refund_id,
          products(id, name, sku),
          user_profiles(id, display_name)
        `, { count: 'exact' })
        .eq('business_id', req.business.id)
        .order('created_at', { ascending: false });

      if (movementType) {
        query = query.eq('movement_type', movementType);
      }

      if (productId) {
        query = query.eq('product_id', productId);
      }

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }

      if (endDate) {
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('created_at', nextDay.toISOString());
      }

      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map(m => ({
        id: m.id,
        product_id: m.product_id,
        product_name: m.products?.name || 'Product',
        sku: m.products?.sku || '',
        movement_type: m.movement_type,
        quantity_delta: m.quantity_delta,
        quantity_after: m.quantity_after,
        reason: m.reason || '',
        created_at: m.created_at,
        actor_name: m.user_profiles?.display_name || 'System'
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

// Get low-stock and out-of-stock alerts
inventoryRouter.get(
  '/alerts',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff', 'cashier'),
  async (req, res, next) => {
    try {
      const { data, error } = await req.supabase
        .from('products')
        .select(`
          id, name, sku, stock_quantity, stock_threshold, cost_price, selling_price,
          categories(name), suppliers(name)
        `)
        .eq('business_id', req.business.id)
        .eq('is_active', true)
        .order('stock_quantity', { ascending: true });

      if (error) return next(error);

      const outOfStock = [];
      const lowStock = [];

      for (const p of data || []) {
        const item = {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock_quantity: p.stock_quantity,
          stock_threshold: p.stock_threshold,
          category_name: p.categories?.name || 'Uncategorized',
          supplier_name: p.suppliers?.name || 'None'
        };

        if (p.stock_quantity === 0) {
          outOfStock.push(item);
        } else if (p.stock_quantity <= p.stock_threshold) {
          lowStock.push(item);
        }
      }

      return res.json({
        success: true,
        data: {
          out_of_stock: outOfStock,
          low_stock: lowStock,
          total_alerts: outOfStock.length + lowStock.length
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);
