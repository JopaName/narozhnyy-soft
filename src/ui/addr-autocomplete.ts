/* Автоподсказка адреса: оффлайн-индекс улиц региона + онлайн Nominatim. */

import { el } from '../core/utils';
import { loadRegions } from '../core/offline-maps';
import { openMapMode } from './map-browser';

interface StreetItem {
  name: string;
  lat: number;
  lng: number;
}

interface StreetIndex {
  city: string;
  count: number;
  streets: StreetItem[];
}

let indexesCache: StreetIndex[] | null = null;
let indexesPromise: Promise<StreetIndex[]> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Загружает все street-индексы, перечисленные в regions.json */
function loadIndexes(): Promise<StreetIndex[]> {
  if (indexesCache) return Promise.resolve(indexesCache);
  if (indexesPromise) return indexesPromise;
  indexesPromise = loadRegions()
    .then(async (regions) => {
      const files = regions.filter((r) => r.streetsFile).map((r) => r.streetsFile as string);
      const result: StreetIndex[] = [];
      for (const file of files) {
        try {
          const resp = await fetch('./' + file);
          if (!resp.ok) continue;
          const data = (await resp.json()) as StreetIndex;
          if (data && Array.isArray(data.streets) && data.streets.length) result.push(data);
        } catch {
          /* ignore */
        }
      }
      indexesCache = result;
      return result;
    })
    .catch(() => []);
  return indexesPromise;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').trim();
}

interface Suggestion {
  text: string;
  lat: number;
  lng: number;
}

function showDropdown(items: Suggestion[]): void {
  const dd = el('addrSuggest');
  if (!items.length) {
    dd.style.display = 'none';
    return;
  }
  dd.innerHTML = items
    .map(
      (s, i) =>
        '<div class="addr-suggest-item" data-idx="' +
        i +
        '" style="padding:7px 10px;font-size:12px;color:#e2e8f0;cursor:pointer;border-radius:8px">' +
        s.text +
        '</div>',
    )
    .join('');
  dd.style.display = 'block';
  dd.querySelectorAll('.addr-suggest-item').forEach((node) => {
    node.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const idx = Number((node as HTMLElement).dataset.idx);
      pickSuggestion(items[idx]);
    });
  });
}

function pickSuggestion(s: Suggestion): void {
  el<HTMLInputElement>('inAddr').value = s.text;
  el('addrSuggest').style.display = 'none';
  void openMapMode(s.lat, s.lng);
}

async function runSuggestions(query: string): Promise<void> {
  const q = normalize(query);
  if (q.length < 2) {
    el('addrSuggest').style.display = 'none';
    return;
  }
  const results: Suggestion[] = [];

  /* Оффлайн: улицы из пакетов регионов */
  const indexes = await loadIndexes();
  for (const idx of indexes) {
    const matched = idx.streets
      .filter((s) => normalize(s.name).startsWith(q) || normalize(s.name).includes(q))
      .slice(0, 4);
    matched.forEach((s) => results.push({ text: idx.city + ', ' + s.name, lat: s.lat, lng: s.lng }));
    if (results.length >= 6) break;
  }

  /* Онлайн: Nominatim (добавляем к оффлайн-результатам) */
  try {
    const resp = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=4&accept-language=ru&q=' +
        encodeURIComponent(query),
    );
    if (resp.ok) {
      const data = (await resp.json()) as Array<Record<string, unknown>>;
      for (const item of data) {
        const lat = parseFloat(String(item.lat));
        const lng = parseFloat(String(item.lon));
        if (!isFinite(lat) || !isFinite(lng)) continue;
        const text = String(item.display_name || '');
        if (!results.some((r) => r.text === text)) {
          results.push({ text, lat, lng });
        }
      }
    }
  } catch {
    /* нет сети — только оффлайн-подсказки */
  }

  showDropdown(results.slice(0, 8));
}

export function setupAddrAutocomplete(): void {
  const input = el<HTMLInputElement>('inAddr');
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runSuggestions(input.value);
    }, 350);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      el('addrSuggest').style.display = 'none';
    }
    if (e.key === 'Enter') {
      el('addrSuggest').style.display = 'none';
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      el('addrSuggest').style.display = 'none';
    }, 150);
  });
  document.addEventListener('click', (e) => {
    const dd = el('addrSuggest');
    const target = e.target as HTMLElement;
    if (!input.contains(target) && !dd.contains(target)) dd.style.display = 'none';
  });
}
