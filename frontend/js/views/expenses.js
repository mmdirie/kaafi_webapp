// Business Expenses View Controller
import { Api } from '../api.js';
import { State } from '../state.js';
import { Config } from '../config.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const ExpensesView = {
  currentPage: 1,
  limit: 20,
  selectedCategory: '',
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
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Business Expenses</h1>
            <p class="text-xs text-slate-500 mt-1">Track operating expenditures, rent, utilities, and vendor payouts</p>
          </div>
          <button id="addExpenseBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Record New Expense</span>
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <select id="expenseCategoryFilter" class="w-full sm:w-56 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500">
            <option value="">All Expense Categories</option>
            <option value="Rent & Facilities">Rent & Facilities</option>
            <option value="Utilities">Utilities</option>
            <option value="Internet & Telecom">Internet & Telecom</option>
            <option value="Marketing & Ads">Marketing & Ads</option>
            <option value="Salaries & Wages">Salaries & Wages</option>
            <option value="Supplies & Equipment">Supplies & Equipment</option>
            <option value="Logistics & Delivery">Logistics & Delivery</option>
            <option value="Other">Other Miscellaneous</option>
          </select>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <input type="date" id="expenseStartDate" class="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500" title="Start date" />
            <span class="text-slate-400 text-xs">to</span>
            <input type="date" id="expenseEndDate" class="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500" title="End date" />
          </div>

          <div class="sm:ml-auto font-bold text-xs text-slate-700">
            <span>Filtered Total: </span>
            <span id="expensesSumDisplay" class="font-mono text-sm font-extrabold text-rose-600">$0.00</span>
          </div>
        </div>

        <!-- Expenses Table -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                  <th class="py-3.5 px-6">Expense Date</th>
                  <th class="py-3.5 px-6">Category</th>
                  <th class="py-3.5 px-6">Description</th>
                  <th class="py-3.5 px-6">Recorded By</th>
                  <th class="py-3.5 px-6 text-right">Amount</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="expensesTbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="6" class="py-8 text-center text-slate-400">Loading expenses...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    mainContainer.querySelector('#addExpenseBtn').onclick = () => this.openExpenseModal(null, businessId, currency);

    const catFilter = mainContainer.querySelector('#expenseCategoryFilter');
    const startFilter = mainContainer.querySelector('#expenseStartDate');
    const endFilter = mainContainer.querySelector('#expenseEndDate');

    catFilter.onchange = (e) => {
      this.selectedCategory = e.target.value;
      this.loadExpenses(businessId, currency);
    };

    startFilter.onchange = (e) => {
      this.startDate = e.target.value;
      this.loadExpenses(businessId, currency);
    };

    endFilter.onchange = (e) => {
      this.endDate = e.target.value;
      this.loadExpenses(businessId, currency);
    };

    await this.loadExpenses(businessId, currency);
  },

  async loadExpenses(businessId, currency) {
    const tbody = document.getElementById('expensesTbody');
    const sumDisplay = document.getElementById('expensesSumDisplay');
    if (!tbody) return;

    try {
      const res = await Api.get(`/businesses/${businessId}/expenses`, {
        page: this.currentPage,
        limit: this.limit,
        category: this.selectedCategory,
        startDate: this.startDate,
        endDate: this.endDate
      });

      if (!res.success) return;

      const expenses = res.data || [];
      const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

      if (sumDisplay) {
        sumDisplay.textContent = Config.formatCurrency(totalAmount, currency);
      }

      if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No expenses recorded for this period.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      expenses.forEach(exp => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/60 transition-colors';

        tr.innerHTML = `
          <td class="py-3.5 px-6 text-slate-500 font-mono text-[11px]">${Config.formatDate(exp.expense_date)}</td>
          <td class="py-3.5 px-6">
            <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">${Config.escapeHtml(exp.category)}</span>
          </td>
          <td class="py-3.5 px-6 font-medium text-slate-800">${Config.escapeHtml(exp.description)}</td>
          <td class="py-3.5 px-6 text-slate-500">${Config.escapeHtml(exp.recorded_by_name || 'Staff')}</td>
          <td class="py-3.5 px-6 text-right font-mono font-bold text-rose-600">${Config.formatCurrency(exp.amount, currency)}</td>
          <td class="py-3.5 px-6 text-right space-x-1">
            <button class="btn-edit px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-semibold" title="Edit">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn-delete px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 font-semibold" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        `;

        tr.querySelector('.btn-edit').onclick = () => this.openExpenseModal(exp, businessId, currency);
        tr.querySelector('.btn-delete').onclick = () => this.confirmDelete(exp, businessId, currency);

        tbody.appendChild(tr);
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-rose-500">Failed to load expenses.</td></tr>`;
    }
  },

  openExpenseModal(exp = null, businessId, currency) {
    const isEdit = Boolean(exp);
    const container = document.createElement('div');
    container.className = 'space-y-4';

    const defaultDate = exp ? exp.expense_date : new Date().toISOString().slice(0, 10);

    container.innerHTML = `
      <form id="expenseForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Expense Category *</label>
          <select id="fExpCat" required class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500">
            <option value="Rent & Facilities" ${exp?.category === 'Rent & Facilities' ? 'selected' : ''}>Rent & Facilities</option>
            <option value="Utilities" ${exp?.category === 'Utilities' ? 'selected' : ''}>Utilities (Power, Water)</option>
            <option value="Internet & Telecom" ${exp?.category === 'Internet & Telecom' ? 'selected' : ''}>Internet & Telecom</option>
            <option value="Marketing & Ads" ${exp?.category === 'Marketing & Ads' ? 'selected' : ''}>Marketing & Ads</option>
            <option value="Salaries & Wages" ${exp?.category === 'Salaries & Wages' ? 'selected' : ''}>Salaries & Wages</option>
            <option value="Supplies & Equipment" ${exp?.category === 'Supplies & Equipment' ? 'selected' : ''}>Supplies & Equipment</option>
            <option value="Logistics & Delivery" ${exp?.category === 'Logistics & Delivery' ? 'selected' : ''}>Logistics & Delivery</option>
            <option value="Other" ${exp?.category === 'Other' ? 'selected' : ''}>Other Miscellaneous</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Description / Memo *</label>
          <input type="text" id="fExpDesc" required value="${Config.escapeHtml(exp?.description || '')}" placeholder="e.g. Monthly store lease payment" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Amount (${currency}) *</label>
            <input type="number" id="fExpAmount" required min="0.01" step="0.01" value="${exp?.amount ?? ''}" placeholder="0.00" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Expense Date *</label>
            <input type="date" id="fExpDate" required value="${defaultDate}" class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" id="btnCancelExp" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
            ${isEdit ? 'Save Changes' : 'Record Expense'}
          </button>
        </div>
      </form>
    `;

    Modal.open(isEdit ? 'Edit Expense' : 'Record Expense', container, null, 'max-w-md');

    container.querySelector('#btnCancelExp').onclick = () => Modal.close();

    container.querySelector('#expenseForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        category: container.querySelector('#fExpCat').value,
        description: container.querySelector('#fExpDesc').value.trim(),
        amount: parseFloat(container.querySelector('#fExpAmount').value) || 0,
        expense_date: container.querySelector('#fExpDate').value
      };

      try {
        if (isEdit) {
          await Api.put(`/businesses/${businessId}/expenses/${exp.id}`, payload);
          Toast.success('Expense updated.');
        } else {
          await Api.post(`/businesses/${businessId}/expenses`, payload);
          Toast.success('Expense recorded.');
        }
        Modal.close();
        this.loadExpenses(businessId, currency);
      } catch {
        // Handled by api error toast
      }
    };
  },

  async confirmDelete(exp, businessId, currency) {
    if (!confirm(`Are you sure you want to delete this expense: "${exp.description}"?`)) return;

    try {
      const res = await Api.delete(`/businesses/${businessId}/expenses/${exp.id}`);
      if (res.success) {
        Toast.success('Expense deleted.');
        this.loadExpenses(businessId, currency);
      }
    } catch {
      // Handled by api error toast
    }
  }
};
