// Application Configuration and Client Initialization
export const Config = {
  getApiBaseUrl() {
    return localStorage.getItem('kaafi_api_base_url') || '/api';
  },

  setApiBaseUrl(url) {
    localStorage.setItem('kaafi_api_base_url', url);
  },

  getSupabaseConfig() {
    return {
      url: localStorage.getItem('kaafi_supabase_url') || '',
      anonKey: localStorage.getItem('kaafi_supabase_key') || ''
    };
  },

  setSupabaseConfig(url, anonKey) {
    localStorage.setItem('kaafi_supabase_url', url);
    localStorage.setItem('kaafi_supabase_key', anonKey);
  },

  getAccessToken() {
    return localStorage.getItem('kaafi_access_token');
  },

  setSession(token, refreshToken, user) {
    if (token) localStorage.setItem('kaafi_access_token', token);
    else localStorage.removeItem('kaafi_access_token');

    if (refreshToken) localStorage.setItem('kaafi_refresh_token', refreshToken);
    else localStorage.removeItem('kaafi_refresh_token');

    if (user) localStorage.setItem('kaafi_user', JSON.stringify(user));
    else localStorage.removeItem('kaafi_user');
  },

  clearSession() {
    localStorage.removeItem('kaafi_access_token');
    localStorage.removeItem('kaafi_refresh_token');
    localStorage.removeItem('kaafi_user');
    localStorage.removeItem('kaafi_active_business_id');
  },

  formatCurrency(amount, currency = 'USD') {
    const num = Number(amount) || 0;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch {
      return `${currency} ${num.toFixed(2)}`;
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return String(dateStr);
    }
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
