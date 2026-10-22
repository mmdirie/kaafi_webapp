import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const purchasesRouter = Router({ mergeParams: true });

const createPurchaseSchema = z.object({
  supplier_id: z.string().uuid(),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity_ordered: z.number().int().min(1),
    unit_cost: z.number().min(0)
  })).min(1)
});

const receiveItemsSchema = z.object({
  idempotency_key: z.string().trim().min(1).max(200).default(() => `rcv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1)
});

const recordPaymentSchema = z.object({
  amount: z.number().min(0.01),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']),
  reference: z.string().trim().max(100).optional().nullable()
});

// List purchases
purchasesRouter.get(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const status = req.query.status ? String(req.query.status).trim() : '';
      const supplierId = req.query.supplierId ? String(req.query.supplierId).trim() : '';

      let query = req.supabase
        .from('purchases')
        .select(`
          id, purchase_number, supplier_id, status, payment_status,
          subtotal, notes, created_at, updated_at,
          suppliers(id, name, phone, email)
        `, { count: 'exact' })
        .eq('business_id', req.business.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) return next(error);

      const formatted = (data || []).map(p => ({
        ...p,
        supplier_name: p.suppliers?.name || 'Unknown'
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

// Get purchase details
purchasesRouter.get(
  '/:purchaseId',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const purchaseId = z.string().uuid().parse(req.params.purchaseId);

      const { data: purchase, error } = await req.supabase
        .from('purchases')
        .select(`
          id, purchase_number, supplier_id, status, payment_status,
          subtotal, notes, created_at, updated_at,
          suppliers(id, name, contact_name, phone, email),
          purchase_items(id, product_id, quantity_ordered, quantity_received, unit_cost, products(name, sku)),
          purchase_receipts(id, idempotency_key, created_at, user_profiles(display_name)),
          purchase_payments(id, amount, payment_method, reference, created_at, user_profiles(display_name))
        `)
        .eq('business_id', req.business.id)
        .eq('id', purchaseId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return next(new HttpError(404, 'PURCHASE_NOT_FOUND', 'Purchase order not found.'));
        }
        return next(error);
      }

      const items = (purchase.purchase_items || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || 'Product',
        sku: item.products?.sku || '',
        quantity_ordered: item.quantity_ordered,
        quantity_received: item.quantity_received,
        unit_cost: item.unit_cost,
        line_total: Number((item.quantity_ordered * item.unit_cost).toFixed(2))
      }));

      return res.json({
        success: true,
        data: {
          ...purchase,
          supplier_name: purchase.suppliers?.name || 'Unknown',
          purchase_items: items
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Create purchase order
purchasesRouter.post(
  '/',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const payload = createPurchaseSchema.parse(req.body);

      // Calculate total subtotal
      const subtotal = payload.items.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_cost), 0);
      const purchaseNumber = `PO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

      // Insert purchase
      const { data: purchase, error } = await req.supabase
        .from('purchases')
        .insert({
          business_id: req.business.id,
          supplier_id: payload.supplier_id,
          purchase_number: purchaseNumber,
          status: 'ordered',
          payment_status: 'unpaid',
          subtotal: Number(subtotal.toFixed(2)),
          notes: payload.notes || null,
          created_by: req.user.id
        })
        .select('*')
        .single();

      if (error) return next(error);

      // Insert purchase items
      const itemsToInsert = payload.items.map(item => ({
        business_id: req.business.id,
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_cost: item.unit_cost
      }));

      const { error: itemsError } = await req.supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsError) return next(itemsError);

      return res.status(201).json({ success: true, data: purchase });
    } catch (error) {
      return next(error);
    }
  }
);

// Receive stock for purchase order (Atomic transaction via RPC receive_purchase)
purchasesRouter.post(
  '/:purchaseId/receive',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'inventory_staff'),
  async (req, res, next) => {
    try {
      const purchaseId = z.string().uuid().parse(req.params.purchaseId);
      const payload = receiveItemsSchema.parse(req.body);

      const { data, error } = await req.supabase.rpc('receive_purchase', {
        p_business_id: req.business.id,
        p_purchase_id: purchaseId,
        p_idempotency_key: payload.idempotency_key,
        p_items: payload.items
      });

      if (error) {
        return next(new HttpError(400, 'RECEIVE_FAILED', error.message));
      }

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
);

// Record payment for purchase order
purchasesRouter.post(
  '/:purchaseId/payments',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const purchaseId = z.string().uuid().parse(req.params.purchaseId);
      const payload = recordPaymentSchema.parse(req.body);

      const { data: purchase, error: poError } = await req.supabase
        .from('purchases')
        .select('id, subtotal')
        .eq('business_id', req.business.id)
        .eq('id', purchaseId)
        .single();

      if (poError) return next(poError);

      const { data: payment, error } = await req.supabase
        .from('purchase_payments')
        .insert({
          business_id: req.business.id,
          purchase_id: purchaseId,
          amount: payload.amount,
          payment_method: payload.payment_method,
          reference: payload.reference || null,
          paid_by: req.user.id
        })
        .select('*')
        .single();

      if (error) return next(error);

      // Check total paid
      const { data: payments } = await req.supabase
        .from('purchase_payments')
        .select('amount')
        .eq('business_id', req.business.id)
        .eq('purchase_id', purchaseId);

      const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      let newPaymentStatus = 'unpaid';
      if (totalPaid >= purchase.subtotal) {
        newPaymentStatus = 'paid';
      } else if (totalPaid > 0) {
        newPaymentStatus = 'partially_paid';
      }

      await req.supabase
        .from('purchases')
        .update({ payment_status: newPaymentStatus, updated_at: new Date().toISOString() })
        .eq('id', purchaseId);

      return res.status(201).json({
        success: true,
        data: {
          payment,
          payment_status: newPaymentStatus,
          total_paid: totalPaid
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);
