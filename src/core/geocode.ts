/* Геокодинг через Nominatim (OpenStreetMap) — бесплатно, без ключа.
 * Политика: максимум 1 запрос/сек; мы делаем один запрос на клик. */

export interface GeocodeResult {
  lat: number;
  lng: number;
  name: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&q=' +
    encodeURIComponent(query);
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as Array<Record<string, unknown>>;
    const first = data && data[0];
    if (!first) return null;
    const lat = parseFloat(String(first.lat));
    const lng = parseFloat(String(first.lon));
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat, lng, name: String(first.display_name || query) };
  } catch {
    return null;
  }
}
