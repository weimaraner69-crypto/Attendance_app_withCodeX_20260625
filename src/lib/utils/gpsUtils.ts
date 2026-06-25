export type Coords = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

const EARTH_RADIUS_METERS = 6371000;

export function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_METERS * c;

  return distance;
}

export function validateGps(
  currentCoords: Coords,
  shopLat: number,
  shopLon: number,
  radiusMeters: number
): { isValid: boolean; distance: number } {
  const distance = getDistance(
    currentCoords.latitude,
    currentCoords.longitude,
    shopLat,
    shopLon
  );

  return {
    isValid: distance <= radiusMeters,
    distance,
  };
}

export function getCurrentLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

export function watchLocation(
  callback: (coords: Coords) => void,
  onError: (error: Error) => void
): number {
  if (!navigator.geolocation) {
    onError(new Error('Geolocation is not supported by this browser.'));
    return -1;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => {
      onError(new Error(`Geolocation error: ${error.message}`));
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}
