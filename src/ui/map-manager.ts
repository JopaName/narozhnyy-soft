/* Менеджер оффлайн-пакетов: список регионов, скачивание с прогрессом, удаление. */

import {
  abortDownload,
  deleteRegionTiles,
  downloadRegion,
  isDownloading,
  regionSizeEstimateMB,
  regionStoredTiles,
  regionTileCount,
  type RegionDef,
} from '../core/offline-maps';
import { el, nf, toast } from '../core/utils';

let regions: RegionDef[] = [];
let progressTimer: ReturnType<typeof setInterval> | null = null;

async function loadRegions(): Promise<RegionDef[]> {
  if (regions.length) return regions;
  try {
    const resp = await fetch('./regions.json');
    if (resp.ok) {
      const data = (await resp.json()) as { regions: RegionDef[] };
      if (Array.isArray(data.regions)) regions = data.regions;
    }
  } catch {
    /* ignore */
  }
  return regions;
}

function openModal(): void {
  el('map-modal').style.display = 'flex';
  void renderList();
}

function closeModal(): void {
  el('map-modal').style.display = 'none';
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

async function renderList(): Promise<void> {
  const list = await loadRegions();
  const container = el('map-region-list');
  if (!list.length) {
    container.innerHTML = '<div class="text-slate-500 text-center py-8">Список регионов недоступен</div>';
    return;
  }
  const rows = await Promise.all(
    list.map(async (region) => {
      const stored = await regionStoredTiles(region.id);
      const total = regionTileCount(region);
      const est = regionSizeEstimateMB(region);
      return { region, stored, total, est };
    }),
  );
  container.innerHTML = rows
    .map(
      (row) =>
        '<div class="card p-3" data-region="' +
        row.region.id +
        '">' +
        '<div class="flex items-center gap-3">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="font-bold text-white text-[13px] truncate">' +
        row.region.name +
        '</div>' +
        '<div class="text-[11px] text-slate-400 mt-0.5">' +
        (row.stored >= row.total
          ? 'Скачано полностью · ' + nf(row.est) + ' МБ'
          : 'Скачано ' + row.stored + ' из ' + nf(row.total) + ' тайлов · ~' + nf(row.est) + ' МБ') +
        '</div>' +
        '<div class="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2"><div class="h-full bg-amber-500 rounded-full" style="width:' +
        Math.min(100, Math.round((row.stored / Math.max(1, row.total)) * 100)) +
        '%"></div></div>' +
        '</div>' +
        '<div class="flex gap-1 shrink-0">' +
        (row.stored < row.total
          ? '<button class="btn btn-amber text-[12px] py-1 px-3 mp-download" data-region="' + row.region.id + '">Скачать</button>'
          : '') +
        (row.stored > 0
          ? '<button class="btn text-[12px] py-1 px-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 mp-delete" data-region="' + row.region.id + '">Удалить</button>'
          : '') +
        '</div>' +
        '</div>' +
        '</div>',
    )
    .join('');

  container.querySelectorAll('.mp-download').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.region!;
      void startDownload(id);
    });
  });
  container.querySelectorAll('.mp-delete').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.region!;
      if (!confirm('Удалить оффлайн-карту региона?')) return;
      void deleteRegionTiles(id).then(() => {
        toast('Пакет удалён');
        void renderList();
      });
    });
  });
}

async function startDownload(regionId: string): Promise<void> {
  if (isDownloading()) {
    toast('Скачивание уже идёт');
    return;
  }
  const region = regions.find((r) => r.id === regionId);
  if (!region) return;
  toast('Скачивание начато: ' + region.name);

  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => void renderList(), 800);

  const buttons = el('map-region-list').querySelectorAll<HTMLElement>('.mp-download');
  buttons.forEach((b) => {
    b.textContent = 'Стоп';
    b.className = 'btn btn-ghost text-[12px] py-1 px-3 mp-stop';
    b.onclick = () => {
      abortDownload();
      toast('Остановка скачивания…');
    };
  });

  try {
    const result = await downloadRegion(region, () => {
      /* прогресс обновляется таймером renderList */
    });
    toast('Готово: ' + result.downloaded + ' тайлов' + (result.failed ? ', ошибок: ' + result.failed : ''));
  } catch {
    toast('Скачивание прервано');
  }
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  await renderList();
}

export function setupMapManager(): void {
  el('btnMapManager').addEventListener('click', openModal);
  el('map-close').addEventListener('click', closeModal);
  el('map-modal').addEventListener('click', (e) => {
    if (e.target === el('map-modal')) closeModal();
  });
}
