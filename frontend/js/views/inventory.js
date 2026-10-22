// Inventory Management View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const InventoryView = {
  currentPage: 1,
  limit: 20,
  movementType: '',
  allProducts: [],

  async render(mainContainer) {
    if (!State.activeBusiness) {
      mainContainer.innerHTML = `<div class="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">Please select an active business first.</div>`;
      return;
    }

    const businessId = State.activeBusiness.id;
    const currency = State.activeBusiness.currency_code || 'USD';

    mainContainer.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Inventory & Stock Control</h1>
            <p class="text-xs text-slate-500 mt-1">Audit movements, perform stock adjustments, and resolve stock alerts</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="adjustStockBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              <span>Record Stock Adjustment</span>
            </button>
          </div>
        </div>

        <!-- Alerts Section -->
        <div id="alertsBannerSection" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Out of stock card -->
          <div class="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span> Out of Stock (0 units)
              </span>
              <span id="outOfStockBadge" class="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">0</span>
            </div>
            <div id="outOfStockList" class="space-y-1.5 max-h-32 overflow-y-auto text-xs text-rose-900">
              <p class="text-slate-400 italic">No products are currently out of stock.</p>
            </div>
          </div>

          <!-- Low stock card -->
          <div class="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span> Low Stock (At or below threshold)
              </span>
              <span id="lowStockBadge" class="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">0</span>
            </div>
            <div id="lowStockList" class="space-y-1.5 max-h-32 overflow-y-auto text-xs text-amber-900">
              <p class="text-slate-400 italic">No products are running low.</p>
            </div>
          </div>
        </div>

        <!-- Stock Movements History Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Inventory Movement History</h2>
            <div class="flex items-center gap-2">
              <select id="movementTypeFilter" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500">
                <option value="">All Movement Types</option>
                <option value="sale">Sales</option>
                <option value="refund">Refunds</option>
                <option value="purchase_receipt">Purchase Receipts</option>
                <option value="adjustment">Manual Adjustments</option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3.5 px-6">Timestamp</th>
                  <th class="py-3.5 px-6">Product</th>
                  <th class="py-3.5 px-6">Activity Type</th>
                  <th class="py-3.5 px-6 text-center">Change</th>
                  <th class="py-3.5 px-6 text-right">Resulting Balance</th>
                  <th class="py-3.5 px-6">Reason / Reference</th>
                  <th class="py-3.5 px-6">Authorized Actor</th>
                </tr>
              </thead>
              <tbody id="inventoryMovementsTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="7" class="py-8 text-center text-slate-400">Loading stock audit log...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/30">
            <span id="invPaginationInfo">Showing 0 of 0 movements</span>
            <div class="flex items-center gap-1.5" id="invPaginationControls"></div>
          </div>
        </div>
      </div>
    `;

    mainContainer.querySelector('#adjustStockBtn').onclick = () => this.openAdjustmentModal(businessId);

    const typeFilter = mainContainer.querySelector('#movementTypeFilter');
    typeFilter.onchange = (e) => {
      this.movementType = e.target.value;
      this.currentPage = 1;
      this.loadMovements(businessId);
    };

    await Promise.all([
      this.loadAlerts(businessId),
      this.loadMovements(businessId),
      this.loadProductCatalog(businessId)
    ]);
  },

  async loadProductCatalog(businessId) {
    try {
      const res = await Api.get(`/businesses/${businessId}/products?limit=100`);
      if (res.success) {
        this.allProducts = res.data || [];
      }
    } catch {
      // Ignored
    }
  },

  async loadAlerts(businessId) {
    try {
      const res = await Api.get(`/businesses/${businessId}/inventory/alerts`);
      if (!res.success) return;

      const { out_of_stock, low_stock } = res.data;

      const outBadge = document.getElementById('outOfStockBadge');
      const outList = document.getElementById('outOfStockList');
      const lowBadge = document.getElementById('lowStockBadge');
      const lowList = document.getElementById('lowStockList');

      if (outBadge) outBadge.textContent = String(out_of_stock.length);
      if (lowBadge) lowBadge.textContent = String(low_stock.length);

      if (outList) {
        if (out_of_stock.length === 0) {
          outList.innerHTML = `<p class="text-slate-400 italic">All products currently have inventory.</p>`;
        } else {
          outList.innerHTML = '';
          out_of_stock.forEach(item => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between py-1 border-b border-rose-100 last:border-0';
            div.innerHTML = `
              <span class="font-bold truncate max-w-[200px]" title="${Config.escapeHtml(item.name)}">${Config.escapeHtml(item.name)}</span>
              <span class="font-mono text-rose-700 font-extrabold text-[11px]">0 units</span>
            `;
            outList.appendChild(div);
          });
        }
      }

      if (lowList) {
        if (low_stock.length === 0) {
          lowList.innerHTML = `<p class="text-slate-400 italic">No products are below minimum thresholds.</p>`;
        } else {
          lowList.innerHTML = '';
          low_stock.forEach(item => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between py-1 border-b border-amber-100 last:border-0';
            div.innerHTML = `
              <span class="font-bold truncate max-w-[200px]" title="${Config.escapeHtml(item.name)}">${Config.escapeHtml(item.name)}</span>
              <span class="font-mono text-amber-700 font-extrabold text-[11px]">${item.stock_quantity} / min ${item.stock_threshold}</span>
            `;
            lowList.appendChild(div);
          });
        }
      }
    } catch {
      // Ignored
    }
  },

  async loadMovements(businessId) {
    const tbody = document.getElementById('inventoryMovementsTbody');
    if (!tbody) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/inventory/movements`, {
        page: this.currentPage,
        limit: this.limit,
        type: this.movementType
      });

      if (!res.success) return;

      const movements = res.data || [];
      const pagination = res.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 };

      const info = document.getElementById('invPaginationInfo');
      if (info) {
        const start = movements.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
        const end = Math.min(start + movements.length - 1, pagination.total);
        info.textContent = `Showing ${start} to ${end} of ${pagination.total} movements`;
      }

      this.renderPaginationButtons(pagination, businessId);

      if (movements.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No stock movements found.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      movements.forEach(m => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/60 transition-colors';

        const isPos = m.quantity_delta > 0;
        let typeBadge = `<span class="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-slate-100 text-slate-700">${m.movement_type.replace('_', ' ')}</span>`;

        if (m.movement_type === 'sale') {
          typeBadge = `<span class="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-blue-50 text-blue-700">Sale</span>`;
        } else if (m.movement_type === 'refund') {
          typeBadge = `<span class="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-purple-50 text-purple-700">Refund</span>`;
        } else if (m.movement_type === 'purchase_receipt') {
          typeBadge = `<span class="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-emerald-50 text-emerald-700">Stock Received</span>`;
        } else if (m.movement_type === 'adjustment') {
          typeBadge = `<span class="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-amber-50 text-amber-700">Adjustment</span>`;
        }

        tr.innerHTML = `
          <td class="py-3 px-6 text-slate-500 font-mono text-[11px]">${Config.formatDateTime(m.created_at)}</td>
          <td class="py-3 px-6">
            <span class="font-bold text-slate-900 block">${Config.escapeHtml(m.product_name)}</span>
            <span class="font-mono text-slate-400 text-[10px]">${Config.escapeHtml(m.sku)}</span>
          </td>
          <td class="py-3 px-6">${typeBadge}</td>
          <td class="py-3 px-6 text-center font-bold font-mono ${isPos ? 'text-emerald-600' : 'text-rose-600'}">
            ${isPos ? `+${m.quantity_delta}` : m.quantity_delta}
          </td>
          <td class="py-3 px-6 text-right font-bold font-mono text-slate-900">${m.quantity_after}</td>
          <td class="py-3 px-6 text-slate-600 max-w-[200px] truncate" title="${Config.escapeHtml(m.reason)}">${Config.escapeHtml(m.reason || '—')}</td>
          <td class="py-3 px-6 font-medium text-slate-800">${Config.escapeHtml(m.actor_name || 'Staff')}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500">Failed to load movements.</td></tr>`;
    }
  },

  renderPaginationButtons(pagination, businessId) {
    const controls = document.getElementById('invPaginationControls');
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
      this.loadMovements(businessId);
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
      this.loadMovements(businessId);
    };
    controls.appendChild(btnNext);
  },

  openAdjustmentModal(businessId) {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <form id="stockAdjustForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Select Product *</label>
          <select id="adjProduct" required class="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500">
            <option value="">Select a product...</option>
            ${this.allProducts.map(p => `
              <option value="${p.id}" data-stock="${p.stock_quantity}">${Config.escapeHtml(p.name)} (${p.sku}) — Current: ${p.stock_quantity}</option>
            `).join('')}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Adjustment Type</label>
            <select id="adjDirection" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500">
              <option value="in">Stock-In (+ Add Stock)</option>
              <option value="out">Stock-Out (- Remove Stock)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Quantity Delta *</label>
            <input type="number" id="adjQuantity" required min="1" step="1" value="1" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Reason for Adjustment *</label>
          <input type="text" id="adjReason" required placeholder="e.g. Received shipment, Damaged goods, Stock audit discrepancy" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" id="btnCancelAdj" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
          <button type="submit" id="btnSubmitAdj" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
            Confirm Adjustment
          </button>
        </div>
      </form>
    `;

    Modal.open('Record Stock Adjustment', container, null, 'max-w-md');

    container.querySelector('#btnCancelAdj').onclick = () => Modal.close();

    container.querySelector('#stockAdjustForm').onsubmit = async (e) => {
      e.preventDefault();

      const productId = container.querySelector('#adjProduct').value;
      const direction = container.querySelector('#adjDirection').value;
      const qtyInput = parseInt(container.querySelector('#adjQuantity').value) || 0;
      const reason = container.querySelector('#adjReason').value.trim();

      if (!productId || qtyInput <= 0) {
        Toast.error('Please select a product and enter a valid quantity.');
        return;
      }

      const delta = direction === 'in' ? qtyInput : -qtyInput;

      const submitBtn = container.querySelector('#btnSubmitAdj');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adjusting...';

      try {
        const res = await Api.post(`/businesses/${businessId}/inventory/adjust`, {
          product_id: productId,
          quantity_delta: delta,
          reason: reason
        });

        if (res.success) {
          Toast.success(`Stock adjusted! New balance: ${res.data.new_stock}`);
          Modal.close();
          this.loadMovements(businessId);
          this.loadAlerts(businessId);
          this.loadProductCatalog(businessId);
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Adjustment';
      }
    };
  }
};
