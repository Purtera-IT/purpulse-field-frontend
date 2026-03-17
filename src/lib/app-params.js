const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

/**
 * Security: tokens passed via URL (e.g. ?access_token=...) are only honoured when
 * VITE_ALLOW_URL_TOKEN=true is set at build time. In production builds (NODE_ENV=production)
 * with the flag absent or false, URL tokens are silently ignored to prevent token leakage
 * via browser history, referrer headers, and server logs.
 *
 * For local dev / Cypress / staging, set:  VITE_ALLOW_URL_TOKEN=true
 */
const allowUrlTokens =
  import.meta.env.VITE_ALLOW_URL_TOKEN === 'true' ||
  import.meta.env.MODE !== 'production';

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		// Block URL-based access_token in production unless explicitly allowed
		if (paramName === 'access_token' && !allowUrlTokens) {
			console.warn(
				'[Purpulse] URL access_token ignored in production. ' +
				'Set VITE_ALLOW_URL_TOKEN=true at build time to allow this (dev/staging only).'
			);
			// Fall through to stored/default value — do NOT persist the URL token
		} else {
			storage.setItem(storageKey, searchParam);
			return searchParam;
		}
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
	}
}


export const appParams = {
	...getAppParams()
}