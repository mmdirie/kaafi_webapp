// Product Management View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const ProductsView = {
  currentPage: 1,
  limit: 15,
  searchQuery: '',
  selectedCategory: '',
  stockStatus: 'all',
  sortBy: 'created_at',
  sortOrder: 'desc',
  categories: [],
  suppliers: [],

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
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Product Catalog</h1>
            <p class="text-xs text-slate-500 mt-1">Manage inventory items, SKUs, pricing, and stock levels</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="addProductBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>Add New Product</span>
            </button>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div class="relative flex-1 w-full">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input type="text" id="prodSearchInput" placeholder="Search by product name or SKU..." class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <!-- Category filter -->
          <select id="prodCategoryFilter" class="w-full md:w-48 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500">
            <option value="">All Categories</option>
          </select>

          <!-- Stock status filter -->
          <select id="prodStockFilter" class="w-full md:w-40 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500">
            <option value="all">All Stock Levels</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock (≤ Threshold)</option>
            <option value="out_of_stock">Out of Stock (0)</option>
          </select>

          <!-- Sort by -->
          <select id="prodSortBy" class="w-full md:w-36 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500">
            <option value="created_at">Newest First</option>
            <option value="name">Name A-Z</option>
            <option value="stock_quantity">Stock Level</option>
            <option value="selling_price">Selling Price</option>
          </select>
        </div>

        <!-- Products Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3.5 px-6">Product & SKU</th>
                  <th class="py-3.5 px-6">Category</th>
                  <th class="py-3.5 px-6">Cost Price</th>
                  <th class="py-3.5 px-6">Selling Price</th>
                  <th class="py-3.5 px-6">Margin</th>
                  <th class="py-3.5 px-6">Stock Status</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="productsTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="7" class="py-8 text-center text-slate-400">Loading product catalog...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div class="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/30">
            <span id="prodPaginationInfo">Showing 0 of 0 products</span>
            <div class="flex items-center gap-1.5" id="prodPaginationControls">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    mainContainer.querySelector('#addProductBtn').onclick = () => this.openProductModal(null, businessId, currency);

    const searchInput = mainContainer.querySelector('#prodSearchInput');
    const catFilter = mainContainer.querySelector('#prodCategoryFilter');
    const stockFilter = mainContainer.querySelector('#prodStockFilter');
    const sortFilter = mainContainer.querySelector('#prodSortBy');

    let debounceTimer;
    searchInput.oninput = (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.currentPage = 1;
        this.loadProducts(businessId, currency);
      }, 300);
    };

    catFilter.onchange = (e) => {
      this.selectedCategory = e.target.value;
      this.currentPage = 1;
      this.loadProducts(businessId, currency);
    };

    stockFilter.onchange = (e) => {
      this.stockStatus = e.target.value;
      this.currentPage = 1;
      this.loadProducts(businessId, currency);
    };

    sortFilter.onchange = (e) => {
      this.sortBy = e.target.value;
      this.sortOrder = this.sortBy === 'name' ? 'asc' : 'desc';
      this.currentPage = 1;
      this.loadProducts(businessId, currency);
    };

    // Load filter options (categories & suppliers)
    await this.loadDependencies(businessId);
    await this.loadProducts(businessId, currency);
  },

  async loadDependencies(businessId) {
    try {
      const [catRes, supRes] = await Promise.all([
        Api.get(`/businesses/${businessId}/categories`),
        Api.get(`/businesses/${businessId}/suppliers`)
      ]);

      if (catRes.success) {
        this.categories = catRes.data || [];
        const catSelect = document.getElementById('prodCategoryFilter');
        if (catSelect) {
          catSelect.innerHTML = '<option value="">All Categories</option>';
          this.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
          });
        }
      }

      if (supRes.success) {
        this.suppliers = supRes.data || [];
      }
    } catch {
      // Ignore dependencies error
    }
  },

  async loadProducts(businessId, currency) {
    const tbody = document.getElementById('productsTbody');
    if (!tbody) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/products`, {
        page: this.currentPage,
        limit: this.limit,
        search: this.searchQuery,
        categoryId: this.selectedCategory,
        stockStatus: this.stockStatus,
        sortBy: this.sortBy,
        sortOrder: this.sortOrder
      });

      if (!res.success) return;

      const products = res.data || [];
      const pagination = res.pagination || { page: 1, limit: 15, total: 0, total_pages: 0 };

      // Update pagination info
      const info = document.getElementById('prodPaginationInfo');
      if (info) {
        const start = products.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
        const end = Math.min(start + products.length - 1, pagination.total);
        info.textContent = `Showing ${start} to ${end} of ${pagination.total} products`;
      }

      this.renderPaginationButtons(pagination, businessId, currency);

      if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400">No products match your criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      products.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/60 transition-colors';

        const cost = Number(p.cost_price) || 0;
        const price = Number(p.selling_price) || 0;
        const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(0) : 0;

        let stockBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>${p.stock_quantity} in stock</span>`;

        if (p.is_out_of_stock) {
          stockBadge = `<span class="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Out of stock</span>`;
        } else if (p.is_low_stock) {
          stockBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Low (${p.stock_quantity} / min ${p.stock_threshold})</span>`;
        }

        tr.innerHTML = `
          <td class="py-3.5 px-6">
            <div class="font-bold text-slate-900">${Config.escapeHtml(p.name)}</div>
            <div class="font-mono text-[11px] text-slate-400">${Config.escapeHtml(p.sku)}</div>
          </td>
          <td class="py-3.5 px-6">
            <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]">${Config.escapeHtml(p.category_name)}</span>
          </td>
          <td class="py-3.5 px-6 font-mono text-slate-600">${Config.formatCurrency(cost, currency)}</td>
          <td class="py-3.5 px-6 font-mono font-bold text-slate-900">${Config.formatCurrency(price, currency)}</td>
          <td class="py-3.5 px-6">
            <span class="font-semibold ${margin >= 40 ? 'text-emerald-600' : 'text-slate-600'}">${margin}%</span>
          </td>
          <td class="py-3.5 px-6">${stockBadge}</td>
          <td class="py-3.5 px-6 text-right space-x-1">
            <button class="btn-history px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold" title="Stock Movement History">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
            <button class="btn-edit px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-semibold" title="Edit Product">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn-delete px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 font-semibold" title="Delete Product">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        `;

        tr.querySelector('.btn-history').onclick = () => this.openStockHistoryModal(p, businessId);
        tr.querySelector('.btn-edit').onclick = () => this.openProductModal(p, businessId, currency);
        tr.querySelector('.btn-delete').onclick = () => this.confirmDelete(p, businessId, currency);

        tbody.appendChild(tr);
      });
    } catch (err) {
      Toast.error('Failed to load products');
    }
  },

  renderPaginationButtons(pagination, businessId, currency) {
    const controls = document.getElementById('prodPaginationControls');
    if (!controls) return;

    controls.innerHTML = '';
    const totalPages = pagination.total_pages || 1;

    // Previous
    const btnPrev = document.createElement('button');
    btnPrev.className = `px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold ${
      this.currentPage > 1 ? 'hover:bg-slate-50 text-slate-700' : 'opacity-40 cursor-not-allowed text-slate-400'
    }`;
    btnPrev.textContent = 'Prev';
    btnPrev.disabled = this.currentPage <= 1;
    btnPrev.onclick = () => {
      this.currentPage--;
      this.loadProducts(businessId, currency);
    };
    controls.appendChild(btnPrev);

    // Page indicator
    const span = document.createElement('span');
    span.className = 'px-2 font-bold text-slate-700 text-xs';
    span.textContent = `${this.currentPage} / ${totalPages}`;
    controls.appendChild(span);

    // Next
    const btnNext = document.createElement('button');
    btnNext.className = `px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold ${
      this.currentPage < totalPages ? 'hover:bg-slate-50 text-slate-700' : 'opacity-40 cursor-not-allowed text-slate-400'
    }`;
    btnNext.textContent = 'Next';
    btnNext.disabled = this.currentPage >= totalPages;
    btnNext.onclick = () => {
      this.currentPage++;
      this.loadProducts(businessId, currency);
    };
    controls.appendChild(btnNext);
  },

  openProductModal(product = null, businessId, currency) {
    const isEdit = Boolean(product);
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <form id="productForm" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Product Name *</label>
            <input type="text" id="fName" required value="${Config.escapeHtml(product?.name || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="e.g. Wireless Ergonomic Mouse" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">SKU / Item ID *</label>
            <input type="text" id="fSku" required value="${Config.escapeHtml(product?.sku || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500" placeholder="SKU-10023" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Category</label>
            <select id="fCategory" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500">
              <option value="">Uncategorized</option>
              ${this.categories.map(c => `
                <option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${Config.escapeHtml(c.name)}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Cost Price (${currency}) *</label>
            <input type="number" id="fCostPrice" required min="0" step="0.01" value="${product?.cost_price ?? 0}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Selling Price (${currency}) *</label>
            <input type="number" id="fSellingPrice" required min="0" step="0.01" value="${product?.selling_price ?? 0}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Stock Threshold (Min Alert)</label>
            <input type="number" id="fStockThreshold" required min="0" step="1" value="${product?.stock_threshold ?? 5}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" />
          </div>

          ${!isEdit ? `
            <div>
              <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Initial Stock Count</label>
              <input type="number" id="fInitialStock" min="0" step="1" value="0" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" />
            </div>
          ` : `
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Stock</label>
              <div class="px-3 py-2 rounded-xl bg-slate-100 font-bold text-xs text-slate-700">${product.stock_quantity} units</div>
            </div>
          `}

          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Supplier</label>
            <select id="fSupplier" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500">
              <option value="">None</option>
              ${this.suppliers.map(s => `
                <option value="${s.id}" ${product?.supplier_id === s.id ? 'selected' : ''}>${Config.escapeHtml(s.name)}</option>
              `).join('')}
            </select>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
            <textarea id="fDesc" rows="2" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="Product details, specs, notes...">${Config.escapeHtml(product?.description || '')}</textarea>
          </div>
        </div>

        <div class="pt-2 flex items-center justify-end gap-2">
          <button type="button" id="btnCancelProd" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
          <button type="submit" id="btnSaveProd" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition-colors">
            ${isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    `;

    Modal.open(isEdit ? 'Edit Product' : 'Add New Product', container);

    container.querySelector('#btnCancelProd').onclick = () => Modal.close();

    container.querySelector('#productForm').onsubmit = async (e) => {
      e.preventDefault();

      const payload = {
        name: container.querySelector('#fName').value.trim(),
        sku: container.querySelector('#fSku').value.trim(),
        category_id: container.querySelector('#fCategory').value || null,
        supplier_id: container.querySelector('#fSupplier').value || null,
        cost_price: parseFloat(container.querySelector('#fCostPrice').value) || 0,
        selling_price: parseFloat(container.querySelector('#fSellingPrice').value) || 0,
        stock_threshold: parseInt(container.querySelector('#fStockThreshold').value) || 0,
        description: container.querySelector('#fDesc').value.trim() || null
      };

      if (!isEdit) {
        payload.initial_stock = parseInt(container.querySelector('#fInitialStock').value) || 0;
      }

      const saveBtn = container.querySelector('#btnSaveProd');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        if (isEdit) {
          await Api.put(`/businesses/${businessId}/products/${product.id}`, payload);
          Toast.success('Product updated successfully!');
        } else {
          await Api.post(`/businesses/${businessId}/products`, payload);
          Toast.success('Product created successfully!');
        }
        Modal.close();
        this.loadProducts(businessId, currency);
      } catch {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Product';
      }
    };
  },

  async confirmDelete(product, businessId, currency) {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;

    try {
      const res = await Api.delete(`/businesses/${businessId}/products/${product.id}`);
      if (res.success) {
        if (res.data?.deactivated) {
          Toast.info(res.data.message);
        } else {
          Toast.success('Product deleted.');
        }
        this.loadProducts(businessId, currency);
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async openStockHistoryModal(product, businessId) {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between">
        <div>
          <span class="font-bold text-slate-800">${Config.escapeHtml(product.name)}</span>
          <span class="text-slate-400 font-mono block text-[11px]">${Config.escapeHtml(product.sku)}</span>
        </div>
        <div class="text-right">
          <span class="text-slate-400 block text-[10px] uppercase font-bold">Current Stock</span>
          <span class="text-base font-black text-blue-600">${product.stock_quantity} units</span>
        </div>
      </div>

      <div class="max-h-72 overflow-y-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
              <th class="py-2 px-3">Date</th>
              <th class="py-2 px-3">Type</th>
              <th class="py-2 px-3 text-center">Delta</th>
              <th class="py-2 px-3 text-right">Balance</th>
              <th class="py-2 px-3">Reason</th>
            </tr>
          </thead>
          <tbody id="movementsModalTbody" class="divide-y divide-slate-100 text-slate-700">
            <tr><td colspan="5" class="py-4 text-center text-slate-400">Loading stock history...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    Modal.open('Stock Movement Audit Trail', container);

    try {
      const res = await Api.get(`/businesses/${businessId}/products/${product.id}/movements`);
      const tbody = container.querySelector('#movementsModalTbody');

      if (res.success && res.data && res.data.length > 0) {
        tbody.innerHTML = '';
        res.data.forEach(m => {
          const tr = document.createElement('tr');
          const isPos = m.quantity_delta > 0;
          tr.innerHTML = `
            <td class="py-2 px-3 text-slate-500 text-[11px]">${Config.formatDateTime(m.created_at)}</td>
            <td class="py-2 px-3 capitalize font-semibold">${Config.escapeHtml(m.movement_type.replace('_', ' '))}</td>
            <td class="py-2 px-3 text-center font-bold font-mono ${isPos ? 'text-emerald-600' : 'text-rose-600'}">
              ${isPos ? `+${m.quantity_delta}` : m.quantity_delta}
            </td>
            <td class="py-2 px-3 text-right font-mono font-bold">${m.quantity_after}</td>
            <td class="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[140px]" title="${Config.escapeHtml(m.reason)}">${Config.escapeHtml(m.reason || 'Manual')}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">No stock movements recorded yet.</td></tr>`;
      }
    } catch {
      container.querySelector('#movementsModalTbody').innerHTML = `<tr><td colspan="5" class="py-4 text-center text-rose-500">Failed to load history.</td></tr>`;
    }
  }
};
