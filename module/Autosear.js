// ============================================
// Sanctum - Efficient Autosear & Shotgun Automatic Control Group (Standalone)
// - "Efficient Autosear": Autofire skill + damage card for 6 bullets
// - "Shotgun Automatic Control Group": Autofire skill + damage card for 4 bullets
// ============================================

console.log("%cSanctum Efficient Autosear | Loading", "color: #4caf50; font-weight: bold");

const FLAG_SCOPE = "world";
const FLAG_KEY = "isEfficient";
const LOG_PREFIX = "Sanctum Efficient Autosear |";

// ---------------- Helpers ----------------

function logError(context, err, notify = false) {
  console.error(`${LOG_PREFIX} ${context}:`, err);
  if (notify) ui.notifications?.error(`Sanctum Efficient Autosear: ${context} failed (see console).`);
}

function getElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  return null;
}

function getEfficientCost(item) {
  if (!item || item.type !== "weapon" || !item.actor) return 0;
  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return 0;

  let cost = 0;
  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (!upg || upg.type !== "itemUpgrade") continue;
    const name = (upg.name || "").toLowerCase();

    if (name.includes("shotgun automatic control group")) {
      cost = cost ? Math.min(cost, 4) : 4;
    } else if (name.includes("efficient autosear")) {
      cost = cost ? Math.min(cost, 6) : 6;
    }
  }
  return cost;
}

function isEfficient(item) {
  return !!item?.getFlag(FLAG_SCOPE, FLAG_KEY);
}

async function setEfficient(item, next) {
  try {
    await item.setFlag(FLAG_SCOPE, FLAG_KEY, next);
    if (next) {
      const firetype = item.getFlag?.("cyberpunk-red-core", "firetype");
      if (firetype && firetype !== "single") {
        await item.unsetFlag("cyberpunk-red-core", "firetype");
      }
    }
  } catch (err) {
    logError("Efficient toggle", err, true);
  }
}

function getAutofireSkill(actor) {
  const skill = actor?.items?.find(i => i.type === "skill" && /autofire/i.test(i.name || ""));
  return {
    name: skill?.name ?? "Autofire",
    level: Number(skill?.system?.level ?? 0)
  };
}

// ---------------- Actor sheet: Efficient toggle ----------------

function injectEfficient(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor || !el.querySelector(".weapon-grid")) return;

  el.querySelectorAll(".weapon-grid li").forEach(li => {
    if (li.textContent.trim().startsWith("Efficient")) li.remove();
  });

  for (const grid of el.querySelectorAll(".weapon-grid[data-item-id]")) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!getEfficientCost(item)) continue;
    const list = grid.querySelector("ul");
    if (!list) continue;

    const checked = isEfficient(item);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="text-padding-sides-small">Efficient</span>
      <a class="fire-checkbox" data-item-id="${item.id}">
        <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
      </a>`;
    li.querySelector("a").addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setEfficient(item, !isEfficient(item));
    });
    list.appendChild(li);
    grid.style.height = "auto";
    grid.style.minHeight = "80px";

    // Turn off Efficient if another native fire mode is selected
    for (const nativeBox of list.querySelectorAll("a.fire-checkbox[data-fire-mode]")) {
      if (nativeBox.dataset.efficientListener) continue;
      nativeBox.dataset.efficientListener = "1";
      nativeBox.addEventListener("click", () => {
        if (isEfficient(item)) setEfficient(item, false);
      });
    }
  }
}

// ---------------- Fake Autofire (normal attack + Autofire skill/card + custom ammo cost) ----------------

function convertToFakeAutofire(cprRoll, item, cost) {
  if (!cprRoll || cprRoll._sanctumFakeAutofire) return cprRoll;
  cprRoll._sanctumFakeAutofire = true;

  const { name, level } = getAutofireSkill(item.actor);
  cprRoll.skillName = name;
  cprRoll.skillValue = level;
  cprRoll.rollCard = `systems/${game.system.id}/templates/chat/cpr-autofire-rollcard.hbs`;

  if (typeof cprRoll.roll === "function") {
    const origRoll = cprRoll.roll.bind(cprRoll);
    cprRoll.roll = async function (...args) {
      const res = await origRoll(...args);

      // CPR already spends 1 bullet for the normal attack; spend the remaining (cost - 1)
      setTimeout(async () => {
        try {
          const nowMag = Number(item.system?.magazine?.value ?? 0);
          const targetMag = Math.max(0, nowMag - (cost - 1));
          await item.update({ "system.magazine.value": targetMag });
          console.log(`%c${LOG_PREFIX} Ammo -> ${targetMag} (spent ${cost} total)`, "color: #4caf50");
        } catch (err) {
          logError("ammo deduction", err);
        }
      }, 150);

      return res;
    };
  }

  return cprRoll;
}

function patchProto(proto) {
  if (!proto?.createRoll || proto.createRoll.__sanctumEfficient) return false;
  const orig = proto.createRoll;
  const wrapped = function (type, ...rest) {
    const cost = getEfficientCost(this);
    if (this.type === "weapon" && cost > 0 && isEfficient(this)) {
      if (type === "attack") {
        const mag = Number(this.system?.magazine?.value ?? 0);
        if (mag < cost) {
          ui.notifications?.warn(`${this.name}: Not enough ammo for Efficient Autofire (needs ${cost}, has ${mag}).`);
          return null;
        }
        const result = orig.call(this, "attack", ...rest);
        return result instanceof Promise
          ? result.then(r => convertToFakeAutofire(r, this, cost))
          : convertToFakeAutofire(result, this, cost);
      }
    }
    return orig.call(this, type, ...rest);
  };
  wrapped.__sanctumEfficient = true;
  proto.createRoll = wrapped;
  return true;
}

// ---------------- Registration (once) ----------------

const HOOKS = [
  ["renderActorSheet", (app, html) => injectEfficient(app, html)],
  ["renderActorSheetV2", (app, html) => injectEfficient(app, html)],
  ["updateItem", (item, changes, _options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "weapon" || !item.actor || !changes.system?.installedItems) return;
    if (isEfficient(item) && !getEfficientCost(item)) {
      setEfficient(item, false);
    }
  }]
];

function register() {
  const prev = globalThis._sanctumEfficientHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumEfficientHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  let patched = patchProto(CONFIG.Item.documentClass?.prototype);
  const sampleWeapon = game.items?.find(i => i.type === "weapon")
    ?? game.actors?.contents.flatMap(a => a.items.contents).find(i => i.type === "weapon");
  if (sampleWeapon) {
    patched = patchProto(Object.getPrototypeOf(sampleWeapon)) || patched;
  }

  if (patched) {
    console.log(`%c${LOG_PREFIX} Ready (Efficient Autosear: 6, Shotgun ACG: 4)`, "color: #4caf50; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find createRoll to patch`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
