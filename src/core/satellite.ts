/* Спутниковые снимки Esri World Imagery (бесплатные XYZ-тайлы).
 * Снимки: © Esri, Maxar, Earthstar Geographics and the GIS User Community. */

export const ESRI_ATTRIBUTION = '© Esri, Maxar, Earthstar Geographics';

const TILE_SIZE = 256;
const EQUATOR_METERS_PER_PIXEL = 156543.03392;

/** Тайловые координаты Web Mercator (дробные — для точного смещения точки внутри тайла) */
export function latLngToTile(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/** Метров в одном пикселе на широте lat при зуме z */
export function metersPerPixel(lat: number, z: number): number {
  return (EQUATOR_METERS_PER_PIXEL * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);
}

/** Пикселей на метр — это и есть наш масштаб канваса view.s */
export function pixelsPerMeter(lat: number, z: number): number {
  return 1 / metersPerPixel(lat, z);
}

const WORLD_METERS = 40075016.686;

/** Web Mercator: lat/lng → мировые метры */
export function mercatorToMeters(lat: number, lng: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  return { x: ((lng + 180) / 360) * WORLD_METERS, y: y * WORLD_METERS };
}

/** Web Mercator: мировые метры → lat/lng */
export function metersToMercator(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / WORLD_METERS) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / WORLD_METERS;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

/** Тайловый зум, соответствующий масштабу канваса view.s (px/м) на данной широте */
export function tileZoomForScale(pxPerM: number, lat: number): number {
  /* pxPerM = 2^z / (156543.03392·cos(lat)) → z = log2(pxPerM · 156543.03392 · cos(lat)) */
  return Math.round(Math.log2(pxPerM * EQUATOR_METERS_PER_PIXEL * Math.cos((lat * Math.PI) / 180)));
}

export interface SatelliteImage {
  dataUrl: string;
  /** Положение искомой точки в склеенном изображении, px */
  pixelX: number;
  pixelY: number;
  /** Масштаб канваса, px на метр */
  pxPerM: number;
}

/**
 * Скачивает сетку тайлов gridN×gridN вокруг точки и склеивает в одно изображение.
 */
export function downloadSatelliteImage(lat: number, lng: number, z: number, gridN = 4): Promise<SatelliteImage> {
  const { x, y } = latLngToTile(lat, lng, z);
  const startX = Math.floor(x) - Math.floor(gridN / 2);
  const startY = Math.floor(y) - Math.floor(gridN / 2);
  const pxPerM = pixelsPerMeter(lat, z);
  const pixelX = (x - startX) * TILE_SIZE;
  const pixelY = (y - startY) * TILE_SIZE;

  const canvas = document.createElement('canvas');
  canvas.width = gridN * TILE_SIZE;
  canvas.height = gridN * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no canvas ctx'));
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const jobs = Array.from({ length: gridN * gridN }, (_, i) => {
    const tx = startX + (i % gridN);
    const ty = startY + Math.floor(i / gridN);
    const url =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + ty + '/' + tx;
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          ctx.drawImage(img, (i % gridN) * TILE_SIZE, Math.floor(i / gridN) * TILE_SIZE);
        } catch {
          /* игнорируем проблемные тайлы */
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  });

  return Promise.all(jobs).then(() => ({
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    pixelX,
    pixelY,
    pxPerM,
  }));
}
