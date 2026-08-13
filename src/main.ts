import './styles.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/cyrillic-800.css';

import { BATTERIES, CITIES, INVERTERS, loadEquipment, MONTH_FULL, PANELS } from './core/data';
import { events, R } from './core/runtime';
import { el, nf, toast } from './core/utils';
import { scheduleShading } from './domain/solar';
import { initCanvasResizeObserver, resizeCanvas } from './canvas/canvas';
import { setupCanvasInteractions } from './canvas/interactions';
import { draw } from './canvas/renderer';
import { bindInputs, setLoadSampleHook, syncInputs } from './ui/sidepanel';
import { bindProjectIO, bindTabs, loadSample, refresh, restoreActiveOrSample } from './ui/app';
import { buildToolbar, setTool } from './ui/toolbar';
import { loadOverrides, setupEditor } from './ui/equipment-editor';
import { startUpdateChecker } from './ui/update-checker';
import { APP_VERSION } from './core/version';
import { setupProjects } from './ui/projects';
import { setupBg } from './ui/bg';
import { state } from './core/state';
import { setupVariants, setOpenProjectHook } from './ui/variants';
import { openProjectRecord } from './ui/app';
import { storageInit } from './core/native-storage';
import { setupAddrAutocomplete } from './ui/addr-autocomplete';
import { setupMapManager } from './ui/map-manager';
import { setupMapButtons } from './ui/map-browser';
import { setupMobileNav } from './ui/mobile-nav';
import { setupContextMenu } from './ui/context-menu';

events.refresh = refresh;
events.draw = draw;
events.scheduleShading = scheduleShading;

function populateSelects(): void {
  el('selPanel').innerHTML = PANELS.map((p, i) => '<option value="' + i + '">' + p.name + ' · ' + nf(p.price) + ' ₽</option>').join('');
  el('selInv').innerHTML = INVERTERS.map((v, i) => '<option value="' + i + '">' + v.name + ' · ' + nf(v.price) + ' ₽</option>').join('');
  el('selBat').innerHTML = BATTERIES.map((b, i) => '<option value="' + i + '">' + b.name + ' · ' + nf(b.price) + ' ₽</option>').join('');
  el('selCity').innerHTML = Object.entries(CITIES)
    .map(([k, c]) => '<option value="' + k + '">' + c.name + '</option>')
    .join('');
  el('selShadeMonth').innerHTML = MONTH_FULL.map((m, i) => '<option value="' + i + '">' + m + '</option>').join('');
}

async function init(): Promise<void> {
  try {
    await storageInit();
    await loadEquipment();
    loadOverrides();
    populateSelects();
    buildToolbar();
    bindInputs();
    bindTabs();
    bindProjectIO();
    setupCanvasInteractions();
    initCanvasResizeObserver();
    setupEditor();
    setupProjects();
    setupBg();
    setupVariants();
    setupMapManager();
    setupMapButtons();
    setupAddrAutocomplete();
    setupMobileNav();
    setupContextMenu();
    setOpenProjectHook(openProjectRecord);
    setLoadSampleHook(loadSample);
    setTool('select');
    resizeCanvas();
    restoreActiveOrSample();
    refresh();
    draw();
    const badge = document.getElementById('appVersion');
    if (badge) badge.textContent = 'v' + APP_VERSION;
    startUpdateChecker();
    (window as unknown as Record<string, unknown>).__appState = state;
    (window as unknown as Record<string, unknown>).__R = R;
  } catch (err) {
    console.error(err);
    toast('Ошибка инициализации');
  }
}

init();
