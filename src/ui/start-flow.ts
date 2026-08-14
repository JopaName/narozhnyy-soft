/* Флоу создания проекта: экран приветствия → выбор «своя схема» / «найти на карте» */

import { el, toast } from '../core/utils';
import { setTool } from './toolbar';
import { startBlankScheme } from './app';
import { openMapMode } from './map-browser';

function closeModal(): void {
  el('start-modal').style.display = 'none';
}

export function setupStartFlow(): void {
  el('esCreate').addEventListener('click', () => {
    el('start-modal').style.display = 'flex';
  });
  el('start-close').addEventListener('click', closeModal);
  el('start-modal').addEventListener('click', (e) => {
    if (e.target === el('start-modal')) closeModal();
  });

  el('startScheme').addEventListener('click', () => {
    closeModal();
    startBlankScheme();
    setTool('roof');
    toast('Обведите контур крыши кликами по углам (двойной тап — замкнуть)');
  });

  el('startMap').addEventListener('click', () => {
    closeModal();
    startBlankScheme();
    void openMapMode(44.5583, 38.0749);
    toast('Введите адрес или двигайте карту — затем 📌 «Использовать место»');
  });
}
