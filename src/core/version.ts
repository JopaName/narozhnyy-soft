export const APP_VERSION = '1.3.0';

export interface ReleaseInfo {
  tag: string;
  version: string;
  apkUrl: string;
  htmlUrl: string;
  notes: string;
}

export function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((n) => {
      const parsed = parseInt(n, 10);
      return isNaN(parsed) ? 0 : parsed;
    });
}

export function isNewer(remote: string, current: string): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

export function getLatestRelease(repo: string): Promise<ReleaseInfo | null> {
  return fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: Record<string, unknown> | null) => {
      if (!data) return null;
      const assets = Array.isArray(data.assets) ? (data.assets as Array<Record<string, unknown>>) : [];
      const apk = assets.find((a) => String(a.name || '').endsWith('.apk'));
      return {
        tag: String(data.tag_name || ''),
        version: String(data.tag_name || '').replace(/^v/i, ''),
        apkUrl: String((apk && apk.browser_download_url) || ''),
        htmlUrl: String(data.html_url || ''),
        notes: String(data.body || ''),
      };
    })
    .catch(() => null);
}
