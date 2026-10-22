// Supplier Management View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const SuppliersView = {
  async render(mainContainer) {
    if (!State.activeBusiness) {
      mainContainer.innerHTML = `<div class="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">Please select an active business first.</div>`;
      return;
    }

    const businessId = State.activeBusiness.id;

    mainContainer.innerHTML = `
      <div class="space-y-5">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Suppliers & Vendors</h1>
            <p class="text-xs text-slate-500 mt-1">Manage vendor contacts, supplier profiles, and purchasing relationships</p>
          </div>
          <button id="addSupplierBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Add Supplier</span>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div class="relative w-full max-w-md">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input type="text" id="supplierSearchInput" placeholder="Search suppliers by name, contact, phone..." class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <!-- Suppliers Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3.5 px-6">Supplier Name</th>
                  <th class="py-3.5 px-6">Contact Person</th>
                  <th class="py-3.5 px-6">Email</th>
                  <th class="py-3.5 px-6">Phone</th>
                  <th class="py-3.5 px-6">Address</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="suppliersTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="6" class="py-8 text-center text-slate-400">Loading suppliers...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    mainContainer.querySelector('#addSupplierBtn').onclick = () => this.openSupplierModal(null, businessId);

    const searchInput = mainContainer.querySelector('#supplierSearchInput');
    let debounce;
    searchInput.oninput = (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.loadSuppliers(businessId, e.target.value.trim());
      }, 300);
    };

    await this.loadSuppliers(businessId);
  },

  async loadSuppliers(businessId, search = '') {
    const tbody = document.getElementById('suppliersTbody');
    if (!tbody) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/suppliers`, { search });
      if (!res.success) return;

      const suppliers = res.data || [];
      if (suppliers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No suppliers registered.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      suppliers.forEach(s => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/60 transition-colors';

        tr.innerHTML = `
          <td class="py-3.5 px-6 font-bold text-slate-900">${Config.escapeHtml(s.name)}</td>
          <td class="py-3.5 px-6 text-slate-700">${Config.escapeHtml(s.contact_name || '—')}</td>
          <td class="py-3.5 px-6 text-blue-600 font-mono text-[11px]">${Config.escapeHtml(s.email || '—')}</td>
          <td class="py-3.5 px-6 font-mono text-slate-600">${Config.escapeHtml(s.phone || '—')}</td>
          <td class="py-3.5 px-6 text-slate-500 max-w-[180px] truncate" title="${Config.escapeHtml(s.address)}">${Config.escapeHtml(s.address || '—')}</td>
          <td class="py-3.5 px-6 text-right space-x-1">
            <button class="btn-edit px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-semibold" title="Edit">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn-delete px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 font-semibold" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        `;

        tr.querySelector('.btn-edit').onclick = () => this.openSupplierModal(s, businessId);
        tr.querySelector('.btn-delete').onclick = () => this.confirmDelete(s, businessId);

        tbody.appendChild(tr);
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-rose-500">Failed to load suppliers.</td></tr>`;
    }
  },

  openSupplierModal(supplier = null, businessId) {
    const isEdit = Boolean(supplier);
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <form id="supplierForm" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Company / Supplier Name *</label>
            <input type="text" id="fSupName" required value="${Config.escapeHtml(supplier?.name || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="e.g. Apex Global Distributors" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Contact Person</label>
            <input type="text" id="fSupContact" value="${Config.escapeHtml(supplier?.contact_name || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Phone Number</label>
            <input type="text" id="fSupPhone" value="${Config.escapeHtml(supplier?.phone || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500" placeholder="+1-555-0100" />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
            <input type="email" id="fSupEmail" value="${Config.escapeHtml(supplier?.email || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500" placeholder="orders@supplier.example" />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Physical Address</label>
            <input type="text" id="fSupAddress" value="${Config.escapeHtml(supplier?.address || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="Street, City, Country" />
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" id="btnCancelSup" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
            ${isEdit ? 'Save Changes' : 'Create Supplier'}
          </button>
        </div>
      </form>
    `;

    Modal.open(isEdit ? 'Edit Supplier' : 'New Supplier', container, null, 'max-w-md');

    container.querySelector('#btnCancelSup').onclick = () => Modal.close();

    container.querySelector('#supplierForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        name: container.querySelector('#fSupName').value.trim(),
        contact_name: container.querySelector('#fSupContact').value.trim() || null,
        phone: container.querySelector('#fSupPhone').value.trim() || null,
        email: container.querySelector('#fSupEmail').value.trim() || null,
        address: container.querySelector('#fSupAddress').value.trim() || null
      };

      try {
        if (isEdit) {
          await Api.put(`/businesses/${businessId}/suppliers/${supplier.id}`, payload);
          Toast.success('Supplier updated.');
        } else {
          await Api.post(`/businesses/${businessId}/suppliers`, payload);
          Toast.success('Supplier created.');
        }
        Modal.close();
        this.loadSuppliers(businessId);
      } catch {
        // Handled by api error toast
      }
    };
  },

  async confirmDelete(supplier, businessId) {
    if (!confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) return;

    try {
      const res = await Api.delete(`/businesses/${businessId}/suppliers/${supplier.id}`);
      if (res.success) {
        Toast.success('Supplier removed.');
        this.loadSuppliers(businessId);
      }
    } catch {
      // Handled by api error toast
    }
  }
};
