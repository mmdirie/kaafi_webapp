// Sales & Receipts View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { PosView } from './pos.js';

export const SalesView = {
  currentPage: 1,
  limit: 20,
  searchQuery: '',
  statusFilter: '',
  paymentFilter: '',
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
      <div class="space-y-5">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Sales & Transactions</h1>
            <p class="text-xs text-slate-500 mt-1">Review receipts, issue customer refunds, and audit revenue</p>
          </div>
          <button id="newPosSaleBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Open POS Terminal</span>
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="lg:col-span-2 relative">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input type="text" id="salesSearchInput" placeholder="Search by receipt number..." class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500" />
          </div>

          <select id="salesStatusFilter" class="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="refunded">Fully Refunded</option>
          </select>

          <select id="salesPaymentFilter" class="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500">
            <option value="">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile_money">Mobile Money</option>
          </select>

          <div class="flex items-center gap-1.5">
            <input type="date" id="salesStartDate" class="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 focus:ring-2 focus:ring-blue-500" title="Start date" />
            <span class="text-slate-400 text-xs">to</span>
            <input type="date" id="salesEndDate" class="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 focus:ring-2 focus:ring-blue-500" title="End date" />
          </div>
        </div>

        <!-- Sales Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3.5 px-6">Receipt #</th>
                  <th class="py-3.5 px-6">Date & Time</th>
                  <th class="py-3.5 px-6">Cashier</th>
                  <th class="py-3.5 px-6">Payment</th>
                  <th class="py-3.5 px-6">Status</th>
                  <th class="py-3.5 px-6 text-right">Subtotal</th>
                  <th class="py-3.5 px-6 text-right">Total</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="salesTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="8" class="py-8 text-center text-slate-400">Loading sales history...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/30">
            <span id="salesPaginationInfo">Showing 0 of 0 sales</span>
            <div class="flex items-center gap-1.5" id="salesPaginationControls"></div>
          </div>
        </div>
      </div>
    `;

    mainContainer.querySelector('#newPosSaleBtn').onclick = () => State.setView('pos');

    const searchInput = mainContainer.querySelector('#salesSearchInput');
    const statusSelect = mainContainer.querySelector('#salesStatusFilter');
    const paySelect = mainContainer.querySelector('#salesPaymentFilter');
    const startInput = mainContainer.querySelector('#salesStartDate');
    const endInput = mainContainer.querySelector('#salesEndDate');

    let debounce;
    searchInput.oninput = (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.currentPage = 1;
        this.loadSales(businessId, currency);
      }, 300);
    };

    statusSelect.onchange = (e) => {
      this.statusFilter = e.target.value;
      this.currentPage = 1;
      this.loadSales(businessId, currency);
    };

    paySelect.onchange = (e) => {
      this.paymentFilter = e.target.value;
      this.currentPage = 1;
      this.loadSales(businessId, currency);
    };

    startInput.onchange = (e) => {
      this.startDate = e.target.value;
      this.currentPage = 1;
      this.loadSales(businessId, currency);
    };

    endInput.onchange = (e) => {
      this.endDate = e.target.value;
      this.currentPage = 1;
      this.loadSales(businessId, currency);
    };

    await this.loadSales(businessId, currency);
  },

  async loadSales(businessId, currency) {
    const tbody = document.getElementById('salesTbody');
    if (!tbody) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/sales`, {
        page: this.currentPage,
        limit: this.limit,
        search: this.searchQuery,
        status: this.statusFilter,
        paymentMethod: this.paymentFilter,
        startDate: this.startDate,
        endDate: this.endDate
      });

      if (!res.success) return;

      const sales = res.data || [];
      const pagination = res.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 };

      const info = document.getElementById('salesPaginationInfo');
      if (info) {
        const start = sales.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
        const end = Math.min(start + sales.length - 1, pagination.total);
        info.textContent = `Showing ${start} to ${end} of ${pagination.total} transactions`;
      }

      this.renderPaginationButtons(pagination, businessId, currency);

      if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No sales transactions found.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      sales.forEach(sale => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/60 transition-colors cursor-pointer';

        let statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase">Completed</span>`;
        if (sale.status === 'refunded') {
          statusBadge = `<span class="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] uppercase">Refunded</span>`;
        } else if (sale.status === 'partially_refunded') {
          statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] uppercase">Partial Refund</span>`;
        }

        tr.innerHTML = `
          <td class="py-3.5 px-6 font-mono font-bold text-blue-600">${Config.escapeHtml(sale.receipt_number)}</td>
          <td class="py-3.5 px-6 text-slate-500">${Config.formatDateTime(sale.created_at)}</td>
          <td class="py-3.5 px-6 font-medium">${Config.escapeHtml(sale.cashier_name)}</td>
          <td class="py-3.5 px-6 capitalize">${Config.escapeHtml(sale.payment_method.replace('_', ' '))}</td>
          <td class="py-3.5 px-6">${statusBadge}</td>
          <td class="py-3.5 px-6 text-right font-mono text-slate-500">${Config.formatCurrency(sale.subtotal, currency)}</td>
          <td class="py-3.5 px-6 text-right font-mono font-bold text-slate-900">${Config.formatCurrency(sale.total, currency)}</td>
          <td class="py-3.5 px-6 text-right space-x-1">
            <button class="btn-view-sale px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs">
              View
            </button>
          </td>
        `;

        tr.querySelector('.btn-view-sale').onclick = (e) => {
          e.stopPropagation();
          this.openSaleDetailsModal(sale.id, businessId, currency);
        };
        tr.onclick = () => this.openSaleDetailsModal(sale.id, businessId, currency);

        tbody.appendChild(tr);
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-rose-500">Failed to load sales.</td></tr>`;
    }
  },

  renderPaginationButtons(pagination, businessId, currency) {
    const controls = document.getElementById('salesPaginationControls');
    if (!controls) return;

    controls.innerHTML = '';
    const totalPages = pagination.total_pages || 1;

    const btnPrev = document.createElement('button');
    btnPrev.className = `px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold ${
      this.currentPage > 1 ? 'hover:bg-slate-50 text-slate-700' : 'opacity-40 cursor-not-allowed text-slate-400'
    }`;
    btnPrev.textContent = 'Prev';
    btnPrev.disabled = this.currentPage <= 1;
    btnPrev.onclick = () => {
      this.currentPage--;
      this.loadSales(businessId, currency);
    };
    controls.appendChild(btnPrev);

    const span = document.createElement('span');
    span.className = 'px-2 font-bold text-slate-700 text-xs';
    span.textContent = `${this.currentPage} / ${totalPages}`;
    controls.appendChild(span);

    const btnNext = document.createElement('button');
    btnNext.className = `px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold ${
      this.currentPage < totalPages ? 'hover:bg-slate-50 text-slate-700' : 'opacity-40 cursor-not-allowed text-slate-400'
    }`;
    btnNext.textContent = 'Next';
    btnNext.disabled = this.currentPage >= totalPages;
    btnNext.onclick = () => {
      this.currentPage++;
      this.loadSales(businessId, currency);
    };
    controls.appendChild(btnNext);
  },

  async openSaleDetailsModal(saleId, businessId, currency) {
    try {
      const res = await Api.get(`/businesses/${businessId}/sales/${saleId}`);
      if (!res.success) return;

      const sale = res.data;
      const canRefund = sale.status !== 'refunded' && ['admin', 'manager'].includes(State.activeBusiness.role);

      const container = document.createElement('div');
      container.className = 'space-y-4';

      container.innerHTML = `
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span class="text-slate-400 block">Receipt Number</span>
            <span class="font-bold text-slate-900 text-sm font-mono">${Config.escapeHtml(sale.receipt_number)}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Date</span>
            <span class="font-medium text-slate-800">${Config.formatDateTime(sale.created_at)}</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 block">Cashier</span>
            <span class="font-bold text-slate-800">${Config.escapeHtml(sale.cashier_name)}</span>
          </div>
        </div>

        <!-- Line items table -->
        <div>
          <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Purchased Items</h4>
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                <th class="py-2 px-3">Product</th>
                <th class="py-2 px-3 text-center">Qty</th>
                <th class="py-2 px-3 text-right">Price</th>
                <th class="py-2 px-3 text-right">Line Total</th>
                ${canRefund ? '<th class="py-2 px-3 text-center">Refundable</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${(sale.sale_items || []).map(item => `
                <tr>
                  <td class="py-2.5 px-3">
                    <span class="font-bold text-slate-900">${Config.escapeHtml(item.product_name)}</span>
                    <span class="font-mono text-slate-400 text-[10px] block">${Config.escapeHtml(item.sku)}</span>
                  </td>
                  <td class="py-2.5 px-3 text-center font-bold">${item.quantity}</td>
                  <td class="py-2.5 px-3 text-right font-mono">${Config.formatCurrency(item.unit_price, currency)}</td>
                  <td class="py-2.5 px-3 text-right font-mono font-bold">${Config.formatCurrency(item.line_total, currency)}</td>
                  ${canRefund ? `
                    <td class="py-2.5 px-3 text-center">
                      <span class="font-mono text-slate-600">${item.quantity_remaining} left</span>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Totals summary -->
        <div class="p-3 bg-slate-50/80 rounded-xl space-y-1 text-xs text-right">
          <div class="flex justify-between text-slate-500">
            <span>Subtotal:</span>
            <span>${Config.formatCurrency(sale.subtotal, currency)}</span>
          </div>
          ${Number(sale.discount_total) > 0 ? `
            <div class="flex justify-between text-rose-600">
              <span>Discount:</span>
              <span>-${Config.formatCurrency(sale.discount_total, currency)}</span>
            </div>
          ` : ''}
          ${Number(sale.tax_total) > 0 ? `
            <div class="flex justify-between text-slate-500">
              <span>Tax:</span>
              <span>${Config.formatCurrency(sale.tax_total, currency)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
            <span>Total:</span>
            <span>${Config.formatCurrency(sale.total, currency)}</span>
          </div>
        </div>

        <!-- Modal Action Buttons -->
        <div class="flex items-center justify-between gap-3 pt-2">
          <button type="button" id="btnReprintReceipt" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span>Print Receipt</span>
          </button>

          <div class="flex items-center gap-2">
            ${canRefund ? `
              <button type="button" id="btnStartRefund" class="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 border border-rose-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                <span>Process Refund</span>
              </button>
            ` : ''}
            <button type="button" id="btnCloseDetails" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs">
              Close
            </button>
          </div>
        </div>
      `;

      Modal.open('Sale Transaction Details', container, null, 'max-w-lg');

      container.querySelector('#btnReprintReceipt').onclick = () => {
        PosView.showReceiptModal(sale, sale.business, currency);
      };

      container.querySelector('#btnCloseDetails').onclick = () => Modal.close();

      const btnRefund = container.querySelector('#btnStartRefund');
      if (btnRefund) {
        btnRefund.onclick = () => {
          this.openRefundModal(sale, businessId, currency);
        };
      }
    } catch (err) {
      Toast.error('Failed to load transaction details.');
    }
  },

  openRefundModal(sale, businessId, currency) {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    const refundableItems = (sale.sale_items || []).filter(i => i.quantity_remaining > 0);

    if (refundableItems.length === 0) {
      Toast.info('All items on this transaction have already been refunded.');
      return;
    }

    container.innerHTML = `
      <form id="refundForm" class="space-y-4">
        <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
          <strong>Restock Notice:</strong> Refunding items will automatically restore product inventory balances and create an immutable audit record.
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Select Items & Quantities to Refund</label>
          <div class="space-y-2 max-h-56 overflow-y-auto">
            ${refundableItems.map(item => `
              <div class="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs gap-3">
                <div class="flex-1 min-w-0">
                  <span class="font-bold text-slate-800 block truncate">${Config.escapeHtml(item.product_name)}</span>
                  <span class="text-slate-400 font-mono text-[11px]">${Config.formatCurrency(item.unit_price, currency)} ea · Max ${item.quantity_remaining} left</span>
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-slate-400 text-[10px] uppercase font-bold">Qty:</label>
                  <input type="number" class="refund-qty-input w-16 px-2 py-1 rounded border border-slate-300 text-center font-bold text-xs" data-item-id="${item.id}" min="0" max="${item.quantity_remaining}" value="0" />
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Reason for Refund *</label>
          <input type="text" id="refundReasonInput" required placeholder="e.g. Customer returned defective unit, Wrong size..." class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500" />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" id="btnCancelRefund" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
          <button type="submit" id="btnConfirmRefund" class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow">
            Confirm & Restock
          </button>
        </div>
      </form>
    `;

    Modal.open('Process Refund', container, null, 'max-w-md');

    container.querySelector('#btnCancelRefund').onclick = () => Modal.close();

    container.querySelector('#refundForm').onsubmit = async (e) => {
      e.preventDefault();

      const itemsToRefund = [];
      container.querySelectorAll('.refund-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
          itemsToRefund.push({
            sale_item_id: input.dataset.itemId,
            quantity: qty
          });
        }
      });

      if (itemsToRefund.length === 0) {
        Toast.error('Please select at least 1 unit to refund.');
        return;
      }

      const reason = container.querySelector('#refundReasonInput').value.trim();
      const submitBtn = container.querySelector('#btnConfirmRefund');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing refund...';

      try {
        const res = await Api.post(`/businesses/${businessId}/sales/${sale.id}/refund`, {
          idempotency_key: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          reason,
          items: itemsToRefund
        });

        if (res.success) {
          Modal.close();
          Toast.success(`Refund processed! Total: ${Config.formatCurrency(res.data.total_refunded, currency)}`);
          this.loadSales(businessId, currency);
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm & Restock';
      }
    };
  }
};
