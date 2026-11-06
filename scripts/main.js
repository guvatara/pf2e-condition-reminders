/**
 * PF2e Condition Reminders
 * ------------------------
 * Показывает всплывающую карточку игроку, когда на его персонажа
 * накладывается состояние PF2e (frightened, sickened, ...), когда
 * валуированное состояние усиливается и когда оно спадает.
 *
 * Реакция построена на core-хуках createItem / updateItem / deleteItem:
 * в системе PF2e каждое состояние — это embedded item с типом "condition",
 * поэтому модуль не зависит от внутренностей системы, только от её
 * data model (system.value, system.duration, system.description).
 */

const MODULE_ID = "pf2e-condition-reminders";
const MAX_CARDS = 5;

/** uuid -> последнее известное значение валуированного состояния */
const lastValues = new Map();

/* ------------------------------------------------------------------------ */
/*  Утилиты (с учётом переноса API в foundry.applications в v13/v14)        */
/* ------------------------------------------------------------------------ */

function getTextEditor() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
}

function getRenderTemplate() {
  return foundry.applications?.handlebars?.renderTemplate ?? renderTemplate;
}

function isPF2e() {
  return game.system?.id === "pf2e";
}

function isConditionItem(item) {
  return item?.type === "condition" && item.parent?.documentName === "Actor";
}

/** Видит ли текущий пользователь карточку по этому актёру. */
function userSeesCard(actor) {
  if (!actor) return false;
  if (game.user.isGM) return game.settings.get(MODULE_ID, "notifyGM");
  return actor.testUserPermission(game.user, "OWNER");
}

function conditionValue(item) {
  const v = item.system?.value;
  return v?.isValued && typeof v.value === "number" ? v.value : null;
}

function conditionSlug(item) {
  return item.slug ?? item.system?.slug ?? "";
}

function formatDuration(item) {
  const d = item.system?.duration;
  if (!d || typeof d.value !== "number" || d.value < 0) return null;
  const unit = d.unit ?? "rounds";
  if (unit === "unlimited") return null;
  const unitKey = `PF2E-CR.units.${unit}`;
  const unitLabel = game.i18n.has(unitKey) ? game.i18n.localize(unitKey) : unit;
  return game.i18n.format("PF2E-CR.card.duration", { value: d.value, unit: unitLabel });
}

/* ------------------------------------------------------------------------ */
/*  Карточка                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * @param {Item} item   condition item
 * @param {"applied"|"increased"|"ended"} mode
 */
async function showCard(item, mode) {
  if (!isPF2e() || !isConditionItem(item)) return;
  if (!game.settings.get(MODULE_ID, "enabled")) return;

  const actor = item.parent;
  if (!userSeesCard(actor)) return;

  const slug = conditionSlug(item);
  const hintKey = `PF2E-CR.hints.${slug}`;
  const hint = game.i18n.has(hintKey) ? game.i18n.localize(hintKey) : null;
  const duration = formatDuration(item);
  const value = conditionValue(item);

  let description = "";
  if (mode !== "ended") {
    const raw = item.system?.description?.value ?? "";
    description = await getTextEditor().enrichHTML(raw, {
      async: true,
      secrets: item.isOwner,
      relativeTo: item,
    });
  }

  const html = await getRenderTemplate()(
    `modules/${MODULE_ID}/templates/condition-card.hbs`,
    {
      mode,
      img: item.img,
      name: item.name,
      value,
      hasValue: value !== null,
      kindLabel: game.i18n.localize(`PF2E-CR.kinds.${mode}`),
      actorName: actor.name,
      hint,
      duration,
      description,
      showDetails: mode !== "ended",
      closeLabel: game.i18n.localize("PF2E-CR.card.close"),
    }
  );

  mount(html);
}

function mount(html) {
  let root = document.getElementById("pcr-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "pcr-root";
    document.body.appendChild(root);
  }

  const tmp = document.createElement("div");
  tmp.innerHTML = html.trim();
  const card = tmp.firstElementChild;
  if (!card) return;
  root.appendChild(card);

  const dismiss = () => {
    if (!card.isConnected) return;
    card.classList.add("pcr-out");
    card.addEventListener("animationend", () => card.remove(), { once: true });
  };
  card.querySelector('[data-action="close"]')?.addEventListener("click", dismiss);

  const seconds = Number(game.settings.get(MODULE_ID, "autoDismiss") ?? 0);
  if (seconds > 0) setTimeout(dismiss, seconds * 1000);

  // Не даём карточкам заполнить экран
  while (root.childElementCount > MAX_CARDS) root.firstElementChild?.remove();
}

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
  s("autoDismiss", {
    type: Number,
    default: 15,
    range: { min: 0, max: 60, step: 1 },
  });
}

/* ------------------------------------------------------------------------ */
/*  Хуки                                                                     */
/* ------------------------------------------------------------------------ */

Hooks.once("init", registerSettings);

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
  if (game.settings.get(MODULE_ID, "notifyEnd")) showCard(item, "ended");
});
