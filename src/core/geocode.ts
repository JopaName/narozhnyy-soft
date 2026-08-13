/* Геокодинг через Nominatim (OpenStreetMap) — бесплатно, без ключа.
 * Политика: максимум 1 запрос/сек; делаем 1-2 запроса на клик с фолбэком. */

export interface GeocodeResult {
  lat: number;
  lng: number;
  name: string;
}

/** Генерация фолбэк-запросов: убираем литеру дома («44б» → «44»), затем номер целиком */
export function buildGeocodeQueries(query: string): string[] {
  const attempts: string[] = [query];
  const letterStripped = query.replace(/(\d+)[а-яёa-z](?=\s|,|$)/gi, '$1');
  if (letterStripped !== query) attempts.push(letterStripped);
  const noNumber = query.replace(/\s*\d+\s*[а-яёa-z]?\s*$/i, '').trim();
  if (noNumber && noNumber !== query && !attempts.includes(noNumber)) attempts.push(noNumber);
  return attempts;
}

async function fetchOnce(query: string): Promise<GeocodeResult | null> {
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

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  for (const q of buildGeocodeQueries(query)) {
    const result = await fetchOnce(q);
    if (result) return result;
  }
  return null;
}
