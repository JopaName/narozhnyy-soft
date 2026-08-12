# Правила ведения проекта Narozhnyy Soft (Solar Studio)

**Продукт:** офлайн Android-приложение (APK). Web-версии нет.

## 0. НЕУКОСНИТЕЛЬНЫЙ ЦИКЛ РАБОТЫ (единственный допустимый порядок)

Любая работа над кодом идёт ТОЛЬКО по этому циклу. Другой порядок запрещён:

```
ШАГ 1. ДЕМО   → npm run demo → правки → смотрю в браузере (HMR)
ШАГ 2. ГЕЙТЫ  → tsc (0 ошибок) → test:unit → build → test:e2e
ШАГ 3. КОММИТ → git add -A + git commit
ШАГ 4. ПУШ    → git push (только после ШАГОВ 1-2; требует подтверждения)
ШАГ 5. РЕЛИЗ  → бамп версии в 3 местах → git tag → push tag (требует подтверждения)
               → верификация: gh run list = success, APK в релизе
```

**Жёсткие запреты:**
- ❌ НЕЛЬЗЯ пушить или тегать, если хотя бы один гейт из ШАГА 2 упал
- ❌ НЕЛЬЗЯ пропускать демо-просмотр (ШАГ 1) перед пушем изменений UI/функционала
- ❌ НЕЛЬЗЯ менять код без запущенного демо-сервера (исключение: правки только конфигов/тестов)
- ❌ НЕЛЬЗЯ выпускать релиз без бампа версии во всех 3 местах (пункт 3)

**Признаки нарушения цикла** (остановиться и вернуться к ШАГУ 1):
- Браузер демо не запускался после последних правок
- Команды тестов не выполнялись после последних правок
- Версия в package.json ≠ version.ts ≠ build.gradle

## 1. Стек и структура

- **Стек:** Vite + TypeScript (strict) + Tailwind CSS v3 (PostCSS) + Chart.js
- **Мобильное приложение:** Capacitor (Android), папка `android/`
- **Тесты:** Vitest (unit, `tests/unit/`) + Playwright (e2e, `tests/e2e/`)
- **CI/CD:** GitHub Actions — сборка APK по тегу (`android-release.yml`)
- **Демо перед пушем:** локальный dev-сервер `npm run dev` (http://localhost:5173)

## 2. Рабочий процесс

**Демо-превью (вариант A, обязателен перед пушем):**
1. `npm run demo` — dev-сервер с горячей перезагрузкой + автооткрытие браузера (http://localhost:5173)
2. Правишь код в `src/` → браузер обновляется сам → смотришь результат
3. Прогнал глазами ключевые места (схема, вкладки, КП) → только потом пуш

**Правки только в:** `src/`, `index.html`, `public/`

**android/ делится на:**
- **source (правим):** `app/build.gradle`, `app/src/main/res/`, `app/src/main/AndroidManifest.xml`
- **generated (не трогаем):** `app/src/main/assets/`, `capacitor.config.json`, `android/build/`

**Гейты перед отправкой:**
- **Перед коммитом:** `npx tsc -p tsconfig.app.json --noEmit` (0 ошибок) + `npm run test:unit`
- **Перед пушем:** `npm run build` (production-сборка работает!) + `npm run test:e2e`
- **Перед релизом:** демо-просмотр + smoke на телефоне (канвас, PDF, каталог, сохранение)

## 3. Версионирование

Источник истины — `package.json`. Перед релизом бампать **три места**:

| Файл | Что |
|------|-----|
| `package.json` | `"version": "x.y.z"` |
| `src/core/version.ts` | `APP_VERSION = 'x.y.z'` |
| `android/app/build.gradle` | `versionName "x.y.z"` + `versionCode` (+1) |

Бейдж в шапке не трогать — он берёт версию из `APP_VERSION` при старте.

## 4. Релизный процесс

```powershell
# 0. Бампить версию (пункт 3), прогнать все гейты (пункт 2)
# 1. Пуш:
git add -A
git commit -m "v1.0.x: описание изменений"
git push origin main
# 2. Тег — запускает CI:
git tag v1.0.x
git push origin v1.0.x
# 3. ВЕРИФИКАЦИЯ (обязательно):
gh run list            # → Build Android APK: success
gh release view v1.0.x # → в релизе есть SolarStudio.apk
```

- **Changelog:** заполнять описание релиза — оно попадает в баннер обновлений клиентам
- **Теги не переиспользовать:** если релиз упал — бампать патч и заново
- **Откат:** старые релизы НЕ удалять; откат = revert-коммит + новый патч-тег
- **Никаких prerelease-тегов в релизах** — update-чекер их не фильтрует (клиенты увидят бета-баннер)

## 5. Совместимость данных

Проекты клиентов хранятся в localStorage / JSON-файлах.
- **Новые версии обязаны читать старые сохранения** (формат схемы менять только обратно-совместимо)
- `sanitize()` в `src/core/state.ts` — защитный слой: любые поля валидируются

## 6. Git и безопасность

- Ветка `main`, коммиты: `vX.Y.Z: ...` (релиз) или `Fix/Feat: ...`
- **Никогда не пушить секреты/токены.** Токены, засветившиеся в чате/коммитах — немедленно отзывать в GitHub Settings
- `dist/`, `node_modules/`, `test-results/`, `android/build/`, `android/app/build/` — в .gitignore

## 7. Запрещено

- ❌ Править `dist/` и `android/app/src/main/assets/` руками
- ❌ Убирать `[hidden] { display:none !important }` из `src/styles.css` (ломает вкладки)
- ❌ Возвращать Tailwind v4 (ломал дизайн в проде)
- ❌ Менять `base: './'` в vite.config.ts (относительные пути обязательны для APK)
- ❌ Добавлять web-деплой (Pages/Netlify) — продукт только APK

## 8. Ключевые точки

| Что | Где |
|-----|-----|
| Репозиторий | https://github.com/JopaName/narozhnyy-soft |
| Скачать APK (всегда свежий) | https://github.com/JopaName/narozhnyy-soft/releases/latest |
| Демо-сервер | `npm run demo` → http://localhost:5173 (браузер открывается сам) |
| APK после локальной сборки | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Каталог оборудования | `public/equipment.json` |
| Скриншоты для README | `docs/screenshots/` (обновлять при смене UI) |

## 9. Локальная сборка APK

```powershell
npm run android:build
# или вручную:
# $env:ANDROID_HOME = "C:\Android"
# $env:JAVA_HOME = <папка JDK 21>
# cd android; gradlew.bat assembleDebug
```

## 10. Проверка обновлений (как работает)

- `src/ui/update-checker.ts` раз в 2 минуты опрашивает GitHub Releases API
- Если `latest tag > APP_VERSION` → баннер «Скачать обновление» → страница релиза
- Работает и в APK (WebView), и в локальном демо

**Этот документ — живой:** если процесс меняется, обновлять AGENTS.md вместе с кодом.
