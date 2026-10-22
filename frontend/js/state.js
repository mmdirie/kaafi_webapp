// Global State Management
export const State = {
  user: null,
  profile: null,
  businesses: [],
  activeBusiness: null,
  currentView: 'dashboard',
  cart: [],
  listeners: {},

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  },

  setUser(user, profile = null) {
    this.user = user;
    this.profile = profile;
    this.emit('user:change', { user, profile });
  },

  setBusinesses(businesses) {
    this.businesses = businesses || [];
    const savedId = localStorage.getItem('kaafi_active_business_id');

    let active = null;
    if (savedId) {
      active = this.businesses.find(b => b.id === savedId);
    }
    if (!active && this.businesses.length > 0) {
      active = this.businesses[0];
    }

    this.setActiveBusiness(active);
    this.emit('businesses:change', this.businesses);
  },

  setActiveBusiness(business) {
    this.activeBusiness = business;
    if (business) {
      localStorage.setItem('kaafi_active_business_id', business.id);
    } else {
      localStorage.removeItem('kaafi_active_business_id');
    }
    this.emit('business:change', this.activeBusiness);
  },

  setView(viewName) {
    this.currentView = viewName;
    this.emit('view:change', viewName);
  },

  // POS Cart State Operations
  addToCart(product, quantity = 1) {
    const existingIndex = this.cart.findIndex(i => i.product.id === product.id);

    if (existingIndex > -1) {
      const currentQty = this.cart[existingIndex].quantity;
      const newQty = currentQty + quantity;

      if (newQty > product.stock_quantity) {
        throw new Error(`Cannot add more than ${product.stock_quantity} available units.`);
      }

      this.cart[existingIndex].quantity = newQty;
    } else {
      if (quantity > product.stock_quantity) {
        throw new Error(`Only ${product.stock_quantity} units available.`);
      }

      this.cart.push({
        product: { ...product },
        quantity: quantity
      });
    }

    this.emit('cart:change', this.cart);
  },

  updateCartQuantity(productId, quantity) {
    const index = this.cart.findIndex(i => i.product.id === productId);
    if (index > -1) {
      if (quantity <= 0) {
        this.cart.splice(index, 1);
      } else {
        const product = this.cart[index].product;
        if (quantity > product.stock_quantity) {
          throw new Error(`Only ${product.stock_quantity} available in stock.`);
        }
        this.cart[index].quantity = quantity;
      }
      this.emit('cart:change', this.cart);
    }
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.product.id !== productId);
    this.emit('cart:change', this.cart);
  },

  clearCart() {
    this.cart = [];
    this.emit('cart:change', this.cart);
  },

  getCartTotals(taxRate = 0, discountAmount = 0) {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.product.selling_price * item.quantity), 0);
    const discount = Math.min(discountAmount, subtotal);
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * taxRate;
    const total = taxable + tax;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      itemsCount: this.cart.reduce((sum, item) => sum + item.quantity, 0)
    };
  }
};
