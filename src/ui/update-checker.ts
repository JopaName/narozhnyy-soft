import { APP_VERSION, getLatestRelease, isNewer } from '../core/version';
import { el } from '../core/utils';

const REPO = 'JopaName/narozhnyy-soft';
let checked = false;

export function showUpdateBanner(info: { version: string; url: string; notes: string }): void {
  let banner = document.getElementById('update-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText =
      'position:fixed;bottom:16px;right:16px;z-index:80;background:#0f172a;border:1px solid #f59e0b;' +
      'border-radius:14px;padding:14px 16px;max-width:320px;box-shadow:0 10px 30px rgba(0,0,0,.5);' +
      'display:none;font-size:13px;color:#e2e8f0;';
    document.body.appendChild(banner);
  }
  banner.innerHTML =
    '<div style="font-weight:800;color:#fbbf24;margin-bottom:4px">⚡ Доступна новая версия ' +
    info.version +
    '</div>' +
    '<div style="color:#94a3b8;margin-bottom:10px;max-height:80px;overflow:hidden;font-size:12px">' +
    (info.notes || 'Скачайте и установите обновление.').slice(0, 220) +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
    '<button id="update-btn" style="flex:1;background:#f59e0b;color:#0f172a;font-weight:700;border:none;' +
    'border-radius:10px;padding:8px 12px;cursor:pointer">Скачать обновление</button>' +
    '<button id="update-close" style="background:#1e293b;color:#94a3b8;border:none;border-radius:10px;' +
    'padding:8px 10px;cursor:pointer">✕</button>' +
    '</div>';
  banner.style.display = 'block';
  const btn = banner.querySelector('#update-btn') as HTMLButtonElement;
  btn.onclick = () => {
    window.open(info.url, '_blank');
  };
  const close = banner.querySelector('#update-close') as HTMLButtonElement;
  close.onclick = () => {
    banner!.style.display = 'none';
  };
}

export async function checkForUpdates(): Promise<void> {
  if (checked) return;
  checked = true;
  try {
    const release = await getLatestRelease(REPO);
    if (!release || !release.version) return;
    if (isNewer(release.version, APP_VERSION)) {
      showUpdateBanner({ version: release.version, url: release.htmlUrl, notes: release.notes });
    }
  } catch {
    /* нет сети — пропускаем */
  }
}

export function startUpdateChecker(): void {
  setTimeout(checkForUpdates, 3000);
  /* Повторная проверка раз в 2 минуты */
  setInterval(() => {
    checked = false;
    checkForUpdates();
  }, 120000);
}

export { APP_VERSION };
