// Kaafi Business Application Bootstrap & Router
import { Config } from './config.js';
import { State } from './state.js';
import { Api } from './api.js';
import { Toast } from './components/toast.js';
import { Modal } from './components/modal.js';

// Views
import { AuthView } from './views/auth.js';
import { DashboardView } from './views/dashboard.js';
import { PosView } from './views/pos.js';
import { ProductsView } from './views/products.js';
import { CategoriesView } from './views/categories.js';
import { InventoryView } from './views/inventory.js';
import { SalesView } from './views/sales.js';
import { PurchasesView } from './views/purchases.js';
import { SuppliersView } from './views/suppliers.js';
import { ExpensesView } from './views/expenses.js';
import { ReportsView } from './views/reports.js';
import { SettingsView } from './views/settings.js';

export const App = {
  async init() {
    this.setupEventListeners();
    await this.checkAuthAndBootstrap();
  },

  setupEventListeners() {
    window.addEventListener('auth:expired', () => {
      this.renderUnauthenticatedState();
      AuthView.renderAuthModal();
    });

    // View change listener
    State.on('view:change', (viewName) => {
      this.updateActiveNavIndicator(viewName);
      this.routeToView(viewName);
    });

    // Business change listener
    State.on('business:change', (business) => {
      this.updateBusinessHeader(business);
      this.routeToView(State.currentView);
    });

    // User change listener
    State.on('user:change', ({ user, profile }) => {
      this.updateUserHeader(user, profile);
    });

    // Sidebar navigation clicks
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) {
          State.setView(view);
          // If on mobile, close sidebar
          this.closeMobileSidebar();
        }
      });
    });

    // Sidebar collapse toggles
    const sidebar = document.getElementById('sidebar');
    const toggleDesktop = document.getElementById('toggleSidebarDesktop');
    const toggleMobile = document.getElementById('toggleSidebarMobile');
    const mobileBackdrop = document.getElementById('sidebarMobileBackdrop');

    if (toggleDesktop && sidebar) {
      toggleDesktop.addEventListener('click', () => {
        sidebar.classList.toggle('w-64');
        sidebar.classList.toggle('w-20');
        document.querySelectorAll('.nav-label').forEach(el => el.classList.toggle('hidden'));
        document.querySelectorAll('.brand-label').forEach(el => el.classList.toggle('hidden'));
      });
    }

    if (toggleMobile && sidebar) {
      toggleMobile.addEventListener('click', () => {
        sidebar.classList.toggle('-translate-x-full');
        mobileBackdrop?.classList.toggle('hidden');
      });
    }

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Config.clearSession();
        State.setUser(null, null);
        State.setBusinesses([]);
        Toast.info('You have logged out.');
        this.renderUnauthenticatedState();
        AuthView.renderAuthModal();
      });
    }

    // Business switcher
    const bizSelect = document.getElementById('businessSwitcher');
    if (bizSelect) {
      bizSelect.addEventListener('change', (e) => {
        if (e.target.value === 'new') {
          this.openCreateBusinessModal();
        } else {
          const selected = State.businesses.find(b => b.id === e.target.value);
          if (selected) {
            State.setActiveBusiness(selected);
          }
        }
      });
    }
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mobileBackdrop = document.getElementById('sidebarMobileBackdrop');
    if (sidebar && window.innerWidth < 1024) {
      sidebar.classList.add('-translate-x-full');
      mobileBackdrop?.classList.add('hidden');
    }
  },

  async checkAuthAndBootstrap() {
    const token = Config.getAccessToken();

    if (!token) {
      this.renderUnauthenticatedState();
      AuthView.renderAuthModal();
      return;
    }

    try {
      const res = await Api.get('/auth/me');
      if (res.success) {
        State.setUser(res.data.user, res.data.profile);
        State.setBusinesses(res.data.businesses);

        if (res.data.businesses.length === 0) {
          this.openCreateBusinessModal();
        } else {
          State.setView('dashboard');
        }
      }
    } catch {
      this.renderUnauthenticatedState();
      AuthView.renderAuthModal();
    }
  },

  renderUnauthenticatedState() {
    const mainContainer = document.getElementById('mainContentArea');
    if (mainContainer) {
      mainContainer.innerHTML = `
        <div class="h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center shadow-lg">
            KB
          </div>
          <h2 class="text-2xl font-black text-slate-800">Kaafi Business Suite</h2>
          <p class="text-slate-500 max-w-md text-sm">Please sign in to access your business operations dashboard, point of sale, inventory, and analytics.</p>
          <button id="openLoginBtn" class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-colors">
            Sign In to Workspace
          </button>
        </div>
      `;
      document.getElementById('openLoginBtn')?.addEventListener('click', () => {
        AuthView.renderAuthModal();
      });
    }
  },

  updateActiveNavIndicator(viewName) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const isTarget = link.dataset.view === viewName;
      if (isTarget) {
        link.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
        link.classList.remove('text-slate-600', 'hover:bg-slate-100');
        link.querySelectorAll('svg').forEach(s => {
          s.classList.add('text-white');
          s.classList.remove('text-slate-400');
        });
      } else {
        link.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
        link.classList.add('text-slate-600', 'hover:bg-slate-100');
        link.querySelectorAll('svg').forEach(s => {
          s.classList.remove('text-white');
          s.classList.add('text-slate-400');
        });
      }
    });
  },

  updateBusinessHeader(business) {
    const switcher = document.getElementById('businessSwitcher');
    const brandName = document.getElementById('brandNameHeader');

    if (switcher && State.businesses.length > 0) {
      switcher.innerHTML = '';
      State.businesses.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.name} (${b.role})`;
        if (business && b.id === business.id) opt.selected = true;
        switcher.appendChild(opt);
      });

      const optNew = document.createElement('option');
      optNew.value = 'new';
      optNew.textContent = '+ Create New Business...';
      switcher.appendChild(optNew);
    }

    if (brandName) {
      brandName.textContent = business ? business.name : 'Kaafi Business';
    }
  },

  updateUserHeader(user, profile) {
    const displayNameEl = document.getElementById('headerUserDisplayName');
    const userRoleBadge = document.getElementById('headerUserRole');
    const avatarEl = document.getElementById('headerUserAvatar');

    if (displayNameEl) {
      displayNameEl.textContent = profile?.display_name || user?.email || 'User';
    }

    if (userRoleBadge && State.activeBusiness) {
      userRoleBadge.textContent = State.activeBusiness.role.toUpperCase();
    }

    if (avatarEl) {
      const initial = (profile?.display_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
      avatarEl.textContent = initial;
    }
  },

  routeToView(viewName) {
    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    switch (viewName) {
      case 'dashboard':
        DashboardView.render(mainContainer);
        break;
      case 'pos':
        PosView.render(mainContainer);
        break;
      case 'products':
        ProductsView.render(mainContainer);
        break;
      case 'categories':
        CategoriesView.render(mainContainer);
        break;
      case 'inventory':
        InventoryView.render(mainContainer);
        break;
      case 'sales':
        SalesView.render(mainContainer);
        break;
      case 'purchases':
        PurchasesView.render(mainContainer);
        break;
      case 'suppliers':
        SuppliersView.render(mainContainer);
        break;
      case 'expenses':
        ExpensesView.render(mainContainer);
        break;
      case 'reports':
        ReportsView.render(mainContainer);
        break;
      case 'settings':
        SettingsView.render(mainContainer);
        break;
      default:
        DashboardView.render(mainContainer);
    }
  },

  openCreateBusinessModal() {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <form id="createBizForm" class="space-y-4">
        <p class="text-xs text-slate-500">Initialize a new business entity with independent inventory, sales, and role-based permissions.</p>
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Business / Store Name *</label>
          <input type="text" id="newBizName" required placeholder="e.g. Kaafi Retail Hub" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 font-bold" />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="submit" class="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow">
            Create Business Workspace
          </button>
        </div>
      </form>
    `;

    Modal.open('Register Business', container, null, 'max-w-md');

    container.querySelector('#createBizForm').onsubmit = async (e) => {
      e.preventDefault();
      const name = container.querySelector('#newBizName').value.trim();

      try {
        const res = await Api.post('/businesses', { name });
        if (res.success) {
          Toast.success(`Business "${name}" created!`);
          Modal.close();

          // Refresh businesses
          const meRes = await Api.get('/auth/me');
          if (meRes.success) {
            State.setBusinesses(meRes.data.businesses);
            State.setView('dashboard');
          }
        }
      } catch {
        // Handled by API error toast
      }
    };
  }
};

// Start application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
