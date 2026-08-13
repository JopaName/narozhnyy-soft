/* Менеджер оффлайн-пакетов: список регионов, скачивание с прогрессом, удаление. */

import {
  abortDownload,
  deleteRegionTiles,
  downloadRegion,
  getDownloadState,
  isDownloading,
  loadRegions,
  regionSizeEstimateMB,
  regionStoredTiles,
  regionTileCount,
  type RegionDef,
} from '../core/offline-maps';
import { el, nf, toast } from '../core/utils';

function openModal(): void {
  el('map-modal').style.display = 'flex';
  void renderList();
}

function closeModal(): void {
  el('map-modal').style.display = 'none';
}

async function renderList(): Promise<void> {
  const list = await loadRegions();
  const container = el('map-region-list');
  if (!list.length) {
    container.innerHTML = '<div class="text-slate-500 text-center py-8">Список регионов недоступен</div>';
    return;
  }
  const state = getDownloadState();

  const rows = await Promise.all(
    list.map(async (region) => {
      const total = regionTileCount(region);
      const est = regionSizeEstimateMB(region);
      const downloading = state && state.regionId === region.id && state.running;
      const stored = downloading ? 0 : await regionStoredTiles(region.id);
      return { region, stored, total, est, downloading, state };
    }),
  );

  container.innerHTML = rows
    .map((row) => {
      const pct = row.downloading && row.state ? Math.round((row.state.done / Math.max(1, row.state.total)) * 100) : Math.min(100, Math.round((row.stored / Math.max(1, row.total)) * 100));
      const label = row.downloading
        ? 'Скачивание: ' + nf(row.state!.done) + ' из ' + nf(row.state!.total) + ' (' + pct + '%)'
        : row.stored >= row.total
          ? 'Скачано полностью · ' + nf(row.est) + ' МБ'
          : 'Скачано ' + row.stored + ' из ' + nf(row.total) + ' тайлов · ~' + nf(row.est) + ' МБ';
      const buttons = row.downloading
        ? '<button class="btn btn-ghost text-[12px] py-1 px-3 mp-stop" data-region="' + row.region.id + '">Стоп</button>'
        : (row.stored < row.total
            ? '<button class="btn btn-amber text-[12px] py-1 px-3 mp-download" data-region="' + row.region.id + '">' + (row.stored > 0 ? 'Докачать' : 'Скачать') + '</button>'
            : '') +
          (row.stored > 0 && !row.downloading
            ? '<button class="btn text-[12px] py-1 px-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 mp-delete" data-region="' + row.region.id + '">Удалить</button>'
            : '');
      return (
        '<div class="card p-3" data-region="' + row.region.id + '">' +
        '<div class="flex items-center gap-3">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="font-bold text-white text-[13px] truncate">' + row.region.name + '</div>' +
        '<div class="text-[11px] text-slate-400 mt-0.5">' + label + '</div>' +
        '<div class="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2"><div class="h-full bg-amber-500 rounded-full transition-all" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        '<div class="flex gap-1 shrink-0">' + buttons + '</div>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  container.querySelectorAll('.mp-download').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.region!;
      void startDownload(id);
    });
  });
  container.querySelectorAll('.mp-stop').forEach((b) => {
    b.addEventListener('click', () => {
      abortDownload();
      toast('Остановка скачивания…');
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
  const region = (await loadRegions()).find((r) => r.id === regionId);
  if (!region) return;
  toast('Скачивание начато: ' + region.name);

  let lastUi = 0;
  try {
    const result = await downloadRegion(region, (done, total) => {
      /* лёгкое обновление прогресс-бара, не чаще 2 раз/сек */
      const now = Date.now();
      if (now - lastUi < 500) return;
      lastUi = now;
      const bar = el('map-region-list').querySelector<HTMLElement>('[data-region="' + regionId + '"] .h-1\\.5 > div');
      if (bar) bar.style.width = Math.round((done / Math.max(1, total)) * 100) + '%';
      const lbl = el('map-region-list').querySelector<HTMLElement>('[data-region="' + regionId + '"] .text-\\[11px\\]');
      if (lbl) lbl.textContent = 'Скачивание: ' + nf(done) + ' из ' + nf(total);
    });
    toast('Готово: ' + result.downloaded + ' новых тайлов' + (result.skipped ? ', докачано ' + result.skipped : '') + (result.failed ? ', ошибок: ' + result.failed : ''));
  } catch {
    toast('Скачивание прервано');
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

export type { RegionDef };
