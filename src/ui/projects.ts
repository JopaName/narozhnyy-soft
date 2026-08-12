import { deleteImage } from '../core/db';
import {
  createProject,
  deleteProject,
  duplicateProject,
  getActiveId,
  listProjects,
  renameProject,
  setActive,
} from '../core/projects';
import { el, nf, toast } from '../core/utils';
import { openProjectRecord, resetToEmpty } from './app';

function closeModal(): void {
  el('pr-modal').style.display = 'none';
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
}

function renderList(): void {
  const list = listProjects();
  const activeId = getActiveId();
  const container = el('pr-list');

  if (!list.length) {
    container.innerHTML = '<div class="text-slate-500 text-center py-8">Нет проектов. Нажмите «+ Новый проект».</div>';
    return;
  }

  container.innerHTML = list
    .map((r) => {
      const isActive = r.id === activeId;
      return (
        '<div class="card p-3 flex items-center gap-3 group' +
        (isActive ? ' ring-1 ring-amber-500/50' : '') +
        '" data-id="' +
        r.id +
        '">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="font-bold text-white text-[13px] truncate">' +
        r.name +
        (isActive ? ' <span class="text-amber-400 text-[11px]">· открыт</span>' : '') +
        '</div>' +
        '<div class="text-[11px] text-slate-400 mt-0.5">' +
        r.panelCount +
        ' панелей · ' +
        nf(r.capKw, 2) +
        ' кВт · ' +
        fmtDate(r.updatedAt) +
        '</div>' +
        '</div>' +
        '<div class="flex gap-1 shrink-0">' +
        '<button class="btn btn-ghost text-[11px] py-1 px-2 pr-edit" data-id="' + r.id + '" title="Переименовать">✎</button>' +
        '<button class="btn btn-ghost text-[11px] py-1 px-2 pr-dup" data-id="' + r.id + '" title="Дублировать">⧉</button>' +
        '<button class="btn text-[11px] py-1 px-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 pr-del" data-id="' + r.id + '" title="Удалить">✕</button>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  container.querySelectorAll<HTMLElement>('.card[data-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const id = card.dataset.id!;
      setActive(id);
      closeModal();
      openProjectRecord(id);
    });
  });
  container.querySelectorAll('.pr-edit').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.id!;
      const rec = listProjects().find((r) => r.id === id);
      const name = prompt('Название проекта:', rec?.name || '');
      if (name === null) return;
      if (name) renameProject(id, name);
      renderList();
    });
  });
  container.querySelectorAll('.pr-dup').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.id!;
      duplicateProject(id);
      renderList();
      toast('Проект продублирован');
    });
  });
  container.querySelectorAll('.pr-del').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.id!;
      if (!confirm('Удалить проект безвозвратно?')) return;
      deleteProject(id);
      deleteImage(id);
      if (!getActiveId()) {
        createProject('Новый проект', {});
      }
      renderList();
      const activeId = getActiveId();
      closeModal();
      openProjectRecord(activeId);
    });
  });
}

export function openProjectsModal(): void {
  renderList();
  el('pr-modal').style.display = 'flex';
}

export function setupProjects(): void {
  el('btnProjects').addEventListener('click', openProjectsModal);
  el('pr-close').addEventListener('click', closeModal);
  el('pr-new').addEventListener('click', () => {
    const name = prompt('Название нового проекта:', 'Новый проект');
    if (name === null) return;
    createProject(name, {});
    closeModal();
    resetToEmpty(name);
  });
  el('pr-import').addEventListener('click', () => {
    closeModal();
    el<HTMLInputElement>('fileOpen').click();
  });
  el('pr-modal').addEventListener('click', (e) => {
    if (e.target === el('pr-modal')) closeModal();
  });
}
