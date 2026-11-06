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
    a && a.type !== "party" && a.type !== "loot" && actorConditions(a).length > 0;
  const visible = (a) => game.user.isGM || a.isOwner;

  const seen = new Set();
  const actors = [];
  const push = (a) => {
    if (withConditions(a) && visible(a) && !seen.has(a.uuid)) {
      seen.add(a.uuid);
      actors.push(a);
    }
  };

  for (const a of game.actors) push(a);

  // Актёры несвязанных токенов не входят в game.actors — берём их со сцены
  if (canvas?.ready) {
    for (const token of canvas.tokens?.placeables ?? []) push(token.actor);
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
  const header = panelRoot.querySelector('[data-action="toggle"]');
  if (header) bindHeader(header);

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

      if (game.settings.get(MODULE_ID, "confirmRemoval")) {
        const confirmed = await confirmRemoval(item);
        if (!confirmed) return;
      }

      // Панель обновится сама по хуку deleteItem
      await item.delete();
    });
  });
}

/** Диалог подтверждения снятия состояния (DialogV2 с fallback на Dialog v1). */
async function confirmRemoval(item) {
  const content = game.i18n.format("PF2E-CR.panel.removeConfirm.content", {
    name: item.name,
    actor: item.parent?.name ?? "—",
  });
  const options = {
    window: { title: game.i18n.localize("PF2E-CR.panel.removeConfirm.title") },
    content: `<p>${content}</p>`,
    yes: { label: game.i18n.localize("PF2E-CR.panel.removeConfirm.confirm") },
    no: { label: game.i18n.localize("PF2E-CR.panel.removeConfirm.cancel") },
    modal: false,
    rejectClose: false,
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2?.confirm) return DialogV2.confirm(options);

  // Fallback для v12 и старее
  return Dialog.confirm({
    title: options.window.title,
    content: options.content,
    yes: () => true,
    no: () => false,
    defaultYes: false,
  });
}

/* ----------------------- перетаскивание панели -------------------------- */

const DRAG_THRESHOLD = 5; // px: меньше — это клик (сворачивание), больше — перенос

function applyPosition(x, y) {
  const maxX = window.innerWidth - 80;
  const maxY = window.innerHeight - 40;
  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));
  panelRoot.style.left = `${x}px`;
  panelRoot.style.top = `${y}px`;
  panelRoot.style.right = "auto";
}

async function toggleCollapsed() {
  collapsed = !collapsed;
  panelRoot.classList.toggle("pcr-collapsed", collapsed);
  panelRoot
    .querySelector(".pcr-chevron")
    ?.classList.replace(collapsed ? "fa-chevron-down" : "fa-chevron-up",
                        collapsed ? "fa-chevron-up" : "fa-chevron-down");
  panelRoot.querySelector(".pcr-panel-body")?.classList.toggle("pcr-hidden", collapsed);
  await game.settings.set(MODULE_ID, "panelCollapsed", collapsed);
}

function bindHeader(header) {
  let drag = null;

  header.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    const rect = panelRoot.getBoundingClientRect();
    drag = { startX: ev.clientX, startY: ev.clientY, left: rect.left, top: rect.top, moved: false };
    header.setPointerCapture(ev.pointerId);
  });

  header.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    applyPosition(drag.left + dx, drag.top + dy);
  });

  header.addEventListener("pointerup", async (ev) => {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    header.releasePointerCapture?.(ev.pointerId);

    if (wasDrag) {
      // Запоминаем новую позицию
      await game.settings.set(MODULE_ID, "panelPosition", {
        x: parseFloat(panelRoot.style.left),
        y: parseFloat(panelRoot.style.top),
      });
      return;
    }
    await toggleCollapsed();
  });

  // Двойной клик — вернуть позицию по умолчанию (у трекера боя)
  header.addEventListener("dblclick", async () => {
    panelRoot.style.left = "";
    panelRoot.style.top = "";
    panelRoot.style.right = "";
    await game.settings.set(MODULE_ID, "panelPosition", null);
  });
}

/* ------------------------------------------------------------------------ */

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

    // Восстанавливаем сохранённую позицию (если панель перетаскивали)
    const pos = game.settings.get(MODULE_ID, "panelPosition");
    if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
      applyPosition(pos.x, pos.y);
    }

    void renderPanel();
  });

  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, (item) => {
      if (item?.type === "condition") schedulePanelUpdate();
    });
  }

  // Состав актёров на сцене/в мире изменился — состояния токенов тоже могли
  for (const hook of ["createToken", "deleteToken", "createActor", "deleteActor"]) {
    Hooks.on(hook, () => schedulePanelUpdate());
  }
  Hooks.on("canvasReady", () => schedulePanelUpdate());
}
