/**
 * axiosInterceptor.js — Centralized axios interceptor for token management
 * 
 * Handles:
 * - Attaching bearer token to all requests
 * - Retrying on 401 with token refresh flow
 * - Logging auth failures for debugging
 * - Safe error handling without throwing in interceptor
 */

import { base44 } from '@/api/base44Client';

let isRefreshing = false;
let refreshSubscribers = [];

/**
 * Subscribe to token refresh completion
 * Used to queue requests during refresh
 */
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all waiting requests that refresh is complete
 */
const onRefreshed = () => {
  refreshSubscribers.forEach(callback => callback());
  refreshSubscribers = [];
};

/**
 * Configure axios instance with auth interceptors
 * Call this once on app initialization
 */
export const setupAxiosInterceptors = (axiosInstance) => {
  /**
   * Request interceptor: attach bearer token
   */
  axiosInstance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('base44_access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      console.error('[Axios] Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  /**
   * Response interceptor: handle 401 with refresh retry
   */
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Only retry on 401 Unauthorized
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            // Attempt token refresh via Base44 SDK
            // This will internally use the refresh token if available
            await base44.auth.refreshToken?.();
            onRefreshed();
            isRefreshing = false;

            // Retry original request with new token
            const token = localStorage.getItem('base44_access_token');
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosInstance(originalRequest);
          } catch (refreshError) {
            console.error('[Axios] Token refresh failed:', refreshError);
            isRefreshing = false;
            refreshSubscribers = [];

            // Force logout on refresh failure
            console.warn('[Auth] Token refresh failed — initiating logout');
            base44.auth.logout();

            return Promise.reject(refreshError);
          }
        } else {
          // Refresh in progress — queue this request
          return new Promise((resolve) => {
            subscribeTokenRefresh(() => {
              const token = localStorage.getItem('base44_access_token');
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(axiosInstance(originalRequest));
            });
          });
        }
      }

      return Promise.reject(error);
    }
  );
};

/**
 * Get current auth state for debugging
 */
export const getAuthDebugInfo = () => ({
  hasToken: !!localStorage.getItem('base44_access_token'),
  isRefreshing,
  pendingRequests: refreshSubscribers.length,
  timestamp: new Date().toISOString(),
});