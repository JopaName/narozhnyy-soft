/* Мобильная навигация: шторка сайдбара и бэкдроп */

import { el } from '../core/utils';

export function closeDrawer(): void {
  el('sbBackdrop').classList.remove('sb-open');
  const aside = document.querySelector<HTMLElement>('#view-scheme aside');
  if (aside) aside.classList.remove('sb-open');
}

export function openDrawer(): void {
  el('sbBackdrop').classList.add('sb-open');
  const aside = document.querySelector<HTMLElement>('#view-scheme aside');
  if (aside) aside.classList.add('sb-open');
}

export function setupMobileNav(): void {
  el('btnSidebar').addEventListener('click', openDrawer);
  el('sbBackdrop').addEventListener('click', closeDrawer);
}
