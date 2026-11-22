// ============================================
// Sanctum - Martial Arts Weapon Upgrades (Standalone)
// - "Kyudo": "Hassetsu" toggle (+2d6 damage)
// - "Militech Commando Training": "Combat Knife Training" toggle (sets damage to 4d6)
// - "Gun Fu": "Woo Technique" toggle (50% armor ignore, Martial Arts (Gun Fu) skill, higher of unarmed or weapon damage)
// ============================================

console.log("%cSanctum Martial Arts | Loading", "color: #9c27b0; font-weight: bold");

const FLAG_SCOPE = "world";
const LOG_PREFIX = "Sanctum Martial Arts |";

const FLAG_HASSETSU = "isHassetsu";
const FLAG_COMBAT_KNIFE = "isCombatKnifeTraining";
const FLAG_WOO = "isWooTechnique";
const FLAG_WOO_PREV = "wooPrev";

// ---------------- Helpers ----------------

function logError(context, err, notify = false) {
  console.error(`${LOG_PREFIX} ${context}:`, err);
  if (notify) ui.notifications?.error(`Sanctum Martial Arts: ${context} failed (see console).`);
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

function hasKyudo(item) {
  return hasInstalledUpgrade(item, "kyudo");
}

function hasMilitechCommando(item) {
  return hasInstalledUpgrade(item, "militech commando training");
}

function hasGunFu(item) {
  return hasInstalledUpgrade(item, "gun fu");
}

function isHassetsu(item) {
  return hasKyudo(item) && !!item?.getFlag(FLAG_SCOPE, FLAG_HASSETSU);
}

function isCombatKnife(item) {
  return hasMilitechCommando(item) && !!item?.getFlag(FLAG_SCOPE, FLAG_COMBAT_KNIFE);
}

function isWooTechnique(item) {
  return hasGunFu(item) && !!item?.getFlag(FLAG_SCOPE, FLAG_WOO);
}

function getUnarmedDiceCount(actor) {
  const body = Number(actor?.system?.stats?.body?.value ?? 0);
  if (body >= 11) return 4;
  if (body >= 7) return 3;
  if (body >= 5) return 2;
  return 1;
}

function setDiceInFormula(formula, count, sides = 6) {
  if (!formula) return `${count}d${sides}`;
  if (/(\d+)d(\d+)/i.test(formula)) {
    return formula.replace(/(\d+)d(\d+)/i, `${count}d${sides}`);
  }
  return `${count}d${sides}`;
}

function addDiceToFormula(formula, extra) {
  if (!formula || !extra) return formula;
  return formula.replace(/(\d+)d(\d+)/i, (_, count, sides) => {
    return `${parseInt(count, 10) + extra}d${sides}`;
  });
}

function getFirstDiceCount(formula) {
  const m = String(formula || "").match(/(\d+)d(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

// ---------------- Toggle Setters ----------------

async function applyWooEffects(item, active) {
  if (active) {
    let prev = item.getFlag(FLAG_SCOPE, FLAG_WOO_PREV);
    if (!prev) {
      prev = {
        canIgnoreArmor: !!item.system?.canIgnoreArmor,
        ignoreArmorPercent: Number(item.system?.ignoreArmorPercent) || 0,
        weaponSkill: item.system?.weaponSkill ?? ""
      };
      await item.setFlag(FLAG_SCOPE, FLAG_WOO_PREV, prev);
    }

    const updates = {
      "system.weaponSkill": "Martial Arts (Gun Fu)"
    };
    const keepNative = prev.canIgnoreArmor && prev.ignoreArmorPercent >= 50;
    if (!keepNative) {
      updates["system.canIgnoreArmor"] = true;
      updates["system.ignoreArmorPercent"] = 50;
    }
    await item.update(updates);
  } else {
    const prev = item.getFlag(FLAG_SCOPE, FLAG_WOO_PREV)
      ?? item.getFlag(FLAG_SCOPE, "wooArmorPrev")
      ?? { canIgnoreArmor: false, ignoreArmorPercent: 0 };

    const updates = {
      "system.canIgnoreArmor": prev.canIgnoreArmor,
      "system.ignoreArmorPercent": prev.ignoreArmorPercent
    };
    if (prev.weaponSkill !== undefined) {
      updates["system.weaponSkill"] = prev.weaponSkill;
    }

    await item.update(updates);
    await item.unsetFlag(FLAG_SCOPE, FLAG_WOO_PREV);
    if (item.getFlag(FLAG_SCOPE, "wooArmorPrev")) {
      await item.unsetFlag(FLAG_SCOPE, "wooArmorPrev");
    }
  }
}

async function setFlagToggle(item, key, next) {
  try {
    await item.setFlag(FLAG_SCOPE, key, next);
    if (key === FLAG_WOO) {
      await applyWooEffects(item, next);
    }
  } catch (err) {
    logError(`toggle ${key}`, err, true);
  }
}

// ---------------- Actor sheet: Martial Arts toggles ----------------

function makeToggleLi(item, label, flagKey) {
  const checked = !!item.getFlag(FLAG_SCOPE, flagKey);
  const li = document.createElement("li");
  li.className = "sanctum-ma-toggle";
  li.innerHTML = `
    <span class="text-padding-sides-small">${label}</span>
    <a class="fire-checkbox" data-item-id="${item.id}">
      <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
    </a>`;
  li.querySelector("a").addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setFlagToggle(item, flagKey, !item.getFlag(FLAG_SCOPE, flagKey));
  });
  return li;
}

function injectMartialArtsToggles(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor || !el.querySelector(".weapon-grid")) return;

  el.querySelectorAll(".weapon-grid li.sanctum-ma-toggle").forEach(li => li.remove());

  for (const grid of el.querySelectorAll(".weapon-grid[data-item-id]")) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!item || item.type !== "weapon") continue;
    const list = grid.querySelector("ul");
    if (!list) continue;

    let added = false;

    if (hasKyudo(item)) {
      list.appendChild(makeToggleLi(item, "Hassetsu", FLAG_HASSETSU));
      added = true;
    }

    if (hasMilitechCommando(item)) {
      list.appendChild(makeToggleLi(item, "Combat Knife Training", FLAG_COMBAT_KNIFE));
      added = true;
    }

    if (hasGunFu(item)) {
      list.appendChild(makeToggleLi(item, "Woo Technique", FLAG_WOO));
      added = true;
    }

    if (added) {
      grid.style.height = "auto";
      grid.style.minHeight = "80px";
    }
  }
}

