/**
 * Общая логика карточек-напоминаний: построение и показ.
 * Используется и хуками (main.js), и панелью активных состояний (panel.js).
 */

export const MODULE_ID = "pf2e-condition-reminders";

const MAX_CARDS = 5;

/* ------------------------------------------------------------------------ */
/*  Утилиты (с учётом переноса API в foundry.applications в v13/v14)        */
/* ------------------------------------------------------------------------ */

export function getTextEditor() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
}

export function getRenderTemplate() {
  return foundry.applications?.handlebars?.renderTemplate ?? renderTemplate;
}

export function isPF2e() {
  return game.system?.id === "pf2e";
}

export function isConditionItem(item) {
  return item?.type === "condition" && item.parent?.documentName === "Actor";
}

/** Видит ли текущий пользователь карточку по этому актёру. */
export function userSeesCard(actor) {
  if (!actor) return false;
  if (game.user.isGM) return game.settings.get(MODULE_ID, "notifyGM");
  return actor.testUserPermission(game.user, "OWNER");
}

export function conditionValue(item) {
  const v = item.system?.value;
  return v?.isValued && typeof v.value === "number" ? v.value : null;
}

export function conditionSlug(item) {
  return item.slug ?? item.system?.slug ?? "";
}

export function formatDuration(item) {
  const d = item.system?.duration;
  if (!d || typeof d.value !== "number" || d.value < 0) return null;
  const unit = d.unit ?? "rounds";
  if (unit === "unlimited") return null;
  const unitKey = `PF2E-CR.units.${unit}`;
  const unitLabel = game.i18n.has(unitKey) ? game.i18n.localize(unitKey) : unit;
  return game.i18n.format("PF2E-CR.card.duration", { value: d.value, unit: unitLabel });
}

export function conditionHint(item) {
  const hintKey = `PF2E-CR.hints.${conditionSlug(item)}`;
  return game.i18n.has(hintKey) ? game.i18n.localize(hintKey) : null;
}

/* ------------------------------------------------------------------------ */
/*  Карточка                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * @param {Item} item   condition item
 * @param {"applied"|"increased"|"ended"|"reminder"} mode
 */
export async function showCard(item, mode) {
  if (!isPF2e() || !isConditionItem(item)) return;
  if (!game.settings.get(MODULE_ID, "enabled")) return;

  const actor = item.parent;
  // Кнопка «показать напоминание» — явное действие пользователя, права не проверяем
  if (mode !== "reminder" && !userSeesCard(actor)) return;

  const hint = conditionHint(item);
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
