// ============================================
// Sanctum - Cocking Lever (Standalone)
// Automatically detects installed "Cocking Lever" upgrade
// Adds a "Cocked" toggle (+1d6 damage, +1 extra ablation)
// ============================================

console.log("%cSanctum Cocking Lever | Loading", "color: #e91e63; font-weight: bold");

const FLAG_SCOPE = "world";
const FLAG_KEY = "isCocked";
const LOG_PREFIX = "Sanctum Cocking Lever |";

let lastCockedRoll = null;

// ---------------- Helpers ----------------

function logError(context, err, notify = false) {
  console.error(`${LOG_PREFIX} ${context}:`, err);
  if (notify) ui.notifications?.error(`Sanctum Cocking Lever: ${context} failed (see console).`);
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

function hasCockingLever(item) {
  return hasInstalledUpgrade(item, "cocking lever");
}

function isCocked(item) {
  return !!item?.getFlag(FLAG_SCOPE, FLAG_KEY);
}

async function setCocked(item, next) {
  try {
    await item.setFlag(FLAG_SCOPE, FLAG_KEY, next);
  } catch (err) {
    logError("Cocked toggle", err, true);
  }
}

function addDiceToFormula(formula, extra) {
  if (!formula || !extra) return formula;
  return formula.replace(/(\d+)d(\d+)/i, (_, count, sides) => {
    return `${parseInt(count, 10) + extra}d${sides}`;
  });
}

// ---------------- Actor sheet: Cocked toggle ----------------

function injectCocked(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor || !el.querySelector(".weapon-grid")) return;

  el.querySelectorAll(".weapon-grid li").forEach(li => {
    if (li.textContent.trim().startsWith("Cocked")) li.remove();
  });

  for (const grid of el.querySelectorAll(".weapon-grid[data-item-id]")) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!hasCockingLever(item)) continue;
    const list = grid.querySelector("ul");
    if (!list) continue;

    const checked = isCocked(item);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="text-padding-sides-small">Cocked</span>
      <a class="fire-checkbox" data-item-id="${item.id}">
        <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
      </a>`;
    li.querySelector("a").addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setCocked(item, !isCocked(item));
    });
    list.appendChild(li);
    grid.style.height = "auto";
    grid.style.minHeight = "80px";
  }
}

// ---------------- Roll & Ablation Hooks ----------------

function wrapDamageRoll(cprRoll) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumCockedWrapped) {
    return cprRoll;
  }

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumCockedWrapped = true;

  cprRoll.roll = async function (...args) {
    if (typeof this.formula === "string") {
      const before = this.formula;
      this.formula = addDiceToFormula(this.formula, 1);
      console.log(`%c${LOG_PREFIX} Cocked ${before} -> ${this.formula} (+1 ablation)`, "color: #e91e63");
    }

    let appliedOnRoll = false;
    if (typeof this.ablation === "number") {
      this.ablation += 1;
      appliedOnRoll = true;
    }

    lastCockedRoll = { appliedOnRoll, time: Date.now() };
    return origRoll(...args);
  };

  return cprRoll;
}

function onPreCreateChatMessage(message, data) {
  if (!lastCockedRoll || Date.now() - lastCockedRoll.time > 5000) return;

  const content = data.content ?? message.content ?? "";
  if (!content.includes('data-action="applyDamage"')) return;

  const { appliedOnRoll } = lastCockedRoll;
  lastCockedRoll = null;

  if (appliedOnRoll) return;

  const updated = content.replace(/data-ablation="(\d+)"/gi, (_, val) => {
    return `data-ablation="${parseInt(val, 10) + 1}"`;
  });

  if (updated !== content) {
    message.updateSource({ content: updated });
  }
}

// ---------------- Registration (once) ----------------

function patchProto(proto) {
  if (!proto?.createRoll || proto.createRoll.__sanctumCockingLever) return false;
  const orig = proto.createRoll;
  const wrapped = function (type, ...rest) {
    const result = orig.call(this, type, ...rest);
    if (type !== "damage") return result;
    if (!hasCockingLever(this) || !isCocked(this)) return result;

    if (result instanceof Promise) {
      return result.then(r => wrapDamageRoll(r));
    }
    return wrapDamageRoll(result);
  };
  wrapped.__sanctumCockingLever = true;
  proto.createRoll = wrapped;
  return true;
}

const HOOKS = [
  ["renderActorSheet", (app, html) => injectCocked(app, html)],
  ["renderActorSheetV2", (app, html) => injectCocked(app, html)],
  ["updateItem", (item, changes, _options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "weapon" || !item.actor || !changes.system?.installedItems) return;
    if (isCocked(item) && !hasCockingLever(item)) {
      setCocked(item, false);
    }
  }],
  ["preCreateChatMessage", onPreCreateChatMessage]
];

function register() {
  const prev = globalThis._sanctumCockingHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumCockingHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  let patched = patchProto(CONFIG.Item.documentClass?.prototype);
  const sampleWeapon = game.items?.find(i => i.type === "weapon")
    ?? game.actors?.contents.flatMap(a => a.items.contents).find(i => i.type === "weapon");
  if (sampleWeapon) {
    patched = patchProto(Object.getPrototypeOf(sampleWeapon)) || patched;
  }

  if (patched) {
    console.log(`%c${LOG_PREFIX} Ready (automatic upgrade detection)`, "color: #e91e63; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find createRoll to patch`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
