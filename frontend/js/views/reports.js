// Financial Reporting & CSV Export View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';

export const ReportsView = {
  startDate: '',
  endDate: '',

  async render(mainContainer) {
    if (!State.activeBusiness) {
      mainContainer.innerHTML = `<div class="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">Please select an active business first.</div>`;
      return;
    }

    const businessId = State.activeBusiness.id;
    const currency = State.activeBusiness.currency_code || 'USD';

    mainContainer.innerHTML = `
      <div class="space-y-6">
        <!-- Header & CSV Export Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Financial Reports & Exports</h1>
            <p class="text-xs text-slate-500 mt-1">Income statement, gross profit analysis, and raw accounting data exports</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="exportSalesCsvBtn" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Sales CSV</span>
            </button>
            <button id="exportInventoryCsvBtn" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Inventory CSV</span>
            </button>
            <button id="exportExpensesCsvBtn" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Expenses CSV</span>
            </button>
          </div>
        </div>

        <!-- Period Selector -->
        <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Date Period:</span>
            <input type="date" id="repStartDate" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500" />
            <span class="text-slate-400 text-xs">to</span>
            <input type="date" id="repEndDate" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500" />
            <button id="repApplyDateBtn" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs">Filter</button>
          </div>
          <div class="flex items-center gap-1 text-xs">
            <button id="repPresetToday" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">Today</button>
            <button id="repPresetMonth" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">This Month</button>
            <button id="repPresetAll" class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold">All Time</button>
          </div>
        </div>

        <!-- Income Statement / P&L Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 max-w-4xl mx-auto space-y-6">
          <div class="text-center pb-4 border-b border-slate-100">
            <h2 class="text-lg font-black text-slate-900">Profit & Loss Statement (Income Statement)</h2>
            <p id="repPeriodSubtitle" class="text-xs text-slate-500 mt-1">All Recorded History</p>
          </div>

          <div class="space-y-6 text-sm">
            <!-- 1. Revenue -->
            <div>
              <div class="flex items-center justify-between font-bold text-slate-900 pb-2 border-b border-slate-200 text-xs uppercase tracking-wider">
                <span>1. Revenue & Sales</span>
                <span id="repGrossSales">$0.00</span>
              </div>
              <div class="py-2 space-y-1.5 text-xs text-slate-600 pl-4">
                <div class="flex justify-between">
                  <span>Gross Sales</span>
                  <span id="repGrossSalesSub">$0.00</span>
                </div>
                <div class="flex justify-between text-rose-600">
                  <span>Less: Discounts Awarded</span>
                  <span id="repDiscounts">-$0.00</span>
                </div>
                <div class="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Net Sales</span>
                  <span id="repNetSales">$0.00</span>
                </div>
              </div>
            </div>

            <!-- 2. COGS -->
            <div>
              <div class="flex items-center justify-between font-bold text-slate-900 pb-2 border-b border-slate-200 text-xs uppercase tracking-wider">
                <span>2. Cost of Goods Sold (COGS)</span>
                <span id="repCogs" class="text-rose-600">-$0.00</span>
              </div>
              <div class="py-2 text-xs text-slate-500 pl-4">
                <p>Direct wholesale inventory cost of items fulfilled during this period.</p>
              </div>
            </div>

            <!-- Gross Profit Highlight -->
            <div class="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <span class="text-sm font-black text-blue-900">Gross Profit</span>
                <p id="repGrossMarginPercent" class="text-xs text-blue-600 mt-0.5">Gross Margin: 0.0%</p>
              </div>
              <div id="repGrossProfit" class="text-2xl font-black text-blue-700">
                $0.00
              </div>
            </div>

            <!-- 3. Operating Expenses -->
            <div>
              <div class="flex items-center justify-between font-bold text-slate-900 pb-2 border-b border-slate-200 text-xs uppercase tracking-wider">
                <span>3. Operating Expenses</span>
                <span id="repTotalExpenses" class="text-rose-600">-$0.00</span>
              </div>
              <div id="repExpenseBreakdownList" class="py-2 space-y-1.5 text-xs text-slate-600 pl-4">
                <p class="text-slate-400 italic">No expenses recorded for this period.</p>
              </div>
            </div>

            <!-- Net Profit Highlight -->
            <div class="p-5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span class="text-base font-black text-emerald-950">Net Business Profit</span>
                <p id="repNetMarginPercent" class="text-xs text-emerald-700 mt-0.5">Net Margin: 0.0%</p>
              </div>
              <div id="repNetProfit" class="text-3xl font-black text-emerald-700">
                $0.00
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook export buttons
    mainContainer.querySelector('#exportSalesCsvBtn').onclick = () => this.downloadCsv(businessId, 'sales');
    mainContainer.querySelector('#exportInventoryCsvBtn').onclick = () => this.downloadCsv(businessId, 'inventory');
    mainContainer.querySelector('#exportExpensesCsvBtn').onclick = () => this.downloadCsv(businessId, 'expenses');

    // Preset buttons
    const startInput = mainContainer.querySelector('#repStartDate');
    const endInput = mainContainer.querySelector('#repEndDate');

    mainContainer.querySelector('#repPresetToday').onclick = () => {
      const today = new Date().toISOString().slice(0, 10);
      startInput.value = today;
      endInput.value = today;
      this.startDate = today;
      this.endDate = today;
      this.loadFinancialReport(businessId, currency);
    };

    mainContainer.querySelector('#repPresetMonth').onclick = () => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const today = d.toISOString().slice(0, 10);
      startInput.value = first;
      endInput.value = today;
      this.startDate = first;
      this.endDate = today;
      this.loadFinancialReport(businessId, currency);
    };

    mainContainer.querySelector('#repPresetAll').onclick = () => {
      startInput.value = '';
      endInput.value = '';
      this.startDate = '';
      this.endDate = '';
      this.loadFinancialReport(businessId, currency);
    };

    mainContainer.querySelector('#repApplyDateBtn').onclick = () => {
      this.startDate = startInput.value;
      this.endDate = endInput.value;
      this.loadFinancialReport(businessId, currency);
    };

    await this.loadFinancialReport(businessId, currency);
  },

  async loadFinancialReport(businessId, currency) {
    try {
      const res = await Api.get(`/businesses/${businessId}/reports/financial`, {
        startDate: this.startDate,
        endDate: this.endDate
      });

      if (!res.success) return;
      const data = res.data;

      // Update subtitle
      const sub = document.getElementById('repPeriodSubtitle');
      if (sub) {
        sub.textContent = `${data.period.startDate} to ${data.period.endDate}`;
      }

      // Update values
      document.getElementById('repGrossSales').textContent = Config.formatCurrency(data.revenue.gross_sales, currency);
      document.getElementById('repGrossSalesSub').textContent = Config.formatCurrency(data.revenue.gross_sales, currency);
      document.getElementById('repDiscounts').textContent = `-${Config.formatCurrency(data.revenue.discounts, currency)}`;
      document.getElementById('repNetSales').textContent = Config.formatCurrency(data.revenue.net_sales, currency);
      document.getElementById('repCogs').textContent = `-${Config.formatCurrency(data.cost_of_goods_sold, currency)}`;

      document.getElementById('repGrossProfit').textContent = Config.formatCurrency(data.gross_profit, currency);
      document.getElementById('repGrossMarginPercent').textContent = `Gross Margin: ${data.gross_margin_percent}%`;

      document.getElementById('repTotalExpenses').textContent = `-${Config.formatCurrency(data.total_expenses, currency)}`;

      // Breakdown list
      const expList = document.getElementById('repExpenseBreakdownList');
      if (expList) {
        const categories = Object.keys(data.expenses_by_category || {});
        if (categories.length === 0) {
          expList.innerHTML = `<p class="text-slate-400 italic">No expenses recorded for this period.</p>`;
        } else {
          expList.innerHTML = '';
          categories.forEach(cat => {
            const row = document.createElement('div');
            row.className = 'flex justify-between';
            row.innerHTML = `
              <span>${Config.escapeHtml(cat)}</span>
              <span>-${Config.formatCurrency(data.expenses_by_category[cat], currency)}</span>
            `;
            expList.appendChild(row);
          });
        }
      }

      document.getElementById('repNetProfit').textContent = Config.formatCurrency(data.net_profit, currency);
      document.getElementById('repNetMarginPercent').textContent = `Net Profit Margin: ${data.net_margin_percent}%`;
    } catch {
      Toast.error('Failed to load financial report.');
    }
  },

  async downloadCsv(businessId, type) {
    try {
      const res = await Api.get(`/businesses/${businessId}/reports/export-csv?type=${type}`);
      if (res.isBlob && res.blob) {
        const url = window.URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kaafi-${type}-export-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        Toast.success(`Exported ${type} to CSV.`);
      }
    } catch {
      Toast.error(`Failed to export ${type} data.`);
    }
  }
};