// ---------------- Damage Roll Hook ----------------

function wrapDamageRoll(cprRoll, item) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumMaWrapped) {
    return cprRoll;
  }

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumMaWrapped = true;

  cprRoll.roll = async function (...args) {
    if (typeof this.formula === "string") {
      const before = this.formula;
      let next = this.formula;

      if (isCombatKnife(item)) {
        next = setDiceInFormula(next, 4, 6);
      }

      if (isWooTechnique(item)) {
        const unarmedDice = getUnarmedDiceCount(item.actor);
        const currentDice = getFirstDiceCount(next);
        if (unarmedDice > currentDice) {
          next = setDiceInFormula(next, unarmedDice, 6);
        }
      }

      if (isHassetsu(item)) {
        next = addDiceToFormula(next, 2);
      }

      if (next !== before) {
        this.formula = next;
        console.log(`%c${LOG_PREFIX} ${item.name} ${before} -> ${this.formula}`, "color: #9c27b0");
      }
    }

    return origRoll(...args);
  };

  return cprRoll;
}

// ---------------- Registration (once) ----------------

function patchProto(proto) {
  if (!proto?.createRoll || proto.createRoll.__sanctumMartialArts) return false;
  const orig = proto.createRoll;
  const wrapped = function (type, ...rest) {
    const result = orig.call(this, type, ...rest);
    if (type !== "damage") return result;

    if (!isHassetsu(this) && !isCombatKnife(this) && !isWooTechnique(this)) {
      return result;
    }

    if (result instanceof Promise) {
      return result.then(r => wrapDamageRoll(r, this));
    }
    return wrapDamageRoll(result, this);
  };
  wrapped.__sanctumMartialArts = true;
  proto.createRoll = wrapped;
  return true;
}

const HOOKS = [
  ["renderActorSheet", (app, html) => injectMartialArtsToggles(app, html)],
  ["renderActorSheetV2", (app, html) => injectMartialArtsToggles(app, html)],
  ["updateItem", (item, changes, _options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "weapon" || !item.actor || !changes.system?.installedItems) return;

    if (item.getFlag(FLAG_SCOPE, FLAG_HASSETSU) && !hasKyudo(item)) {
      setFlagToggle(item, FLAG_HASSETSU, false);
    }
    if (item.getFlag(FLAG_SCOPE, FLAG_COMBAT_KNIFE) && !hasMilitechCommando(item)) {
      setFlagToggle(item, FLAG_COMBAT_KNIFE, false);
    }
    if (item.getFlag(FLAG_SCOPE, FLAG_WOO) && !hasGunFu(item)) {
      setFlagToggle(item, FLAG_WOO, false);
    }
  }]
];

function register() {
  const prev = globalThis._sanctumMaHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumMaHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  let patched = patchProto(CONFIG.Item.documentClass?.prototype);
  const sampleWeapon = game.items?.find(i => i.type === "weapon")
    ?? game.actors?.contents.flatMap(a => a.items.contents).find(i => i.type === "weapon");
  if (sampleWeapon) {
    patched = patchProto(Object.getPrototypeOf(sampleWeapon)) || patched;
  }

  if (patched) {
    console.log(`%c${LOG_PREFIX} Ready (Kyudo / Militech Commando / Gun Fu)`, "color: #9c27b0; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find createRoll to patch`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
