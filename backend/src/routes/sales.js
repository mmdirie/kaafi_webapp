import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const salesRouter = Router({ mergeParams: true });

const refundSchema = z.object({
  idempotency_key: z.string().trim().min(1).max(200).default(() => `ref-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
  reason: z.string().trim().min(1).max(500),
  items: z.array(z.object({
    sale_item_id: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'At least one item must be selected for refund')
});

// List all sales
salesRouter.get(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const search = req.query.search ? String(req.query.search).trim() : '';
      const status = req.query.status ? String(req.query.status).trim() : '';
      const paymentMethod = req.query.paymentMethod ? String(req.query.paymentMethod).trim() : '';
      const cashierId = req.query.cashierId ? String(req.query.cashierId).trim() : '';
      const startDate = req.query.startDate ? String(req.query.startDate).trim() : '';
      const endDate = req.query.endDate ? String(req.query.endDate).trim() : '';

      let query = req.supabase
        .from('sales')
        .select(`
          id, receipt_number, status, payment_method, subtotal, discount_total,
          tax_total, total, amount_paid, change_due, created_at, cashier_id,
          user_profiles(display_name)
        `, { count: 'exact' })
        .eq('business_id', req.business.id)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('receipt_number', `%${search}%`);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (paymentMethod) {
        query = query.eq('payment_method', paymentMethod);
      }

      if (cashierId) {
        query = query.eq('cashier_id', cashierId);
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

      const formatted = (data || []).map(sale => ({
        ...sale,
        cashier_name: sale.user_profiles?.display_name || 'Cashier'
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

// Get single sale details with items and refunds
salesRouter.get(
  '/:saleId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier'),
  async (req, res, next) => {
    try {
      const saleId = z.string().uuid().parse(req.params.saleId);

      const { data: sale, error } = await req.supabase
        .from('sales')
        .select(`
          id, receipt_number, status, payment_method, subtotal, discount_total,
          tax_total, total, amount_paid, change_due, created_at, cashier_id,
          sale_items(id, product_id, product_name, sku, quantity, unit_cost, unit_price, line_total),
          refunds(id, total, reason, created_at, user_profiles(display_name), refund_items(id, sale_item_id, quantity, amount)),
          user_profiles(display_name)
        `)
        .eq('business_id', req.business.id)
        .eq('id', saleId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return next(new HttpError(404, 'SALE_NOT_FOUND', 'Sale not found.'));
        }
        return next(error);
      }

      // Calculate refunded quantities per sale item
      const refundedPerItem = {};
      (sale.refunds || []).forEach(r => {
        (r.refund_items || []).forEach(ri => {
          refundedPerItem[ri.sale_item_id] = (refundedPerItem[ri.sale_item_id] || 0) + ri.quantity;
        });
      });

      const items = (sale.sale_items || []).map(item => ({
        ...item,
        quantity_refunded: refundedPerItem[item.id] || 0,
        quantity_remaining: item.quantity - (refundedPerItem[item.id] || 0)
      }));

      // Get business settings for receipt display
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

      return res.json({
        success: true,
        data: {
          ...sale,
          cashier_name: sale.user_profiles?.display_name || 'Cashier',
          sale_items: items,
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

// Process Refund (admin, manager only)
salesRouter.post(
  '/:saleId/refund',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const saleId = z.string().uuid().parse(req.params.saleId);
      const payload = refundSchema.parse(req.body);

      const { data, error } = await req.supabase.rpc('perform_refund', {
        p_business_id: req.business.id,
        p_sale_id: saleId,
        p_idempotency_key: payload.idempotency_key,
        p_reason: payload.reason,
        p_items: payload.items
      });

      if (error) {
        if (error.message.includes('EXCESSIVE_REFUND')) {
          return next(new HttpError(400, 'EXCESSIVE_REFUND', error.message.replace(/^.*EXCESSIVE_REFUND:\s*/, '')));
        }
        if (error.message.includes('INVALID_SALE_STATUS')) {
          return next(new HttpError(400, 'INVALID_SALE_STATUS', error.message));
        }
        return next(new HttpError(400, 'REFUND_FAILED', error.message));
      }

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);
