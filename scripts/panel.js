/**
 * Закреплённая панель активных состояний.
 * Показывает состояния персонажей текущего пользователя (у Мастера — всех
 * актёров с состояниями), счётчики значений и кнопку «показать напоминание».
 */

import {
  MODULE_ID,
  isPF2e,
  showCard,
  conditionValue,
  conditionHint,
  formatDuration,
  getRenderTemplate,
} from "./cards.js";

let panelRoot = null;
let collapsed = false;
let updateTimer = null;

/** Актёры, чьи состояния показываются в панели. */
function relevantActors() {
  const withConditions = (a) =>
    a.type !== "party" && a.type !== "loot" && actorConditions(a).length > 0;

  let actors;
  if (game.user.isGM) {
    actors = game.actors.filter(withConditions);
  } else {
    actors = game.actors.filter((a) => a.isOwner && withConditions(a));
  }
  return actors.sort((a, b) => a.name.localeCompare(b.name));
}

function actorConditions(actor) {
  return actor.itemTypes?.condition ?? actor.items.filter((i) => i.type === "condition");
}

function buildData() {
  const groups = relevantActors().map((actor) => {
    const conditions = actorConditions(actor)
      .map((c) => {
        const value = conditionValue(c);
        return {
          uuid: c.uuid,
          img: c.img,
          name: c.name,
          value,
          hasValue: value !== null,
          duration: formatDuration(c),
          hint: conditionHint(c),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { actorId: actor.id, actorName: actor.name, img: actor.img, conditions };
  });

  const total = groups.reduce((n, g) => n + g.conditions.length, 0);

  return {
    collapsed,
    total,
    groups,
    title: game.i18n.localize("PF2E-CR.panel.title"),
    emptyLabel: game.i18n.localize("PF2E-CR.panel.empty"),
    reminderLabel: game.i18n.localize("PF2E-CR.panel.reminder"),
    removeLabel: game.i18n.localize("PF2E-CR.panel.remove"),
  };
}

async function renderPanel() {
  if (!panelRoot || !isPF2e()) return;
  const html = await getRenderTemplate()(
    `modules/${MODULE_ID}/templates/panel.hbs`,
    buildData()
  );
  panelRoot.innerHTML = html;
  bindPanelEvents();
}

function bindPanelEvents() {
  panelRoot.querySelector('[data-action="toggle"]')?.addEventListener("click", async () => {
    collapsed = !collapsed;
    panelRoot.classList.toggle("pcr-collapsed", collapsed);
    panelRoot
      .querySelector(".pcr-chevron")
      ?.classList.replace(collapsed ? "fa-chevron-down" : "fa-chevron-up",
                          collapsed ? "fa-chevron-up" : "fa-chevron-down");
    panelRoot.querySelector(".pcr-panel-body")?.classList.toggle("pcr-hidden", collapsed);
    await game.settings.set(MODULE_ID, "panelCollapsed", collapsed);
  });

  panelRoot.querySelectorAll('[data-action="remind"]').forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const item = await fromUuid(btn.dataset.uuid);
      if (item) showCard(item, "reminder");
    });
  });

  panelRoot.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const item = await fromUuid(btn.dataset.uuid);
      if (!item) return;
      if (!item.isOwner && !game.user.isGM) return;
      // Панель обновится сама по хуку deleteItem
      await item.delete();
    });
  });
}

/** Перерисовать панель с небольшим дебаунсом (хуки могут идти пачкой). */
export function schedulePanelUpdate() {
  if (!panelRoot) return;
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => void renderPanel(), 150);
}

export function initPanel() {
  Hooks.once("ready", () => {
    if (!isPF2e() || !game.settings.get(MODULE_ID, "panelEnabled")) return;

    collapsed = Boolean(game.settings.get(MODULE_ID, "panelCollapsed"));

    panelRoot = document.createElement("aside");
    panelRoot.id = "pcr-panel";
    panelRoot.classList.toggle("pcr-collapsed", collapsed);
    document.body.appendChild(panelRoot);

    void renderPanel();
  });

  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, (item) => {
      if (item?.type === "condition") schedulePanelUpdate();
    });
  }
}
