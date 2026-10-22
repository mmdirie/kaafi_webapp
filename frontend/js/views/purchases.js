// Purchases & Purchase Orders View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const PurchasesView = {
  currentPage: 1,
  limit: 20,
  suppliers: [],
  products: [],

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
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Purchases & Receiving</h1>
            <p class="text-xs text-slate-500 mt-1">Order inventory from suppliers and receive stock deliveries safely</p>
          </div>
          <button id="newPurchaseOrderBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Create Purchase Order</span>
          </button>
        </div>

        <!-- Purchases Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3.5 px-6">PO Number</th>
                  <th class="py-3.5 px-6">Supplier</th>
                  <th class="py-3.5 px-6">Order Date</th>
                  <th class="py-3.5 px-6">Receiving Status</th>
                  <th class="py-3.5 px-6">Payment Status</th>
                  <th class="py-3.5 px-6 text-right">Order Total</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="purchasesTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="7" class="py-8 text-center text-slate-400">Loading purchase orders...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    mainContainer.querySelector('#newPurchaseOrderBtn').onclick = () => this.openCreatePoModal(businessId, currency);

    await Promise.all([
      this.loadDependencies(businessId),
      this.loadPurchases(businessId, currency)
    ]);
  },

  async loadDependencies(businessId) {
    try {
      const [supRes, prodRes] = await Promise.all([
        Api.get(`/businesses/${businessId}/suppliers`),
        Api.get(`/businesses/${businessId}/products?limit=100`)
      ]);
      if (supRes.success) this.suppliers = supRes.data || [];
      if (prodRes.success) this.products = prodRes.data || [];
    } catch {
      // Ignored
    }
  },

  async loadPurchases(businessId, currency) {
    const tbody = document.getElementById('purchasesTbody');
    if (!tbody) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/purchases`, {
        page: this.currentPage,
        limit: this.limit
      });

      if (!res.success) return;

      const purchases = res.data || [];
      if (purchases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No purchase orders found.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      purchases.forEach(po => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/60 transition-colors';

        let statusBadge = `<span class="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase bg-amber-50 text-amber-700">Ordered</span>`;
        if (po.status === 'received') {
          statusBadge = `<span class="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase bg-emerald-50 text-emerald-700">Received</span>`;
        } else if (po.status === 'partially_received') {
          statusBadge = `<span class="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase bg-blue-50 text-blue-700">Partially Received</span>`;
        }

        let payBadge = `<span class="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase bg-rose-50 text-rose-700">Unpaid</span>`;
        if (po.payment_status === 'paid') {
          payBadge = `<span class="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase bg-emerald-50 text-emerald-700">Paid</span>`;
        } else if (po.payment_status === 'partially_paid') {
          payBadge = `<span class="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase bg-amber-50 text-amber-700">Partial</span>`;
        }

        tr.innerHTML = `
          <td class="py-3.5 px-6 font-mono font-bold text-blue-600">${Config.escapeHtml(po.purchase_number)}</td>
          <td class="py-3.5 px-6 font-bold text-slate-900">${Config.escapeHtml(po.supplier_name)}</td>
          <td class="py-3.5 px-6 text-slate-500">${Config.formatDate(po.created_at)}</td>
          <td class="py-3.5 px-6">${statusBadge}</td>
          <td class="py-3.5 px-6">${payBadge}</td>
          <td class="py-3.5 px-6 text-right font-mono font-bold text-slate-900">${Config.formatCurrency(po.subtotal, currency)}</td>
          <td class="py-3.5 px-6 text-right space-x-1">
            <button class="btn-view-po px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs">
              Manage & Receive
            </button>
          </td>
        `;

        tr.querySelector('.btn-view-po').onclick = () => {
          this.openPoDetailsModal(po.id, businessId, currency);
        };

        tbody.appendChild(tr);
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500">Failed to load purchases.</td></tr>`;
    }
  },

  openCreatePoModal(businessId, currency) {
    if (this.suppliers.length === 0) {
      Toast.warning('Please create at least one supplier before creating purchase orders.');
      State.setView('suppliers');
      return;
    }

    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <form id="createPoForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Select Supplier *</label>
          <select id="poSupplier" required class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500">
            ${this.suppliers.map(s => `
              <option value="${s.id}">${Config.escapeHtml(s.name)}</option>
            `).join('')}
          </select>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider">Order Items</label>
            <button type="button" id="btnAddPoItem" class="text-xs font-bold text-blue-600 hover:text-blue-800">+ Add Product Row</button>
          </div>
          <div id="poItemsRows" class="space-y-2 max-h-56 overflow-y-auto">
            <!-- Dynamic rows -->
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Purchase Notes</label>
          <textarea id="poNotes" rows="2" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="Delivery instructions, batch references..."></textarea>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-200">
          <div>
            <span class="text-xs text-slate-400">Total Estimate:</span>
            <span id="poTotalEstimate" class="font-bold text-slate-900 text-sm ml-1">${Config.formatCurrency(0, currency)}</span>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="btnCancelPo" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
            <button type="submit" id="btnSubmitPo" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
              Create PO
            </button>
          </div>
        </div>
      </form>
    `;

    Modal.open('New Purchase Order', container, null, 'max-w-lg');

    const itemsContainer = container.querySelector('#poItemsRows');
    const totalEstimate = container.querySelector('#poTotalEstimate');

    const updateEstimate = () => {
      let total = 0;
      itemsContainer.querySelectorAll('.po-item-row').forEach(row => {
        const qty = parseInt(row.querySelector('.row-qty').value) || 0;
        const cost = parseFloat(row.querySelector('.row-cost').value) || 0;
        total += (qty * cost);
      });
      totalEstimate.textContent = Config.formatCurrency(total, currency);
    };

    const addRow = () => {
      const row = document.createElement('div');
      row.className = 'po-item-row flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs';
      row.innerHTML = `
        <select class="row-prod flex-1 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500" required>
          <option value="">Select Product...</option>
          ${this.products.map(p => `
            <option value="${p.id}" data-cost="${p.cost_price}">${Config.escapeHtml(p.name)} (${p.sku})</option>
          `).join('')}
        </select>
        <input type="number" min="1" value="10" placeholder="Qty" class="row-qty w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-center font-bold text-xs" required />
        <input type="number" min="0" step="0.01" value="0.00" placeholder="Cost" class="row-cost w-20 px-2 py-1.5 rounded-lg border border-slate-300 text-right font-mono text-xs" required />
        <button type="button" class="btn-del-row text-slate-400 hover:text-rose-600 px-1 font-bold">&times;</button>
      `;

      row.querySelector('.row-prod').onchange = (e) => {
        const sel = e.target.selectedOptions[0];
        if (sel && sel.dataset.cost) {
          row.querySelector('.row-cost').value = sel.dataset.cost;
        }
        updateEstimate();
      };

      row.querySelector('.row-qty').oninput = updateEstimate;
      row.querySelector('.row-cost').oninput = updateEstimate;
      row.querySelector('.btn-del-row').onclick = () => {
        row.remove();
        updateEstimate();
      };

      itemsContainer.appendChild(row);
      updateEstimate();
    };

    // Add first row by default
    addRow();

    container.querySelector('#btnAddPoItem').onclick = addRow;
    container.querySelector('#btnCancelPo').onclick = () => Modal.close();

    container.querySelector('#createPoForm').onsubmit = async (e) => {
      e.preventDefault();

      const items = [];
      itemsContainer.querySelectorAll('.po-item-row').forEach(row => {
        const prodId = row.querySelector('.row-prod').value;
        const qty = parseInt(row.querySelector('.row-qty').value) || 0;
        const cost = parseFloat(row.querySelector('.row-cost').value) || 0;
        if (prodId && qty > 0) {
          items.push({
            product_id: prodId,
            quantity_ordered: qty,
            unit_cost: cost
          });
        }
      });

      if (items.length === 0) {
        Toast.error('Please add at least one valid product row.');
        return;
      }

      const payload = {
        supplier_id: container.querySelector('#poSupplier').value,
        notes: container.querySelector('#poNotes').value.trim() || null,
        items
      };

      try {
        await Api.post(`/businesses/${businessId}/purchases`, payload);
        Toast.success('Purchase order created successfully!');
        Modal.close();
        this.loadPurchases(businessId, currency);
      } catch {
        // Handled by api error toast
      }
    };
  },

  async openPoDetailsModal(poId, businessId, currency) {
    try {
      const res = await Api.get(`/businesses/${businessId}/purchases/${poId}`);
      if (!res.success) return;

      const po = res.data;
      const canReceive = po.status !== 'received' && po.status !== 'cancelled';

      const container = document.createElement('div');
      container.className = 'space-y-4';

      container.innerHTML = `
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span class="text-slate-400 block font-mono">PO Number</span>
            <span class="font-bold text-slate-900 text-sm font-mono">${Config.escapeHtml(po.purchase_number)}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Supplier</span>
            <span class="font-bold text-slate-900">${Config.escapeHtml(po.supplier_name)}</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 block">Total Cost</span>
            <span class="font-bold text-slate-900 text-sm font-mono">${Config.formatCurrency(po.subtotal, currency)}</span>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ordered Items & Received Counts</h4>
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                <th class="py-2 px-3">Product</th>
                <th class="py-2 px-3 text-center">Ordered</th>
                <th class="py-2 px-3 text-center">Received</th>
                <th class="py-2 px-3 text-right">Unit Cost</th>
                ${canReceive ? '<th class="py-2 px-3 text-center">Receive Now</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${(po.purchase_items || []).map(item => {
                const remaining = item.quantity_ordered - item.quantity_received;
                return `
                  <tr>
                    <td class="py-2.5 px-3">
                      <span class="font-bold text-slate-900">${Config.escapeHtml(item.product_name)}</span>
                      <span class="font-mono text-slate-400 text-[10px] block">${Config.escapeHtml(item.sku)}</span>
                    </td>
                    <td class="py-2.5 px-3 text-center font-bold">${item.quantity_ordered}</td>
                    <td class="py-2.5 px-3 text-center font-bold ${item.quantity_received >= item.quantity_ordered ? 'text-emerald-600' : 'text-amber-600'}">
                      ${item.quantity_received}
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono">${Config.formatCurrency(item.unit_cost, currency)}</td>
                    ${canReceive ? `
                      <td class="py-2.5 px-3 text-center">
                        <input type="number" class="receive-qty-input w-16 px-2 py-1 rounded border border-slate-300 text-center font-bold text-xs" data-prod-id="${item.product_id}" min="0" max="${remaining}" value="${remaining}" />
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" id="btnClosePo" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs">Close</button>
          ${canReceive ? `
            <button type="button" id="btnConfirmReceive" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow">
              Confirm Receipt & Update Stock
            </button>
          ` : ''}
        </div>
      `;

      Modal.open('Purchase Order Details & Receiving', container, null, 'max-w-lg');

      container.querySelector('#btnClosePo').onclick = () => Modal.close();

      const btnReceive = container.querySelector('#btnConfirmReceive');
      if (btnReceive) {
        btnReceive.onclick = async () => {
          const itemsToReceive = [];
          container.querySelectorAll('.receive-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
              itemsToReceive.push({
                product_id: input.dataset.prodId,
                quantity: qty
              });
            }
          });

          if (itemsToReceive.length === 0) {
            Toast.error('Please enter a quantity greater than zero to receive.');
            return;
          }

          btnReceive.disabled = true;
          btnReceive.textContent = 'Updating stock...';

          try {
            const receiveRes = await Api.post(`/businesses/${businessId}/purchases/${po.id}/receive`, {
              items: itemsToReceive
            });

            if (receiveRes.success) {
              Toast.success('Stock received and inventory balances updated!');
              Modal.close();
              this.loadPurchases(businessId, currency);
            }
          } catch (err) {
            btnReceive.disabled = false;
            btnReceive.textContent = 'Confirm Receipt & Update Stock';
          }
        };
      }
    } catch {
      Toast.error('Failed to load PO details.');
    }
  }
};
