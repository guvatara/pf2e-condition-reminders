# PF2e Condition Reminders

Модуль для [Foundry VTT](https://foundryvtt.com/) (v13+, проверен на v14) и системы **Pathfinder 2e**: показывает игроку всплывающую карточку-напоминание, когда на его персонажа накладывается состояние.

![Foundry v13+](https://img.shields.io/badge/foundry-v13%2B-orange)

## Возможности

- **Карточка при наложении состояния** — название со значением («Напуган 2»), полное описание условия из данных системы и подсказка, когда оно спадает.
- **Встроенные подсказки по спадению** для ~35 стандартных состояний PF2e (frightened, sickened, drained, doomed, off-guard/flat-footed и т.д.) на русском и английском.
- **Уведомление об усилении** валуированных состояний (frightened 1 → 2). Автоматические тики вниз в конце хода карточек не создают.
- **Короткое уведомление о спадении** состояния.
- **Персональный показ**: карточку видит владелец персонажа; Мастеру — по настройке.
- Клиентские настройки: вкл/выкл, показ Мастеру, усиление, спадение, автозакрытие (0–60 с).

## Установка

В Foundry: **Add-on Modules → Install Module → Manifest URL**:

```
https://github.com/guvatara/pf2e-condition-reminders/releases/latest/download/module.json
```

Либо вручную: распаковать `pf2e-condition-reminders.zip` из последнего релиза в `Data/modules/`.

## Разработка

```bash
npm install     # зависимости (archiver)
npm run lint    # проверка синтаксиса скриптов
npm run build   # сборка dist/pf2e-condition-reminders.zip + dist/module.json
```

Структура модуля — классическая: `module.json` в корне, код в `scripts/`, шаблон карточки в `templates/`, стили в `styles/`, локализация в `lang/`.

## Релиз

Релизы собираются GitHub Actions автоматически. Достаточно поднять версию в `module.json`/`package.json` и запушить тег:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Workflow подставит версию и URL из тега в `module.json`, соберёт zip и опубликует релиз с ассетами `module.json` и `pf2e-condition-reminders.zip`.

## Лицензия

[MIT](LICENSE)
