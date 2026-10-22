// Authentication View & Controller
import { Config } from '../config.js';
import { State } from '../state.js';
import { Api } from '../api.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

export const AuthView = {
  renderAuthModal() {
    const supabaseConfig = Config.getSupabaseConfig();

    const container = document.createElement('div');
    container.className = 'p-2 space-y-5';

    container.innerHTML = `
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-xl shadow-md">
          KB
        </div>
        <h2 class="text-2xl font-extrabold text-slate-800">Welcome to Kaafi Business</h2>
        <p class="text-sm text-slate-500">Sign in to your business management workspace</p>
      </div>

      <!-- Login Form -->
      <form id="loginForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
          <input type="email" id="loginEmail" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="name@business.com" />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider">Password</label>
            <button type="button" id="forgotPasswordBtn" class="text-xs font-medium text-blue-600 hover:text-blue-800 focus:outline-none">Forgot password?</button>
          </div>
          <input type="password" id="loginPassword" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="••••••••" />
        </div>

        <button type="submit" id="loginSubmitBtn" class="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-colors flex items-center justify-center gap-2">
          <span>Sign In</span>
        </button>
      </form>

      <div class="relative flex py-2 items-center">
        <div class="flex-grow border-t border-slate-200"></div>
        <span class="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase">Configuration</span>
        <div class="flex-grow border-t border-slate-200"></div>
      </div>

      <!-- Supabase Connection Config Accordion -->
      <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/70 text-xs">
        <details class="cursor-pointer">
          <summary class="font-semibold text-slate-700 select-none flex items-center justify-between">
            <span>Supabase Connection Settings</span>
            <span class="text-blue-600 font-normal">Edit</span>
          </summary>
          <div class="mt-3 space-y-2 pt-2 border-t border-slate-200">
            <div>
              <label class="block font-medium text-slate-600 mb-0.5">Supabase URL</label>
              <input type="url" id="configSupabaseUrl" value="${Config.escapeHtml(supabaseConfig.url)}" placeholder="https://xyzcompany.supabase.co" class="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block font-medium text-slate-600 mb-0.5">Supabase Anon Key</label>
              <input type="text" id="configSupabaseKey" value="${Config.escapeHtml(supabaseConfig.anonKey)}" placeholder="eyJhbGciOi..." class="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-blue-500" />
            </div>
            <button type="button" id="saveConfigBtn" class="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-xs">Save Settings</button>
          </div>
        </details>
      </div>
    `;

    const { card } = Modal.open('Authentication', container, null, 'max-w-md');

    // Attach form handler
    const loginForm = container.querySelector('#loginForm');
    const submitBtn = container.querySelector('#loginSubmitBtn');
    const forgotBtn = container.querySelector('#forgotPasswordBtn');
    const saveConfigBtn = container.querySelector('#saveConfigBtn');

    saveConfigBtn.onclick = () => {
      const url = container.querySelector('#configSupabaseUrl').value.trim();
      const key = container.querySelector('#configSupabaseKey').value.trim();
      Config.setSupabaseConfig(url, key);
      Toast.success('Supabase configuration saved.');
    };

    forgotBtn.onclick = () => {
      this.renderForgotPasswordModal();
    };

    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const email = container.querySelector('#loginEmail').value.trim();
      const password = container.querySelector('#loginPassword').value;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Signing in...</span>
      `;

      try {
        await this.handleLogin(email, password);
        Modal.close();
        Toast.success('Signed in successfully!');
      } catch (err) {
        Toast.error(err.message || 'Login failed. Please verify credentials.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In</span>`;
      }
    };
  },

  async handleLogin(email, password) {
    const config = Config.getSupabaseConfig();
    let accessToken = null;
    let refreshToken = null;
    let user = null;

    // Use Supabase client if configured
    if (window.supabase && config.url && config.anonKey) {
      const client = window.supabase.createClient(config.url, config.anonKey);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      accessToken = data.session.access_token;
      refreshToken = data.session.refresh_token;
      user = data.user;
    } else {
      // In local dev/mock or direct API mode, test token or direct auth call
      const res = await fetch(`${Config.getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        accessToken = json.data?.token || json.token;
        user = json.data?.user || json.user;
      } else {
        throw new Error('Please configure Supabase URL and Anon Key in Settings to connect.');
      }
    }

    Config.setSession(accessToken, refreshToken, user);

    // Fetch user profile and business memberships from backend
    const meRes = await Api.get('/auth/me');
    if (meRes.success) {
      State.setUser(meRes.data.user, meRes.data.profile);
      State.setBusinesses(meRes.data.businesses);
    }
  },

  renderForgotPasswordModal() {
    const container = document.createElement('div');
    container.className = 'p-2 space-y-4';
    container.innerHTML = `
      <p class="text-sm text-slate-600">Enter your email address and we will send you a password reset link.</p>
      <form id="forgotForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
          <input type="email" id="forgotEmail" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500" placeholder="name@business.com" />
        </div>
        <button type="submit" class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">Send Reset Email</button>
      </form>
    `;

    Modal.open('Reset Password', container, null, 'max-w-md');

    container.querySelector('#forgotForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = container.querySelector('#forgotEmail').value.trim();
      const config = Config.getSupabaseConfig();

      if (window.supabase && config.url && config.anonKey) {
        const client = window.supabase.createClient(config.url, config.anonKey);
        const { error } = await client.auth.resetPasswordForEmail(email);
        if (error) {
          Toast.error(error.message);
          return;
        }
      }
      Toast.success('Password reset email dispatched!');
      Modal.close();
    };
  }
};
