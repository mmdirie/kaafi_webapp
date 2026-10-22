// Business Settings & Team Management View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const SettingsView = {
  async render(mainContainer) {
    if (!State.activeBusiness) {
      mainContainer.innerHTML = `<div class="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">Please select an active business first.</div>`;
      return;
    }

    const businessId = State.activeBusiness.id;
    const userRole = State.activeBusiness.role;
    const isAdmin = userRole === 'admin';

    mainContainer.innerHTML = `
      <div class="space-y-6 max-w-5xl mx-auto">
        <!-- Header -->
        <div>
          <h1 class="text-2xl font-black text-slate-900 tracking-tight">Business Settings & Team</h1>
          <p class="text-xs text-slate-500 mt-1">Configure company profiles, tax rates, currency, and role-based access</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Business Profile & Tax Settings (2 cols on lg) -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Business Info Card -->
            <div class="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                Company & Store Information
              </h2>
              <form id="settingsGeneralForm" class="space-y-4 text-xs">
                <div>
                  <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Business Name *</label>
                  <input type="text" id="setBizName" required value="${Config.escapeHtml(State.activeBusiness.name)}" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-bold" />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Contact Email</label>
                    <input type="email" id="setContactEmail" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500" placeholder="info@company.com" />
                  </div>
                  <div>
                    <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Contact Phone</label>
                    <input type="text" id="setContactPhone" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500" placeholder="+1-555-0199" />
                  </div>
                </div>

                <div>
                  <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Store Address</label>
                  <input type="text" id="setAddress" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500" placeholder="123 Commerce Boulevard, Suite 100" />
                </div>

                <div class="pt-2 flex justify-end">
                  <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow text-xs">
                    Save Profile
                  </button>
                </div>
              </form>
            </div>

            <!-- Tax, Currency & Receipt Card -->
            <div class="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                Currency, Tax & POS Receipt Rules
              </h2>
              <form id="settingsPosForm" class="space-y-4 text-xs">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Currency Code</label>
                    <select id="setCurrency" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold focus:ring-2 focus:ring-blue-500">
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="KES">KES (KSh)</option>
                      <option value="SOS">SOS (Sh.So.)</option>
                      <option value="AED">AED (AED)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Tax Rate (e.g. 0.05 = 5%)</label>
                    <input type="number" id="setTaxRate" step="0.001" min="0" max="1" class="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Max Discount %</label>
                    <input type="number" id="setMaxDiscount" step="1" min="0" max="100" class="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label class="block font-bold text-slate-600 uppercase tracking-wider mb-1">Receipt Footer Memo</label>
                  <input type="text" id="setReceiptFooter" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500" placeholder="Thank you for shopping with Kaafi Business!" />
                </div>

                <div class="pt-2 flex justify-end">
                  <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow text-xs">
                    Update Financial Settings
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Right: Team Members & Roles (1 col on lg) -->
          <div class="space-y-6">
            <!-- Team Card -->
            <div class="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Team Members
                </h2>
                ${isAdmin ? `
                  <button id="addMemberBtn" class="text-xs font-bold text-blue-600 hover:text-blue-800">+ Add Member</button>
                ` : ''}
              </div>

              <div id="membersList" class="space-y-3">
                <p class="text-xs text-slate-400 py-4 text-center">Loading team members...</p>
              </div>
            </div>

            <!-- Role Permissions Cheat Sheet -->
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5">
              <h3 class="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Role Hierarchy</h3>
              <div class="space-y-2 text-slate-600">
                <div>
                  <span class="font-bold text-blue-600">Admin:</span>
                  <p class="text-[11px]">Full access to all modules, financial reports, team assignments, settings.</p>
                </div>
                <div>
                  <span class="font-bold text-indigo-600">Manager:</span>
                  <p class="text-[11px]">Manage products, suppliers, stock, process customer refunds, view P&L reports.</p>
                </div>
                <div>
                  <span class="font-bold text-emerald-600">Cashier:</span>
                  <p class="text-[11px]">Point of sale terminal, create sales, print receipts, view personal sales.</p>
                </div>
                <div>
                  <span class="font-bold text-amber-600">Inventory Staff:</span>
                  <p class="text-[11px]">Receive supplier purchases, record stock counts, update item thresholds.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load current settings & team
    await this.loadSettings(businessId);
    await this.loadMembers(businessId, isAdmin);

    // Form handlers
    const genForm = mainContainer.querySelector('#settingsGeneralForm');
    const posForm = mainContainer.querySelector('#settingsPosForm');
    const addMemberBtn = mainContainer.querySelector('#addMemberBtn');

    if (addMemberBtn) {
      addMemberBtn.onclick = () => this.openAddMemberModal(businessId);
    }

    genForm.onsubmit = async (e) => {
      e.preventDefault();
      const newName = mainContainer.querySelector('#setBizName').value.trim();
      const contactEmail = mainContainer.querySelector('#setContactEmail').value.trim() || null;
      const contactPhone = mainContainer.querySelector('#setContactPhone').value.trim() || null;
      const address = mainContainer.querySelector('#setAddress').value.trim() || null;

      try {
        await Api.patch(`/businesses/${businessId}`, { name: newName });
        await Api.put(`/businesses/${businessId}/settings`, {
          contact_email: contactEmail,
          contact_phone: contactPhone,
          address: address
        });
        State.activeBusiness.name = newName;
        State.emit('business:change', State.activeBusiness);
        Toast.success('Business profile updated successfully!');
      } catch {
        // Handled by API error toast
      }
    };

    posForm.onsubmit = async (e) => {
      e.preventDefault();
      const currency = mainContainer.querySelector('#setCurrency').value;
      const taxRate = parseFloat(mainContainer.querySelector('#setTaxRate').value) || 0;
      const maxDiscount = parseFloat(mainContainer.querySelector('#setMaxDiscount').value) || 0;
      const receiptFooter = mainContainer.querySelector('#setReceiptFooter').value.trim() || null;

      try {
        await Api.put(`/businesses/${businessId}/settings`, {
          currency_code: currency,
          tax_rate: taxRate,
          max_discount_percent: maxDiscount,
          receipt_footer: receiptFooter
        });
        State.activeBusiness.currency_code = currency;
        State.emit('business:change', State.activeBusiness);
        Toast.success('Financial & receipt settings updated!');
      } catch {
        // Handled by API error toast
      }
    };
  },

  async loadSettings(businessId) {
    try {
      const res = await Api.get(`/businesses/${businessId}/settings`);
      if (!res.success) return;

      const s = res.data;
      const emailInput = document.getElementById('setContactEmail');
      const phoneInput = document.getElementById('setContactPhone');
      const addrInput = document.getElementById('setAddress');
      const curSelect = document.getElementById('setCurrency');
      const taxInput = document.getElementById('setTaxRate');
      const discInput = document.getElementById('setMaxDiscount');
      const footerInput = document.getElementById('setReceiptFooter');

      if (emailInput && s.contact_email) emailInput.value = s.contact_email;
      if (phoneInput && s.contact_phone) phoneInput.value = s.contact_phone;
      if (addrInput && s.address) addrInput.value = s.address;
      if (curSelect && s.currency_code) curSelect.value = s.currency_code;
      if (taxInput) taxInput.value = s.tax_rate ?? 0;
      if (discInput) discInput.value = s.max_discount_percent ?? 0;
      if (footerInput && s.receipt_footer) footerInput.value = s.receipt_footer;
    } catch {
      // Ignored
    }
  },

  async loadMembers(businessId, isAdmin) {
    const list = document.getElementById('membersList');
    if (!list) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/members`);
      if (!res.success) return;

      const members = res.data || [];
      if (members.length === 0) {
        list.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">No members listed.</p>`;
        return;
      }

      list.innerHTML = '';
      members.forEach(m => {
        const item = document.createElement('div');
        item.className = 'p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs gap-2';

        let roleBadgeColor = 'bg-blue-50 text-blue-700';
        if (m.role === 'admin') roleBadgeColor = 'bg-purple-50 text-purple-700';
        if (m.role === 'cashier') roleBadgeColor = 'bg-emerald-50 text-emerald-700';
        if (m.role === 'inventory_staff') roleBadgeColor = 'bg-amber-50 text-amber-700';

        item.innerHTML = `
          <div class="flex-1 min-w-0">
            <span class="font-bold text-slate-900 block truncate">${Config.escapeHtml(m.display_name || 'Staff Member')}</span>
            <span class="text-slate-400 font-mono text-[10px] block truncate">${Config.escapeHtml(m.user_id)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${roleBadgeColor}">${m.role.replace('_', ' ')}</span>
            ${isAdmin && m.user_id !== State.user?.id ? `
              <button class="btn-remove-member text-slate-300 hover:text-rose-600 font-bold p-1">&times;</button>
            ` : ''}
          </div>
        `;

        const btnRemove = item.querySelector('.btn-remove-member');
        if (btnRemove) {
          btnRemove.onclick = async () => {
            if (!confirm(`Remove member "${m.display_name}" from this business?`)) return;
            try {
              await Api.delete(`/businesses/${businessId}/members/${m.user_id}`);
              Toast.success('Member removed.');
              this.loadMembers(businessId, isAdmin);
            } catch {
              // Handled by API error toast
            }
          };
        }

        list.appendChild(item);
      });
    } catch {
      list.innerHTML = `<p class="text-xs text-rose-500 py-2">Failed to load members.</p>`;
    }
  },

  openAddMemberModal(businessId) {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <form id="addMemberForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">User ID (Supabase Auth UUID) *</label>
          <input type="text" id="mUserId" required placeholder="00000000-0000-0000-0000-000000000000" class="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Assigned Role *</label>
          <select id="mRole" required class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500">
            <option value="cashier">Cashier (POS & Sales)</option>
            <option value="inventory_staff">Inventory Staff (Stock & Receiving)</option>
            <option value="manager">Manager (Stock, Sales, Expenses, Refunds)</option>
            <option value="admin">Admin (Full Control)</option>
          </select>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" id="btnCancelMember" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
            Add Member
          </button>
        </div>
      </form>
    `;

    Modal.open('Add Team Member', container, null, 'max-w-md');

    container.querySelector('#btnCancelMember').onclick = () => Modal.close();

    container.querySelector('#addMemberForm').onsubmit = async (e) => {
      e.preventDefault();
      const userId = container.querySelector('#mUserId').value.trim();
      const role = container.querySelector('#mRole').value;

      try {
        await Api.post(`/businesses/${businessId}/members`, {
          user_id: userId,
          role
        });
        Toast.success('Member assigned successfully!');
        Modal.close();
        this.loadMembers(businessId, true);
      } catch {
        // Handled by API error toast
      }
    };
  }
};
