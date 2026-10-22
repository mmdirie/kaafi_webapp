import { Router } from 'express';
import { requireAuth } from '../config/auth-middleware.js';
import { requireBusinessRoles } from '../middleware/authorization.js';
import { HttpError } from '../utils/http-error.js';

export const reportsRouter = Router({ mergeParams: true });

// Dashboard stats: queries database directly or via get_business_dashboard_stats RPC
reportsRouter.get(
  '/dashboard',
  requireAuth,
  requireBusinessRoles('admin', 'manager', 'cashier', 'inventory_staff'),
  async (req, res, next) => {
    try {
      // Try stored procedure first
      const { data, error } = await req.supabase.rpc('get_business_dashboard_stats', {
        p_business_id: req.business.id
      });

      if (!error && data) {
        return res.json({ success: true, data });
      }

      // Fallback query if RPC is not loaded or during migration
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Today sales
      const { data: todaySales } = await req.supabase
        .from('sales')
        .select('total')
        .eq('business_id', req.business.id)
        .in('status', ['completed', 'partially_refunded'])
        .gte('created_at', startOfDay);

      // Month sales
      const { data: monthSales } = await req.supabase
        .from('sales')
        .select('total')
        .eq('business_id', req.business.id)
        .in('status', ['completed', 'partially_refunded'])
        .gte('created_at', startOfMonth);

      // All sales
      const { data: allSales } = await req.supabase
        .from('sales')
        .select('total')
        .eq('business_id', req.business.id)
        .in('status', ['completed', 'partially_refunded']);

      // Products
      const { data: products } = await req.supabase
        .from('products')
        .select('id, stock_quantity, stock_threshold, cost_price, selling_price, is_active')
        .eq('business_id', req.business.id);

      const activeProducts = (products || []).filter(p => p.is_active);
      const lowStockCount = activeProducts.filter(p => p.stock_quantity <= p.stock_threshold && p.stock_quantity > 0).length;
      const outOfStockCount = activeProducts.filter(p => p.stock_quantity === 0).length;
      const inventoryValueCost = activeProducts.reduce((sum, p) => sum + (p.stock_quantity * Number(p.cost_price)), 0);
      const inventoryValueRetail = activeProducts.reduce((sum, p) => sum + (p.stock_quantity * Number(p.selling_price)), 0);

      // Recent sales
      const { data: recentSales } = await req.supabase
        .from('sales')
        .select('id, receipt_number, total, payment_method, status, created_at, user_profiles(display_name)')
        .eq('business_id', req.business.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const stats = {
        today_sales: (todaySales || []).reduce((sum, s) => sum + Number(s.total), 0),
        today_sales_count: (todaySales || []).length,
        month_sales: (monthSales || []).reduce((sum, s) => sum + Number(s.total), 0),
        month_sales_count: (monthSales || []).length,
        total_revenue: (allSales || []).reduce((sum, s) => sum + Number(s.total), 0),
        total_products: (products || []).length,
        active_products: activeProducts.length,
        inventory_value_cost: inventoryValueCost,
        inventory_value_retail: inventoryValueRetail,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        recent_sales: (recentSales || []).map(s => ({
          ...s,
          cashier_name: s.user_profiles?.display_name || 'Cashier'
        })),
        top_selling_products: [],
        sales_chart_7days: []
      };

      return res.json({ success: true, data: stats });
    } catch (error) {
      return next(error);
    }
  }
);

// Financial Profit & Loss Report: Revenue, COGS, Expenses, Gross Profit, Net Profit
reportsRouter.get(
  '/financial',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const startDate = req.query.startDate ? String(req.query.startDate).trim() : '';
      const endDate = req.query.endDate ? String(req.query.endDate).trim() : '';

      // 1. Fetch sales in date range
      let salesQuery = req.supabase
        .from('sales')
        .select('id, subtotal, discount_total, tax_total, total, created_at')
        .eq('business_id', req.business.id)
        .in('status', ['completed', 'partially_refunded']);

      if (startDate) salesQuery = salesQuery.gte('created_at', new Date(startDate).toISOString());
      if (endDate) {
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        salesQuery = salesQuery.lt('created_at', nextDay.toISOString());
      }

      const { data: sales, error: salesErr } = await salesQuery;
      if (salesErr) return next(salesErr);

      const totalRevenue = (sales || []).reduce((sum, s) => sum + Number(s.total), 0);
      const totalTax = (sales || []).reduce((sum, s) => sum + Number(s.tax_total), 0);
      const totalDiscount = (sales || []).reduce((sum, s) => sum + Number(s.discount_total), 0);
      const netSales = (sales || []).reduce((sum, s) => sum + Number(s.subtotal) - Number(s.discount_total), 0);

      // 2. Fetch sale items to calculate COGS (Cost of Goods Sold)
      const saleIds = (sales || []).map(s => s.id);
      let totalCogs = 0;

      if (saleIds.length > 0) {
        const { data: saleItems } = await req.supabase
          .from('sale_items')
          .select('unit_cost, quantity')
          .eq('business_id', req.business.id)
          .in('sale_id', saleIds);

        totalCogs = (saleItems || []).reduce((sum, item) => sum + (Number(item.unit_cost) * item.quantity), 0);
      }

      // 3. Fetch expenses in date range
      let expenseQuery = req.supabase
        .from('expenses')
        .select('id, category, amount, expense_date')
        .eq('business_id', req.business.id);

      if (startDate) expenseQuery = expenseQuery.gte('expense_date', startDate);
      if (endDate) expenseQuery = expenseQuery.lte('expense_date', endDate);

      const { data: expenses, error: expErr } = await expenseQuery;
      if (expErr) return next(expErr);

      const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

      // Expenses by category
      const expensesByCategory = {};
      (expenses || []).forEach(e => {
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
      });

      // 4. Calculate Gross Profit and Net Profit
      const grossProfit = Number((netSales - totalCogs).toFixed(2));
      const netProfit = Number((grossProfit - totalExpenses).toFixed(2));
      const grossMarginPercent = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0;
      const netMarginPercent = netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(1)) : 0;

      return res.json({
        success: true,
        data: {
          period: {
            startDate: startDate || 'All Time',
            endDate: endDate || 'Present'
          },
          revenue: {
            gross_sales: Number(totalRevenue.toFixed(2)),
            discounts: Number(totalDiscount.toFixed(2)),
            net_sales: Number(netSales.toFixed(2)),
            tax_collected: Number(totalTax.toFixed(2))
          },
          cost_of_goods_sold: Number(totalCogs.toFixed(2)),
          gross_profit: grossProfit,
          gross_margin_percent: grossMarginPercent,
          total_expenses: Number(totalExpenses.toFixed(2)),
          expenses_by_category: expensesByCategory,
          net_profit: netProfit,
          net_margin_percent: netMarginPercent
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Export CSV for Sales, Inventory, or Expenses
reportsRouter.get(
  '/export-csv',
  requireAuth,
  requireBusinessRoles('admin', 'manager'),
  async (req, res, next) => {
    try {
      const type = req.query.type; // 'sales', 'inventory', 'expenses'

      if (type === 'sales') {
        const { data: sales, error } = await req.supabase
          .from('sales')
          .select('receipt_number, created_at, status, payment_method, subtotal, discount_total, tax_total, total')
          .eq('business_id', req.business.id)
          .order('created_at', { ascending: false });

        if (error) return next(error);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="sales-export-${Date.now()}.csv"`);

        let csv = 'Receipt Number,Date,Status,Payment Method,Subtotal,Discount,Tax,Total\r\n';
        for (const s of sales || []) {
          csv += `"${s.receipt_number}","${s.created_at}","${s.status}","${s.payment_method}",${s.subtotal},${s.discount_total},${s.tax_total},${s.total}\r\n`;
        }
        return res.send(csv);
      }

      if (type === 'inventory') {
        const { data: products, error } = await req.supabase
          .from('products')
          .select('name, sku, cost_price, selling_price, stock_quantity, stock_threshold, is_active, categories(name)')
          .eq('business_id', req.business.id)
          .order('name', { ascending: true });

        if (error) return next(error);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="inventory-export-${Date.now()}.csv"`);

        let csv = 'Product Name,SKU,Category,Cost Price,Selling Price,Stock Quantity,Threshold,Status\r\n';
        for (const p of products || []) {
          csv += `"${p.name.replace(/"/g, '""')}","${p.sku}","${p.categories?.name || 'Uncategorized'}",${p.cost_price},${p.selling_price},${p.stock_quantity},${p.stock_threshold},"${p.is_active ? 'Active' : 'Inactive'}"\r\n`;
        }
        return res.send(csv);
      }

      if (type === 'expenses') {
        const { data: expenses, error } = await req.supabase
          .from('expenses')
          .select('category, description, amount, expense_date, created_at')
          .eq('business_id', req.business.id)
          .order('expense_date', { ascending: false });

        if (error) return next(error);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="expenses-export-${Date.now()}.csv"`);

        let csv = 'Date,Category,Description,Amount\r\n';
        for (const e of expenses || []) {
          csv += `"${e.expense_date}","${e.category.replace(/"/g, '""')}","${e.description.replace(/"/g, '""')}",${e.amount}\r\n`;
        }
        return res.send(csv);
      }

      return next(new HttpError(400, 'INVALID_EXPORT_TYPE', 'Type must be sales, inventory, or expenses'));
    } catch (error) {
      return next(error);
    }
  }
);
