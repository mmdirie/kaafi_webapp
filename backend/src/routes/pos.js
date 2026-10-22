import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const posRouter = Router({ mergeParams: true });

const checkoutSchema = z.object({
  idempotency_key: z.string().trim().min(1).max(200),
  payment_method: z.enum(['cash', 'card', 'mobile_money']),
  amount_paid: z.number().min(0),
  discount_total: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(1).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'Cart cannot be empty')
});

// Quick search products for POS register
posRouter.get(
  '/products',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier'),
  async (req, res, next) => {
    try {
      const search = req.query.search ? String(req.query.search).trim() : '';

      let query = req.supabase
        .from('products')
        .select(`
          id, name, sku, selling_price, stock_quantity, stock_threshold, image_url,
          categories(id, name)
        `)
        .eq('business_id', req.business.id)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(100);

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        selling_price: Number(p.selling_price),
        stock_quantity: p.stock_quantity,
        stock_threshold: p.stock_threshold,
        image_url: p.image_url,
        category_name: p.categories?.name || 'Uncategorized',
        in_stock: p.stock_quantity > 0
      }));

      return res.json({ success: true, data: formatted });
    } catch (error) {
      return next(error);
    }
  }
);

// POS Checkout: Atomic transactional sale execution via perform_checkout RPC
posRouter.post(
  '/checkout',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier'),
  async (req, res, next) => {
    try {
      const payload = checkoutSchema.parse(req.body);

      const { data, error } = await req.supabase.rpc('perform_checkout', {
        p_business_id: req.business.id,
        p_payment_method: payload.payment_method,
        p_amount_paid: payload.amount_paid,
        p_discount_total: payload.discount_total,
        p_tax_rate: payload.tax_rate,
        p_idempotency_key: payload.idempotency_key,
        p_items: payload.items,
        p_notes: payload.notes || null
      });

      if (error) {
        // Handle custom database error codes from plpgsql
        if (error.message.includes('INSUFFICIENT_STOCK')) {
          return next(new HttpError(400, 'INSUFFICIENT_STOCK', error.message.replace(/^.*INSUFFICIENT_STOCK:\s*/, '')));
        }
        if (error.message.includes('INSUFFICIENT_PAYMENT')) {
          return next(new HttpError(400, 'INSUFFICIENT_PAYMENT', error.message.replace(/^.*INSUFFICIENT_PAYMENT:\s*/, '')));
        }
        if (error.message.includes('PRODUCT_NOT_FOUND')) {
          return next(new HttpError(404, 'PRODUCT_NOT_FOUND', error.message));
        }
        return next(new HttpError(400, 'CHECKOUT_FAILED', error.message));
      }

      // Fetch sale items to return full receipt data
      const saleId = data.sale_id;
      const { data: saleData } = await req.supabase
        .from('sales')
        .select(`
          id, receipt_number, status, payment_method, subtotal, discount_total,
          tax_total, total, amount_paid, change_due, created_at,
          sale_items(id, product_id, product_name, sku, quantity, unit_price, line_total),
          user_profiles(display_name)
        `)
        .eq('id', saleId)
        .single();

      // Fetch business settings for receipt header/footer
      const { data: settings } = await req.supabase
        .from('business_settings')
        .select('*')
        .eq('business_id', req.business.id)
        .maybeSingle();

      const { data: biz } = await req.supabase
        .from('businesses')
        .select('name')
        .eq('id', req.business.id)
        .single();

      return res.status(201).json({
        success: true,
        data: {
          sale: saleData,
          business: {
            name: biz?.name || 'Kaafi Business',
            address: settings?.address || '',
            phone: settings?.contact_phone || '',
            email: settings?.contact_email || '',
            currency_code: settings?.currency_code || 'USD',
            receipt_footer: settings?.receipt_footer || 'Thank you for your business!'
          }
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);
