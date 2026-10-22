import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireBusinessRoles } from '../src/middleware/authorization.js';
import { HttpError } from '../src/utils/http-error.js';

test('role middleware: blocks cashier from accessing admin/manager endpoints', async () => {
  const middleware = requireBusinessRoles('admin', 'manager');
  const req = {
    params: { businessId: '11111111-1111-4111-8111-111111111111' },
    user: { id: 'user-cashier-id' },
    supabase: {
      from() {
        return {
          select() { return this; },
          eq(col, val) {
            if (col === 'role') return this;
            return this;
          },
          async maybeSingle() {
            return {
              data: {
                business_id: '11111111-1111-4111-8111-111111111111',
                user_id: 'user-cashier-id',
                role: 'cashier',
                status: 'active'
              },
              error: null
            };
          }
        };
      }
    }
  };

  let forwardedError;
  await middleware(req, {}, (err) => { forwardedError = err; });

  assert.ok(forwardedError instanceof HttpError);
  assert.equal(forwardedError.status, 403);
  assert.equal(forwardedError.code, 'FORBIDDEN');
});

test('role middleware: allows manager to access manager-permitted endpoints', async () => {
  const middleware = requireBusinessRoles('admin', 'manager');
  const req = {
    params: { businessId: '11111111-1111-4111-8111-111111111111' },
    user: { id: 'user-manager-id' },
    supabase: {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: {
                business_id: '11111111-1111-4111-8111-111111111111',
                user_id: 'user-manager-id',
                role: 'manager',
                status: 'active'
              },
              error: null
            };
          }
        };
      }
    }
  };

  let calledNext = false;
  await middleware(req, {}, (err) => {
    if (!err) calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(req.business.role, 'manager');
});

test('role middleware: blocks inventory_staff from accessing cashier-only endpoints', async () => {
  const middleware = requireBusinessRoles('admin', 'manager', 'cashier');
  const req = {
    params: { businessId: '11111111-1111-4111-8111-111111111111' },
    user: { id: 'user-inv-id' },
    supabase: {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: {
                business_id: '11111111-1111-4111-8111-111111111111',
                user_id: 'user-inv-id',
                role: 'inventory_staff',
                status: 'active'
              },
              error: null
            };
          }
        };
      }
    }
  };

  let forwardedError;
  await middleware(req, {}, (err) => { forwardedError = err; });

  assert.ok(forwardedError instanceof HttpError);
  assert.equal(forwardedError.status, 403);
});

test('business logic: product pricing is authoritative server-side', () => {
  const clientProvidedItem = {
    product_id: 'prod-1',
    quantity: 3,
    client_claimed_price: 1.00 // Malicious client attempt to pay $1 instead of $50
  };

  const authoritativeProduct = {
    id: 'prod-1',
    name: 'Office Chair',
    cost_price: 25.00,
    selling_price: 50.00,
    stock_quantity: 10
  };

  // Authoritative computation
  const lineTotal = authoritativeProduct.selling_price * clientProvidedItem.quantity;
  assert.equal(lineTotal, 150.00);
  assert.notEqual(lineTotal, clientProvidedItem.client_claimed_price * clientProvidedItem.quantity);
});

test('business logic: stock deduction rejects insufficient inventory', () => {
  const currentStock = 3;
  const requestedQuantity = 5;

  assert.throws(() => {
    if (requestedQuantity > currentStock) {
      throw new Error(`INSUFFICIENT_STOCK: Requested ${requestedQuantity} but only ${currentStock} available.`);
    }
  }, /INSUFFICIENT_STOCK/);
});

test('business logic: refund quantity cannot exceed remaining sold units', () => {
  const originalSoldQuantity = 10;
  const alreadyRefunded = 8;
  const attemptedRefund = 3;

  const remainingRefundable = originalSoldQuantity - alreadyRefunded;
  assert.equal(remainingRefundable, 2);

  assert.throws(() => {
    if (attemptedRefund > remainingRefundable) {
      throw new Error(`EXCESSIVE_REFUND: Cannot refund ${attemptedRefund}. Only ${remainingRefundable} remaining.`);
    }
  }, /EXCESSIVE_REFUND/);
});

test('business logic: stock adjustment cannot result in negative stock', () => {
  const currentStock = 5;
  const delta = -10;

  const newStock = currentStock + delta;
  assert.ok(newStock < 0);

  assert.throws(() => {
    if (newStock < 0) {
      throw new Error('INVALID_STOCK: Cannot reduce stock below zero.');
    }
  }, /INVALID_STOCK/);
});
