// Dashboard View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';

export const DashboardView = {
  chartInstance: null,

  async render(mainContainer) {
    if (!State.activeBusiness) {
      mainContainer.innerHTML = `
        <div class="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <p class="text-slate-500 font-medium">Please select or create a business to view the dashboard.</p>
        </div>
      `;
      return;
    }

    const businessId = State.activeBusiness.id;
    const currency = State.activeBusiness.currency_code || 'USD';

    mainContainer.innerHTML = `
      <div class="space-y-6">
        <!-- Top Banner & Quick Actions -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
            <p class="text-xs text-slate-500 mt-1">Live overview for <span class="font-bold text-slate-700">${Config.escapeHtml(State.activeBusiness.name)}</span></p>
          </div>
          <div class="flex items-center gap-3">
            <button id="refreshDashboardBtn" class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>Refresh Stats</span>
            </button>
            <button id="quickPosBtn" class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              <span>Open POS Register</span>
            </button>
          </div>
        </div>

        <!-- 4 Key Stat Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Card 1: Sales Today -->
          <div class="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Sales</span>
              <span class="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </span>
            </div>
            <div class="mt-3">
              <div id="statTodaySales" class="text-2xl font-black text-slate-900">...</div>
              <p id="statTodayCount" class="text-xs text-slate-500 mt-0.5">0 transactions today</p>
            </div>
          </div>

          <!-- Card 2: Monthly Sales -->
          <div class="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">This Month</span>
              <span class="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </span>
            </div>
            <div class="mt-3">
              <div id="statMonthSales" class="text-2xl font-black text-slate-900">...</div>
              <p id="statMonthCount" class="text-xs text-slate-500 mt-0.5">0 transactions</p>
            </div>
          </div>

          <!-- Card 3: Inventory Valuation -->
          <div class="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory Value</span>
              <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </span>
            </div>
            <div class="mt-3">
              <div id="statInventoryCost" class="text-2xl font-black text-slate-900">...</div>
              <p id="statInventoryRetail" class="text-xs text-slate-500 mt-0.5">Retail value: ...</p>
            </div>
          </div>

          <!-- Card 4: Low Stock Alerts -->
          <div class="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Stock Alerts</span>
              <span class="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </span>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <div id="statLowStock" class="text-2xl font-black text-amber-600">0</div>
              <span class="text-xs text-slate-500">low</span>
              <span class="text-slate-300">/</span>
              <div id="statOutOfStock" class="text-2xl font-black text-rose-600">0</div>
              <span class="text-xs text-slate-500">out of stock</span>
            </div>
            <p id="statTotalProducts" class="text-xs text-slate-400 mt-0.5">... products in catalog</p>
          </div>
        </div>

        <!-- Sales Chart & Best Sellers -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- 7-Day Sales Chart -->
          <div class="lg:col-span-2 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">7-Day Sales Trend</h2>
              <span class="text-xs text-slate-400 font-medium">Daily Revenue</span>
            </div>
            <div class="h-64 relative">
              <canvas id="salesTrendChart"></canvas>
            </div>
          </div>

          <!-- Top Selling Products -->
          <div class="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Best Sellers</h2>
                <span class="text-xs text-slate-400">By Units Sold</span>
              </div>
              <div id="topProductsList" class="space-y-3">
                <p class="text-xs text-slate-400 py-4 text-center">Loading best sellers...</p>
              </div>
            </div>
            <button id="viewAllProductsBtn" class="mt-4 w-full py-2 text-center text-xs font-semibold text-blue-600 hover:text-blue-800 border-t border-slate-100">
              View All Products &rarr;
            </button>
          </div>
        </div>

        <!-- Recent Sales Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Transactions</h2>
            <button id="viewAllSalesBtn" class="text-xs font-semibold text-blue-600 hover:text-blue-800">
              View All &rarr;
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3 px-6">Receipt #</th>
                  <th class="py-3 px-6">Date & Time</th>
                  <th class="py-3 px-6">Cashier</th>
                  <th class="py-3 px-6">Payment</th>
                  <th class="py-3 px-6">Status</th>
                  <th class="py-3 px-6 text-right">Total</th>
                </tr>
              </thead>
              <tbody id="recentSalesTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="6" class="py-6 text-center text-slate-400">Loading recent transactions...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Button event listeners
    mainContainer.querySelector('#refreshDashboardBtn').onclick = () => this.loadData(businessId, currency);
    mainContainer.querySelector('#quickPosBtn').onclick = () => State.setView('pos');
    mainContainer.querySelector('#viewAllProductsBtn').onclick = () => State.setView('products');
    mainContainer.querySelector('#viewAllSalesBtn').onclick = () => State.setView('sales');

    await this.loadData(businessId, currency);
  },

  async loadData(businessId, currency) {
    try {
      const res = await Api.get(`/businesses/${businessId}/reports/dashboard`);
      if (!res.success) return;

      const data = res.data;

      // Update stat cards
      const elToday = document.getElementById('statTodaySales');
      const elTodayCount = document.getElementById('statTodayCount');
      const elMonth = document.getElementById('statMonthSales');
      const elMonthCount = document.getElementById('statMonthCount');
      const elInvCost = document.getElementById('statInventoryCost');
      const elInvRetail = document.getElementById('statInventoryRetail');
      const elLow = document.getElementById('statLowStock');
      const elOut = document.getElementById('statOutOfStock');
      const elTotalProd = document.getElementById('statTotalProducts');

      if (elToday) elToday.textContent = Config.formatCurrency(data.today_sales, currency);
      if (elTodayCount) elTodayCount.textContent = `${data.today_sales_count} transactions today`;
      if (elMonth) elMonth.textContent = Config.formatCurrency(data.month_sales, currency);
      if (elMonthCount) elMonthCount.textContent = `${data.month_sales_count} transactions this month`;
      if (elInvCost) elInvCost.textContent = Config.formatCurrency(data.inventory_value_cost, currency);
      if (elInvRetail) elInvRetail.textContent = `Retail value: ${Config.formatCurrency(data.inventory_value_retail, currency)}`;
      if (elLow) elLow.textContent = data.low_stock_count;
      if (elOut) elOut.textContent = data.out_of_stock_count;
      if (elTotalProd) elTotalProd.textContent = `${data.total_products} products (${data.active_products} active)`;

      // Render chart
      this.renderChart(data.sales_chart_7days || []);

      // Render top products
      const topList = document.getElementById('topProductsList');
      if (topList) {
        if (!data.top_selling_products || data.top_selling_products.length === 0) {
          topList.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">No sales recorded yet.</p>`;
        } else {
          topList.innerHTML = '';
          data.top_selling_products.forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between text-xs';
            item.innerHTML = `
              <div class="flex items-center gap-2 overflow-hidden">
                <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-[10px] flex-shrink-0">${idx + 1}</span>
                <span class="font-medium text-slate-800 truncate" title="${Config.escapeHtml(p.product_name)}">${Config.escapeHtml(p.product_name)}</span>
              </div>
              <div class="text-right flex-shrink-0">
                <span class="font-bold text-slate-900">${p.units_sold} sold</span>
                <span class="text-slate-400 block text-[10px]">${Config.formatCurrency(p.total_revenue, currency)}</span>
              </div>
            `;
            topList.appendChild(item);
          });
        }
      }

      // Render recent sales
      const tbody = document.getElementById('recentSalesTbody');
      if (tbody) {
        if (!data.recent_sales || data.recent_sales.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">No transactions recorded yet.</td></tr>`;
        } else {
          tbody.innerHTML = '';
          data.recent_sales.forEach(sale => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/50 transition-colors cursor-pointer';
            tr.onclick = () => {
              State.setView('sales');
            };

            let statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">Completed</span>';
            if (sale.status === 'refunded') {
              statusBadge = '<span class="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-[10px]">Refunded</span>';
            } else if (sale.status === 'partially_refunded') {
              statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px]">Partial Refund</span>';
            }

            tr.innerHTML = `
              <td class="py-3 px-6 font-mono font-medium text-blue-600">${Config.escapeHtml(sale.receipt_number)}</td>
              <td class="py-3 px-6 text-slate-500">${Config.formatDateTime(sale.created_at)}</td>
              <td class="py-3 px-6 font-medium">${Config.escapeHtml(sale.cashier_name || 'Staff')}</td>
              <td class="py-3 px-6 capitalize">${Config.escapeHtml(sale.payment_method.replace('_', ' '))}</td>
              <td class="py-3 px-6">${statusBadge}</td>
              <td class="py-3 px-6 text-right font-bold text-slate-900">${Config.formatCurrency(sale.total, currency)}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    } catch (err) {
      Toast.error('Failed to load dashboard metrics');
    }
  },

  renderChart(chartData) {
    const canvas = document.getElementById('salesTrendChart');
    if (!canvas || !window.Chart) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const labels = chartData.map(d => d.short_label || d.date_label);
    const totals = chartData.map(d => Number(d.daily_total) || 0);

    const ctx = canvas.getContext('2d');
    this.chartInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        datasets: [{
          label: 'Revenue',
          data: totals.length > 0 ? totals : [0, 0, 0, 0, 0, 0, 0],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` Revenue: $${context.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => `$${val}`
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }
};
