import { deleteImage, getImage, setImage } from '../core/db';
import { events, R } from '../core/runtime';
import { state } from '../core/state';
import { el, nf, toast } from '../core/utils';
import { getActiveId, flushSave } from '../core/projects';
import { geocodeAddress } from '../core/geocode';
import { downloadSatelliteImage } from '../core/satellite';
import { cv, dpr } from '../canvas/canvas';

let bgImg: HTMLImageElement | null = null;

export function getBgImage(): HTMLImageElement | null {
  return bgImg;
}

export function loadBgForProject(projectId: string): void {
  bgImg = null;
  if (!projectId) return;
  getImage(projectId).then((dataUrl) => {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      bgImg = img;
      events.draw();
    };
    img.src = dataUrl;
  });
}

function downscale(dataUrl: string, maxDim = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) {
        reject(new Error('no ctx'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('img error'));
    img.src = dataUrl;
  });
}

export function importBgFile(file: File): void {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const dataUrl = await downscale(String(reader.result));
      const projectId = getActiveId();
      if (!projectId) {
        toast('Сначала создайте или откройте проект');
        return;
      }
      await setImage(projectId, dataUrl);
      const img = new Image();
      img.onload = () => {
        bgImg = img;
        state.bg.visible = true;
        state.bg.opacity = 0.5;
        state.bg.calibS = 0;
        flushSave();
        syncBgUI();
        events.draw();
        toast('Фото загружено. Нажмите «📏 Калибровка» и укажите известную длину');
      };
      img.src = dataUrl;
    } catch {
      toast('Не удалось загрузить изображение');
    }
  };
  reader.onerror = () => toast('Ошибка чтения файла');
  reader.readAsDataURL(file);
}

export function startCalibration(): void {
  if (!bgImg) {
    toast('Сначала загрузите фото крыши');
    return;
  }
  R.calib = { stage: 1, p1: null };
  toast('Кликните ПЕРВУЮ точку известной длины (например, угол стены)');
}

/* Вызывается из interactions при клике в режиме калибровки */
export function handleCalibClick(clientX: number, clientY: number): void {
  if (!R.calib) return;
  const rect = el('cv').getBoundingClientRect();
  const pt = { x: clientX - rect.left, y: clientY - rect.top };
  if (R.calib.stage === 1) {
    R.calib.p1 = pt;
    R.calib.stage = 2;
    toast('Теперь кликните ВТОРУЮ точку этой же длины');
    events.draw();
    return;
  }
  const p1 = R.calib.p1;
  R.calib = null;
  if (!p1) return;
  const dist = Math.hypot(pt.x - p1.x, pt.y - p1.y);
  if (dist < 10) {
    toast('Точки слишком близко — отмените (Esc) и повторите');
    return;
  }
  const answer = prompt('Длина этой линии в метрах:', '6');
  if (answer === null) return;
  const meters = parseFloat(answer.replace(',', '.'));
  if (!isFinite(meters) || meters <= 0) {
    toast('Калибровка отменена: некорректная длина');
    return;
  }
  state.bg.calibS = dist / meters;
  R.view.s = state.bg.calibS;
  R.view.ox = p1.x;
  R.view.oy = p1.y;
  flushSave();
  events.draw();
  toast('Масштаб откалиброван: 1 м = ' + nf(state.bg.calibS, 0) + ' px');
}

export function removeBg(): void {
  const projectId = getActiveId();
  bgImg = null;
  state.bg.visible = false;
  state.bg.calibS = 0;
  state.bg.addr = '';
  if (projectId) deleteImage(projectId);
  flushSave();
  syncBgUI();
  events.draw();
  toast('Фон удалён');
}

/* ═══ СПУТНИК ═══ */

export async function loadSatelliteFromAddress(address: string, zoom: number): Promise<void> {
  const projectId = getActiveId();
  if (!projectId) {
    toast('Сначала создайте или откройте проект');
    return;
  }
  toast('Ищу адрес…');
  const geo = await geocodeAddress(address);
  if (!geo) {
    toast('Адрес не найден — уточните запрос');
    return;
  }
  toast('Скачиваю спутниковый снимок…');
  try {
    const sat = await downloadSatelliteImage(geo.lat, geo.lng, zoom);
    await setImage(projectId, sat.dataUrl);
    const img = new Image();
    img.onload = () => {
      bgImg = img;
      state.bg.visible = true;
      state.bg.opacity = 0.6;
      state.bg.calibS = sat.pxPerM;
      state.bg.addr = geo.name;
      flushSave();
      syncBgUI();
      /* Автокалибровка: масштаб из зума/широты, точка поиска — в центр канваса */
      const W = cv.width / dpr || 800;
      const H = cv.height / dpr || 500;
      const worldX = sat.pixelX / sat.pxPerM;
      const worldY = sat.pixelY / sat.pxPerM;
      R.view.s = sat.pxPerM;
      R.view.ox = W / 2 - worldX * R.view.s;
      R.view.oy = H / 2 - worldY * R.view.s;
      events.draw();
      toast('Снимок загружен — обводите крышу инструментом «Крыша» (R)');
    };
    img.src = sat.dataUrl;
  } catch {
    toast('Не удалось скачать снимок — проверьте интернет');
  }
}

export function setupBg(): void {
  el<HTMLInputElement>('fileBg').onchange = (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (f) importBgFile(f);
  };
  el('btnBgLoad').onclick = () => el<HTMLInputElement>('fileBg').click();
  el('btnBgCal').onclick = startCalibration;
  el('btnBgRemove').onclick = removeBg;
  el('btnSat').onclick = () => {
    const addr = el<HTMLInputElement>('inAddr').value.trim();
    if (!addr) {
      toast('Введите адрес или название места');
      return;
    }
    const zoom = parseInt(el<HTMLSelectElement>('selSatZoom').value, 10) || 19;
    void loadSatelliteFromAddress(addr, zoom);
  };
  el<HTMLInputElement>('chkBg').onchange = (e) => {
    state.bg.visible = (e.target as HTMLInputElement).checked;
    flushSave();
    events.draw();
  };
  el('rngBgOpacity').addEventListener('input', (e) => {
    state.bg.opacity = Number((e.target as HTMLInputElement).value) / 100;
    el('valBgOpacity').textContent = Math.round(state.bg.opacity * 100) + '%';
    flushSave();
    events.draw();
  });
}

export function syncBgUI(): void {
  el<HTMLInputElement>('chkBg').checked = state.bg.visible;
  el<HTMLInputElement>('rngBgOpacity').value = String(Math.round(state.bg.opacity * 100));
  el('valBgOpacity').textContent = Math.round(state.bg.opacity * 100) + '%';
  el<HTMLInputElement>('inAddr').value = state.bg.addr;
}