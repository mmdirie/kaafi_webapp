// REST API Client Wrapper
import { Config } from './config.js';
import { Toast } from './components/toast.js';

export const Api = {
  async request(endpoint, options = {}) {
    const baseUrl = Config.getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = Config.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        Config.clearSession();
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('Your session has expired. Please log in again.');
      }

      // Handle CSV downloads or file responses
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/csv')) {
        const blob = await response.blob();
        return { success: true, blob, isBlob: true };
      }

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = json.error?.message || json.message || `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.code = json.error?.code || 'API_ERROR';
        err.status = response.status;
        throw err;
      }

      return json;
    } catch (err) {
      // Don't show toast for abort errors or auth expiry
      if (err.name !== 'AbortError' && !err.message.includes('session has expired')) {
        Toast.error(err.message);
      }
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const url = new URL(endpoint, window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });
    const pathWithQuery = url.pathname + url.search;
    return this.request(pathWithQuery, { method: 'GET' });
  },

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
};
