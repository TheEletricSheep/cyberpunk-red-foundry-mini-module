// ============================================
// Sanctum - Airstrike (Standalone)
// Automatically detects installed "Airstrike" upgrade
// Adds an "Airstrike" toggle (+1d6 damage, no extra ablation)
// ============================================

console.log("%cSanctum Airstrike | Loading", "color: #00bcd4; font-weight: bold");

const FLAG_SCOPE = "world";
const FLAG_KEY = "isAirstrike";
const LOG_PREFIX = "Sanctum Airstrike |";

// ---------------- Helpers ----------------

function logError(context, err, notify = false) {
  console.error(`${LOG_PREFIX} ${context}:`, err);
  if (notify) ui.notifications?.error(`Sanctum Airstrike: ${context} failed (see console).`);
}

function getElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  return null;
}

function hasInstalledUpgrade(item, keyword) {
  if (!item || item.type !== "weapon" || !item.actor) return false;
  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return false;

  const target = keyword.toLowerCase();
  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (upg && upg.type === "itemUpgrade") {
      if ((upg.name || "").toLowerCase().includes(target)) return true;
    }
  }
  return false;
}

function hasAirstrike(item) {
  return hasInstalledUpgrade(item, "airstrike");
}

function isAirstrike(item) {
  return !!item?.getFlag(FLAG_SCOPE, FLAG_KEY);
}

async function setAirstrike(item, next) {
  try {
    await item.setFlag(FLAG_SCOPE, FLAG_KEY, next);
  } catch (err) {
    logError("Airstrike toggle", err, true);
  }
}

function addDiceToFormula(formula, extra) {
  if (!formula || !extra) return formula;
  return formula.replace(/(\d+)d(\d+)/i, (_, count, sides) => {
    return `${parseInt(count, 10) + extra}d${sides}`;
  });
}

// ---------------- Actor sheet: Airstrike toggle ----------------

function injectAirstrike(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor || !el.querySelector(".weapon-grid")) return;

  el.querySelectorAll(".weapon-grid li").forEach(li => {
    if (li.textContent.trim().startsWith("Airstrike")) li.remove();
  });

  for (const grid of el.querySelectorAll(".weapon-grid[data-item-id]")) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!hasAirstrike(item)) continue;
    const list = grid.querySelector("ul");
    if (!list) continue;

    const checked = isAirstrike(item);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="text-padding-sides-small">Airstrike</span>
      <a class="fire-checkbox" data-item-id="${item.id}">
        <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
      </a>`;
    li.querySelector("a").addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setAirstrike(item, !isAirstrike(item));
    });
    list.appendChild(li);
    grid.style.height = "auto";
    grid.style.minHeight = "80px";
  }
}

// ---------------- Roll Hook ----------------

function wrapDamageRoll(cprRoll) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumAirstrikeWrapped) {
    return cprRoll;
  }

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumAirstrikeWrapped = true;

  cprRoll.roll = async function (...args) {
    if (typeof this.formula === "string") {
      const before = this.formula;
      this.formula = addDiceToFormula(this.formula, 1);
      console.log(`%c${LOG_PREFIX} Airstrike ${before} -> ${this.formula}`, "color: #00bcd4");
    }

    return origRoll(...args);
  };

  return cprRoll;
}

// ---------------- Registration (once) ----------------

function patchProto(proto) {
  if (!proto?.createRoll || proto.createRoll.__sanctumAirstrike) return false;
  const orig = proto.createRoll;
  const wrapped = function (type, ...rest) {
    const result = orig.call(this, type, ...rest);
    if (type !== "damage") return result;
    if (!hasAirstrike(this) || !isAirstrike(this)) return result;

    if (result instanceof Promise) {
      return result.then(r => wrapDamageRoll(r));
    }
    return wrapDamageRoll(result);
  };
  wrapped.__sanctumAirstrike = true;
  proto.createRoll = wrapped;
  return true;
}

const HOOKS = [
  ["renderActorSheet", (app, html) => injectAirstrike(app, html)],
  ["renderActorSheetV2", (app, html) => injectAirstrike(app, html)],
  ["updateItem", (item, changes, _options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "weapon" || !item.actor || !changes.system?.installedItems) return;
    if (isAirstrike(item) && !hasAirstrike(item)) {
      setAirstrike(item, false);
    }
  }]
];

function register() {
  const prev = globalThis._sanctumAirstrikeHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumAirstrikeHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  let patched = patchProto(CONFIG.Item.documentClass?.prototype);
  const sampleWeapon = game.items?.find(i => i.type === "weapon")
    ?? game.actors?.contents.flatMap(a => a.items.contents).find(i => i.type === "weapon");
  if (sampleWeapon) {
    patched = patchProto(Object.getPrototypeOf(sampleWeapon)) || patched;
  }

  if (patched) {
    console.log(`%c${LOG_PREFIX} Ready (automatic upgrade detection)`, "color: #00bcd4; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find createRoll to patch`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
