/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { PURPULSE_PERM_LOCATION_KEY } from '@/lib/locationConsent';

describe('travelGps', () => {
  const origNav = globalThis.navigator;

  afterEach(() => {
    vi.resetModules();
    localStorage.clear();
    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      configurable: true,
      writable: true,
    });
  });

  it('returns null when location consent is not granted', async () => {
    localStorage.removeItem(PURPULSE_PERM_LOCATION_KEY);
    vi.stubGlobal('navigator', {
      ...origNav,
      geolocation: {
        getCurrentPosition: vi.fn(() => {
          throw new Error('should not be called');
        }),
      },
    });
    const { getTravelStartLocationOptional } = await import('@/lib/travelGps');
    await expect(getTravelStartLocationOptional()).resolves.toBeNull();
  });

  it('returns coords when consent is granted and geolocation succeeds', async () => {
    localStorage.setItem(PURPULSE_PERM_LOCATION_KEY, 'granted');
    vi.stubGlobal('navigator', {
      ...origNav,
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: { latitude: 37.77, longitude: -122.42, accuracy: 8.2 },
          });
        }),
      },
    });
    const { getTravelStartLocationOptional } = await import('@/lib/travelGps');
    await expect(getTravelStartLocationOptional()).resolves.toEqual({
      lat: 37.77,
      lon: -122.42,
      accuracy_m: 8,
    });
  });

  it('returns null when geolocation invokes error callback', async () => {
    localStorage.setItem(PURPULSE_PERM_LOCATION_KEY, 'granted');
    vi.stubGlobal('navigator', {
      ...origNav,
      geolocation: {
        getCurrentPosition: vi.fn((_ok, err) => {
          err({ code: 1, message: 'User denied' });
        }),
      },
    });
    const { getTravelStartLocationOptional } = await import('@/lib/travelGps');
    await expect(getTravelStartLocationOptional()).resolves.toBeNull();
  });
});
