import { describe, expect, it } from 'vitest';

import { getDistance, validateGps } from './gpsUtils';

describe('GPS validation', () => {
  it('returns zero for identical coordinates', () => {
    expect(getDistance(35.681236, 139.767125, 35.681236, 139.767125)).toBe(0);
  });

  it('accepts a point at the configured boundary and rejects a smaller radius', () => {
    const current = { latitude: 35.681236, longitude: 139.768125, accuracy: 5 };
    const distance = getDistance(
      current.latitude,
      current.longitude,
      35.681236,
      139.767125
    );

    expect(validateGps(current, 35.681236, 139.767125, distance).isValid).toBe(true);
    expect(validateGps(current, 35.681236, 139.767125, distance - 0.01).isValid).toBe(
      false
    );
  });
});
