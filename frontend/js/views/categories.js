// Category Management View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const CategoriesView = {
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
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Categories</h1>
            <p class="text-xs text-slate-500 mt-1">Organize products into logical business categories</p>
          </div>
          <button id="addCategoryBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>New Category</span>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div class="relative w-full max-w-md">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input type="text" id="catSearchInput" placeholder="Search categories..." class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <!-- Categories Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3.5 px-6">Category Name</th>
                  <th class="py-3.5 px-6">Description</th>
                  <th class="py-3.5 px-6 text-center">Assigned Products</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="categoriesTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="4" class="py-8 text-center text-slate-400">Loading categories...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    mainContainer.querySelector('#addCategoryBtn').onclick = () => this.openCategoryModal(null, businessId);

    const searchInput = mainContainer.querySelector('#catSearchInput');
    let debounce;
    searchInput.oninput = (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.loadCategories(businessId, e.target.value.trim());
      }, 300);
    };

    await this.loadCategories(businessId);
  },

  async loadCategories(businessId, search = '') {
    const tbody = document.getElementById('categoriesTbody');
    if (!tbody) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/categories`, { search });
      if (!res.success) return;

      const categories = res.data || [];
      if (categories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-400">No categories found.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      categories.forEach(cat => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/60 transition-colors';

        tr.innerHTML = `
          <td class="py-3.5 px-6 font-bold text-slate-900">${Config.escapeHtml(cat.name)}</td>
          <td class="py-3.5 px-6 text-slate-500">${Config.escapeHtml(cat.description || '—')}</td>
          <td class="py-3.5 px-6 text-center">
            <span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px]">${cat.product_count} items</span>
          </td>
          <td class="py-3.5 px-6 text-right space-x-1">
            <button class="btn-edit px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-semibold" title="Edit">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn-delete px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 font-semibold" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        `;

        tr.querySelector('.btn-edit').onclick = () => this.openCategoryModal(cat, businessId);
        tr.querySelector('.btn-delete').onclick = () => this.confirmDelete(cat, businessId);

        tbody.appendChild(tr);
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-rose-500">Failed to load categories.</td></tr>`;
    }
  },

  openCategoryModal(cat = null, businessId) {
    const isEdit = Boolean(cat);
    const container = document.createElement('div');
    container.className = 'space-y-4';

    container.innerHTML = `
      <form id="categoryForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Category Name *</label>
          <input type="text" id="fCatName" required value="${Config.escapeHtml(cat?.name || '')}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="e.g. Beverages, Electronics..." />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
          <textarea id="fCatDesc" rows="2" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" placeholder="Optional notes...">${Config.escapeHtml(cat?.description || '')}</textarea>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" id="btnCancelCat" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
            ${isEdit ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </form>
    `;

    Modal.open(isEdit ? 'Edit Category' : 'New Category', container, null, 'max-w-md');

    container.querySelector('#btnCancelCat').onclick = () => Modal.close();

    container.querySelector('#categoryForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        name: container.querySelector('#fCatName').value.trim(),
        description: container.querySelector('#fCatDesc').value.trim() || null
      };

      try {
        if (isEdit) {
          await Api.put(`/businesses/${businessId}/categories/${cat.id}`, payload);
          Toast.success('Category updated.');
        } else {
          await Api.post(`/businesses/${businessId}/categories`, payload);
          Toast.success('Category created.');
        }
        Modal.close();
        this.loadCategories(businessId);
      } catch (err) {
        // Handled by Api error toast
      }
    };
  },

  async confirmDelete(cat, businessId) {
    if (cat.product_count > 0) {
      Toast.error(`Cannot delete category "${cat.name}" because it still has ${cat.product_count} product(s) assigned.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      const res = await Api.delete(`/businesses/${businessId}/categories/${cat.id}`);
      if (res.success) {
        Toast.success('Category deleted.');
        this.loadCategories(businessId);
      }
    } catch {
      // Handled by Api error toast
    }
  }
};
