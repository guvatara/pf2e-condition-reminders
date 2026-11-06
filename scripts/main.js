/**
 * PF2e Condition Reminders
 * ------------------------
 * Всплывающие карточки при наложении/усилении/спадении состояний PF2e
 * и закреплённая панель активных состояний.
 *
 * Реакция построена на core-хуках createItem / updateItem / deleteItem:
 * в системе PF2e каждое состояние — это embedded item с типом "condition",
 * поэтому модуль не зависит от внутренностей системы, только от её
 * data model (system.value, system.duration, system.description).
 */

import {
  MODULE_ID,
  isPF2e,
  isConditionItem,
  conditionValue,
  showCard,
} from "./cards.js";
import { initPanel } from "./panel.js";

/** uuid -> последнее известное значение валуированного состояния */
const lastValues = new Map();

/** uuid актёров, которые прямо сейчас удаляются (каскадное удаление состояний) */
const deletingActors = new Set();

/* ------------------------------------------------------------------------ */
/*  Настройки                                                                */
/* ------------------------------------------------------------------------ */

function registerSettings() {
  const s = (key, data) =>
    game.settings.register(MODULE_ID, key, {
      name: `PF2E-CR.settings.${key}.name`,
      hint: `PF2E-CR.settings.${key}.hint`,
      scope: "client",
      config: true,
      ...data,
    });

  s("enabled", { type: Boolean, default: true });
  s("notifyGM", { type: Boolean, default: true });
  s("notifyIncrease", { type: Boolean, default: true });
  s("notifyEnd", { type: Boolean, default: true });
  s("panelEnabled", { type: Boolean, default: true, requiresReload: true });
  s("confirmRemoval", { type: Boolean, default: true });
  s("autoDismiss", {
    type: Number,
    default: 15,
    range: { min: 0, max: 60, step: 1 },
  });

  // Служебное состояние UI (не показывается в настройках)
  game.settings.register(MODULE_ID, "panelCollapsed", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, "panelPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: null,
  });
}

/* ------------------------------------------------------------------------ */
/*  Хуки                                                                     */
/* ------------------------------------------------------------------------ */

Hooks.once("init", () => {
  registerSettings();
  initPanel();
});

// Состояние наложено
Hooks.on("createItem", (item) => {
  if (!isPF2e() || !isConditionItem(item)) return;
  lastValues.set(item.uuid, conditionValue(item));
  showCard(item, "applied");
});

// Валуированное состояние изменилось (frightened 2 -> 1 и т.п.)
Hooks.on("updateItem", (item) => {
  if (!isPF2e() || !isConditionItem(item)) return;
  const current = conditionValue(item);
  const previous = lastValues.get(item.uuid);
  lastValues.set(item.uuid, current);
  if (
    current !== null &&
    previous !== null &&
    previous !== undefined &&
    current > previous &&
    game.settings.get(MODULE_ID, "notifyIncrease")
  ) {
    showCard(item, "increased");
  }
});

// Состояние спало
Hooks.on("deleteItem", (item) => {
  if (!isPF2e() || !isConditionItem(item)) return;
  lastValues.delete(item.uuid);
  // При удалении актёра состояния удаляются каскадом — карточки «спало» не нужны
  if (deletingActors.has(item.parent?.uuid)) return;
  if (game.settings.get(MODULE_ID, "notifyEnd")) showCard(item, "ended");
});

// Отслеживаем удаление актёров, чтобы отличить каскад от обычного снятия
Hooks.on("preDeleteActor", (actor) => {
  deletingActors.add(actor.uuid);
});
Hooks.on("deleteActor", (actor) => {
  setTimeout(() => deletingActors.delete(actor.uuid), 1000);
});

// То же для несвязанных токенов: их синтетические актёры удаляются вместе с токеном
Hooks.on("preDeleteToken", (token) => {
  const actor = token.actor;
  if (actor && !token.actorLink) deletingActors.add(actor.uuid);
});
Hooks.on("deleteToken", (token) => {
  const actor = token.actor;
  if (actor) setTimeout(() => deletingActors.delete(actor.uuid), 1000);
});
