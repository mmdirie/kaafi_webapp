// Point of Sale (POS) View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const PosView = {
  products: [],
  selectedCategory: 'all',
  searchQuery: '',

  async render(mainContainer) {
    if (!State.activeBusiness) {
      mainContainer.innerHTML = `<div class="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">Please select an active business first.</div>`;
      return;
    }

    const businessId = State.activeBusiness.id;
    const currency = State.activeBusiness.currency_code || 'USD';

    mainContainer.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
        <!-- Left: Product Catalog (7 cols on lg) -->
        <div class="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <!-- Catalog Header / Search -->
          <div class="p-4 border-b border-slate-100 space-y-3">
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </span>
                <input type="text" id="posSearchInput" placeholder="Scan barcode, SKU, or search product name..." class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button id="posClearSearchBtn" class="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold">Clear</button>
            </div>

            <!-- Categories Tabs -->
            <div id="posCategoryTabs" class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button class="cat-pill active px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium whitespace-nowrap" data-cat="all">All Items</button>
              <!-- Populated dynamically -->
            </div>
          </div>

          <!-- Product Grid -->
          <div id="posProductGrid" class="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            <div class="col-span-full py-12 text-center text-slate-400 text-sm">Loading inventory...</div>
          </div>
        </div>

        <!-- Right: Shopping Cart & Checkout (5 cols on lg) -->
        <div class="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <!-- Cart Header -->
          <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Current Order</h2>
              <span id="cartItemsBadge" class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">0</span>
            </div>
            <button id="cartClearBtn" class="text-xs font-semibold text-rose-600 hover:text-rose-800 focus:outline-none">
              Clear Cart
            </button>
          </div>

          <!-- Cart Item List -->
          <div id="cartItemsContainer" class="flex-1 p-4 overflow-y-auto divide-y divide-slate-100 space-y-2">
            <div class="py-12 text-center text-slate-400 text-sm">
              <svg class="w-12 h-12 mx-auto text-slate-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span>Cart is empty. Select products to begin.</span>
            </div>
          </div>

          <!-- Cart Summary & Calculations -->
          <div class="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
            <div class="space-y-1.5 text-xs text-slate-600">
              <div class="flex justify-between">
                <span>Subtotal</span>
                <span id="cartSubtotal" class="font-bold text-slate-800">$0.00</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1">
                  <span>Discount ($)</span>
                </span>
                <input type="number" id="cartDiscountInput" min="0" step="0.5" value="0" class="w-20 px-2 py-0.5 text-right rounded border border-slate-200 text-xs focus:ring-1 focus:ring-blue-500" />
              </div>
              <div class="flex justify-between">
                <span>Tax (<span id="cartTaxRateDisplay">0%</span>)</span>
                <span id="cartTax" class="font-medium">$0.00</span>
              </div>
              <div class="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Due</span>
                <span id="cartTotal" class="text-blue-600">$0.00</span>
              </div>
            </div>

            <!-- Checkout Button -->
            <button id="posCheckoutBtn" disabled class="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <span>Pay & Complete Sale</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Event handlers
    const searchInput = mainContainer.querySelector('#posSearchInput');
    const clearSearchBtn = mainContainer.querySelector('#posClearSearchBtn');
    const clearCartBtn = mainContainer.querySelector('#cartClearBtn');
    const discountInput = mainContainer.querySelector('#cartDiscountInput');
    const checkoutBtn = mainContainer.querySelector('#posCheckoutBtn');

    searchInput.oninput = (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.filterAndRenderGrid(currency);
    };

    clearSearchBtn.onclick = () => {
      searchInput.value = '';
      this.searchQuery = '';
      this.filterAndRenderGrid(currency);
    };

    clearCartBtn.onclick = () => {
      State.clearCart();
    };

    discountInput.oninput = () => {
      this.updateCartSummary(currency);
    };

    checkoutBtn.onclick = () => {
      this.openPaymentModal(businessId, currency);
    };

    // Subscribe to cart changes
    State.on('cart:change', () => {
      this.renderCartItems(currency);
      this.updateCartSummary(currency);
    });

    // Load products and categories
    await this.loadPosProducts(businessId, currency);
  },

  async loadPosProducts(businessId, currency) {
    try {
      const [prodRes, catRes] = await Promise.all([
        Api.get(`/businesses/${businessId}/pos/products`),
        Api.get(`/businesses/${businessId}/categories`)
      ]);

      if (prodRes.success) {
        this.products = prodRes.data || [];
      }

      // Populate category pills
      const tabs = document.getElementById('posCategoryTabs');
      if (tabs && catRes.success) {
        tabs.innerHTML = `
          <button class="cat-pill active px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium whitespace-nowrap" data-cat="all">All Items</button>
        `;

        (catRes.data || []).forEach(cat => {
          const btn = document.createElement('button');
          btn.className = 'cat-pill px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium whitespace-nowrap transition-colors';
          btn.dataset.cat = cat.id;
          btn.textContent = cat.name;
          tabs.appendChild(btn);
        });

        // Pill click delegation
        tabs.onclick = (e) => {
          const target = e.target.closest('.cat-pill');
          if (!target) return;
          tabs.querySelectorAll('.cat-pill').forEach(b => {
            b.classList.remove('bg-blue-600', 'text-white', 'active');
            b.classList.add('bg-slate-100', 'text-slate-700');
          });
          target.classList.remove('bg-slate-100', 'text-slate-700');
          target.classList.add('bg-blue-600', 'text-white', 'active');

          this.selectedCategory = target.dataset.cat;
          this.filterAndRenderGrid(currency);
        };
      }

      this.filterAndRenderGrid(currency);
      this.renderCartItems(currency);
      this.updateCartSummary(currency);
    } catch (err) {
      Toast.error('Failed to load products for POS');
    }
  },

  filterAndRenderGrid(currency) {
    const grid = document.getElementById('posProductGrid');
    if (!grid) return;

    let filtered = this.products;

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category_id === this.selectedCategory);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(this.searchQuery) ||
        p.sku.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-sm">No matching products found.</div>`;
      return;
    }

    grid.innerHTML = '';
    filtered.forEach(p => {
      const card = document.createElement('div');
      const isOut = p.stock_quantity <= 0;

      card.className = `p-3 rounded-xl border transition-all text-left flex flex-col justify-between ${
        isOut
          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
          : 'bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-md cursor-pointer'
      }`;

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span class="font-mono truncate max-w-[90px]">${Config.escapeHtml(p.sku)}</span>
            <span class="font-bold ${isOut ? 'text-rose-500' : p.stock_quantity <= p.stock_threshold ? 'text-amber-600' : 'text-emerald-600'}">
              ${isOut ? 'Out of Stock' : `${p.stock_quantity} left`}
            </span>
          </div>
          <h3 class="text-xs font-bold text-slate-800 line-clamp-2 leading-tight" title="${Config.escapeHtml(p.name)}">
            ${Config.escapeHtml(p.name)}
          </h3>
        </div>
        <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span class="text-sm font-extrabold text-blue-600">${Config.formatCurrency(p.selling_price, currency)}</span>
          <button class="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors" ${isOut ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          </button>
        </div>
      `;

      if (!isOut) {
        card.onclick = () => {
          try {
            State.addToCart(p, 1);
          } catch (err) {
            Toast.warning(err.message);
          }
        };
      }

      grid.appendChild(card);
    });
  },

  renderCartItems(currency) {
    const container = document.getElementById('cartItemsContainer');
    const badge = document.getElementById('cartItemsBadge');
    if (!container) return;

    if (State.cart.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400 text-sm">
          <svg class="w-12 h-12 mx-auto text-slate-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          <span>Cart is empty. Select products to begin.</span>
        </div>
      `;
      if (badge) badge.textContent = '0';
      return;
    }

    const totalCount = State.cart.reduce((sum, i) => sum + i.quantity, 0);
    if (badge) badge.textContent = String(totalCount);

    container.innerHTML = '';
    State.cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'py-2.5 flex items-center justify-between gap-3 text-xs';

      const lineTotal = item.product.selling_price * item.quantity;

      row.innerHTML = `
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-slate-800 truncate" title="${Config.escapeHtml(item.product.name)}">
            ${Config.escapeHtml(item.product.name)}
          </h4>
          <span class="text-slate-400 font-mono">${Config.formatCurrency(item.product.selling_price, currency)} each</span>
        </div>

        <!-- Quantity Controls -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button class="btn-qty-minus w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center">-</button>
          <span class="w-7 text-center font-bold text-slate-900">${item.quantity}</span>
          <button class="btn-qty-plus w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center">+</button>
        </div>

        <div class="text-right flex-shrink-0 w-16">
          <span class="font-extrabold text-slate-900">${Config.formatCurrency(lineTotal, currency)}</span>
        </div>

        <button class="btn-remove-item text-slate-300 hover:text-rose-600 p-1 rounded transition-colors flex-shrink-0" title="Remove item">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      `;

      row.querySelector('.btn-qty-minus').onclick = () => {
        State.updateCartQuantity(item.product.id, item.quantity - 1);
      };

      row.querySelector('.btn-qty-plus').onclick = () => {
        try {
          State.updateCartQuantity(item.product.id, item.quantity + 1);
        } catch (err) {
          Toast.warning(err.message);
        }
      };

      row.querySelector('.btn-remove-item').onclick = () => {
        State.removeFromCart(item.product.id);
      };

      container.appendChild(row);
    });
  },

  updateCartSummary(currency) {
    const taxRate = State.activeBusiness?.settings?.tax_rate || 0;
    const discountInput = document.getElementById('cartDiscountInput');
    const discountVal = discountInput ? Math.max(0, parseFloat(discountInput.value) || 0) : 0;

    const totals = State.getCartTotals(taxRate, discountVal);

    const elSub = document.getElementById('cartSubtotal');
    const elTax = document.getElementById('cartTax');
    const elTaxRate = document.getElementById('cartTaxRateDisplay');
    const elTot = document.getElementById('cartTotal');
    const btnPay = document.getElementById('posCheckoutBtn');

    if (elSub) elSub.textContent = Config.formatCurrency(totals.subtotal, currency);
    if (elTax) elTax.textContent = Config.formatCurrency(totals.tax, currency);
    if (elTaxRate) elTaxRate.textContent = `${(taxRate * 100).toFixed(1)}%`;
    if (elTot) elTot.textContent = Config.formatCurrency(totals.total, currency);

    if (btnPay) {
      btnPay.disabled = State.cart.length === 0;
    }
  },

  openPaymentModal(businessId, currency) {
    const taxRate = State.activeBusiness?.settings?.tax_rate || 0;
    const discountInput = document.getElementById('cartDiscountInput');
    const discountVal = discountInput ? Math.max(0, parseFloat(discountInput.value) || 0) : 0;
    const totals = State.getCartTotals(taxRate, discountVal);

    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <div class="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-blue-800">Total Amount Payable</span>
          <p class="text-xs text-blue-500">${totals.itemsCount} items in cart</p>
        </div>
        <div class="text-2xl font-black text-blue-700">
          ${Config.formatCurrency(totals.total, currency)}
        </div>
      </div>

      <!-- Payment Method Selector -->
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Payment Method</label>
        <div class="grid grid-cols-3 gap-2" id="payMethodGroup">
          <button type="button" class="pay-method-btn active p-3 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-900 font-bold text-xs flex flex-col items-center gap-1 transition-all" data-method="cash">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <span>Cash</span>
          </button>
          <button type="button" class="pay-method-btn p-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs flex flex-col items-center gap-1 hover:bg-slate-50 transition-all" data-method="card">
            <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            <span>Card</span>
          </button>
          <button type="button" class="pay-method-btn p-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs flex flex-col items-center gap-1 hover:bg-slate-50 transition-all" data-method="mobile_money">
            <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            <span>Mobile Money</span>
          </button>
        </div>
      </div>

      <!-- Cash Tendered & Change Due Section -->
      <div id="cashTenderedSection" class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Cash Tendered ($)</label>
          <input type="number" id="cashTenderedInput" min="${totals.total}" step="1" value="${totals.total}" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-base font-bold text-slate-800 focus:ring-2 focus:ring-blue-500" />
        </div>

        <!-- Quick denomination buttons -->
        <div class="flex items-center gap-2 text-xs">
          <button type="button" class="quick-cash px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700" data-add="0">Exact (${totals.total})</button>
          <button type="button" class="quick-cash px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700" data-set="${Math.ceil(totals.total / 10) * 10}">$${Math.ceil(totals.total / 10) * 10}</button>
          <button type="button" class="quick-cash px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700" data-set="${Math.ceil(totals.total / 50) * 50}">$${Math.ceil(totals.total / 50) * 50}</button>
          <button type="button" class="quick-cash px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700" data-set="100">$100</button>
        </div>

        <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
          <span class="font-bold text-emerald-800">Change Due:</span>
          <span id="changeDueDisplay" class="text-base font-black text-emerald-700">$0.00</span>
        </div>
      </div>

      <button type="button" id="confirmPaymentBtn" class="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2">
        <span>Complete Transaction</span>
      </button>
    `;

    Modal.open('Process Checkout', container, null, 'max-w-md');

    let currentMethod = 'cash';
    const methodBtns = container.querySelectorAll('.pay-method-btn');
    const cashSection = container.querySelector('#cashTenderedSection');
    const cashInput = container.querySelector('#cashTenderedInput');
    const changeDisplay = container.querySelector('#changeDueDisplay');
    const confirmBtn = container.querySelector('#confirmPaymentBtn');

    const updateChange = () => {
      const tendered = parseFloat(cashInput.value) || 0;
      const change = Math.max(0, tendered - totals.total);
      changeDisplay.textContent = Config.formatCurrency(change, currency);
      confirmBtn.disabled = tendered < totals.total;
    };

    methodBtns.forEach(btn => {
      btn.onclick = () => {
        methodBtns.forEach(b => {
          b.classList.remove('active', 'border-2', 'border-blue-600', 'bg-blue-50', 'text-blue-900');
          b.classList.add('border', 'border-slate-200', 'text-slate-700');
        });
        btn.classList.add('active', 'border-2', 'border-blue-600', 'bg-blue-50', 'text-blue-900');
        btn.classList.remove('border', 'border-slate-200', 'text-slate-700');

        currentMethod = btn.dataset.method;
        if (currentMethod === 'cash') {
          cashSection.classList.remove('hidden');
          cashInput.value = totals.total;
          updateChange();
        } else {
          cashSection.classList.add('hidden');
          confirmBtn.disabled = false;
        }
      };
    });

    cashInput.oninput = updateChange;

    container.querySelectorAll('.quick-cash').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.set) {
          cashInput.value = btn.dataset.set;
        } else {
          cashInput.value = totals.total;
        }
        updateChange();
      };
    });

    confirmBtn.onclick = async () => {
      const amountPaid = currentMethod === 'cash' ? parseFloat(cashInput.value) || totals.total : totals.total;

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span>Processing checkout...</span>`;

      // Prevent duplicate checkout requests with an idempotency key
      const idempotencyKey = `checkout-${businessId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const itemsPayload = State.cart.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity
      }));

      try {
        const res = await Api.post(`/businesses/${businessId}/pos/checkout`, {
          idempotency_key: idempotencyKey,
          payment_method: currentMethod,
          amount_paid: amountPaid,
          discount_total: totals.discount,
          tax_rate: taxRate,
          items: itemsPayload
        });

        if (res.success) {
          Modal.close();
          State.clearCart();
          Toast.success(`Sale completed! Receipt #${res.data.sale.receipt_number}`);
          this.showReceiptModal(res.data.sale, res.data.business, currency);
          // Reload POS products to refresh stock counts
          this.loadPosProducts(businessId, currency);
        }
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<span>Complete Transaction</span>`;
      }
    };
  },

  showReceiptModal(sale, business, currency) {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <!-- Printable Receipt Paper -->
      <div id="printableReceipt" class="bg-white p-6 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 space-y-4 shadow-sm">
        <div class="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
          <h2 class="text-base font-bold tracking-tight text-slate-900">${Config.escapeHtml(business.name)}</h2>
          <p class="text-[11px] text-slate-500">${Config.escapeHtml(business.address || '')}</p>
          <p class="text-[11px] text-slate-500">${Config.escapeHtml(business.phone || '')}</p>
        </div>

        <div class="flex justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-200">
          <div>
            <span>Receipt: <strong>${Config.escapeHtml(sale.receipt_number)}</strong></span><br/>
            <span>Date: ${Config.formatDateTime(sale.created_at)}</span>
          </div>
          <div class="text-right">
            <span>Cashier: ${Config.escapeHtml(sale.user_profiles?.display_name || 'Cashier')}</span><br/>
            <span class="capitalize">Payment: ${Config.escapeHtml(sale.payment_method)}</span>
          </div>
        </div>

        <!-- Items Table -->
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 text-[10px] uppercase">
              <th class="py-1">Item</th>
              <th class="py-1 text-center">Qty</th>
              <th class="py-1 text-right">Price</th>
              <th class="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${(sale.sale_items || []).map(item => `
              <tr>
                <td class="py-1.5 font-medium truncate max-w-[120px]">${Config.escapeHtml(item.product_name)}</td>
                <td class="py-1.5 text-center">${item.quantity}</td>
                <td class="py-1.5 text-right">${Config.formatCurrency(item.unit_price, currency)}</td>
                <td class="py-1.5 text-right font-bold">${Config.formatCurrency(item.line_total, currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals breakdown -->
        <div class="pt-3 border-t border-dashed border-slate-300 space-y-1 text-right">
          <div class="flex justify-between">
            <span class="text-slate-500">Subtotal:</span>
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
          <div class="flex justify-between text-sm font-bold pt-1 border-t border-slate-300">
            <span>Total:</span>
            <span>${Config.formatCurrency(sale.total, currency)}</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500 pt-1">
            <span>Amount Paid:</span>
            <span>${Config.formatCurrency(sale.amount_paid, currency)}</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500">
            <span>Change Due:</span>
            <span>${Config.formatCurrency(sale.change_due, currency)}</span>
          </div>
        </div>

        <div class="text-center pt-3 border-t border-dashed border-slate-300 text-[11px] text-slate-400">
          <p>${Config.escapeHtml(business.receipt_footer || 'Thank you for your purchase!')}</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-3">
        <button type="button" id="printReceiptBtn" class="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow transition-colors flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          <span>Print Receipt</span>
        </button>
        <button type="button" id="closeReceiptBtn" class="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs">
          New Sale
        </button>
      </div>
    `;

    Modal.open('Transaction Receipt', container, null, 'max-w-md');

    container.querySelector('#printReceiptBtn').onclick = () => {
      window.print();
    };

    container.querySelector('#closeReceiptBtn').onclick = () => {
      Modal.close();
    };
  }
};
