// ============================================
// Sanctum - Shotgun Rechamber
// Adds +1d6 to Shotgun Shell damage rolls only (skips slugs & Autofire)
// ============================================

console.log("%cSanctum Shotgun Rechamber | Loading", "color: #ff9800; font-weight: bold");

const LOG_PREFIX = "Sanctum Shotgun Rechamber |";
const UPGRADE_REGEX = /shotgun\s*rechamber/i;
const SHELL_REGEX = /shell/i;

// ---------------- Helpers ----------------

function isAutofireWeapon(item) {
  const firetype = item?.getFlag?.("cyberpunk-red-core", "firetype")
    ?? item?.flags?.["cyberpunk-red-core"]?.firetype;
  return String(firetype || "").toLowerCase() === "autofire";
}

function isAutofireRoll(cprRoll) {
  return !!(
    cprRoll?.isAutofire
    || cprRoll?.autofire
    || /autofire/i.test(cprRoll?.rollTitle || "")
  );
}

function isShotgunShellLoaded(item) {
  if (!item || !item.actor) return false;

  const installedIds = item.system?.installedItems?.list;
  if (Array.isArray(installedIds)) {
    for (const id of installedIds) {
      const installed = item.actor.items.get(id);
      if (!installed || installed.type !== "ammo") continue;
      if (SHELL_REGEX.test(installed.system?.variety || "") || SHELL_REGEX.test(installed.name || "")) {
        return true;
      }
    }
  }

  const magName = item.system?.magazine?.ammoData?.name || "";
  return SHELL_REGEX.test(magName);
}

function getRechamberBonus(item) {
  if (!item || item.type !== "weapon" || !item.actor) return 0;
  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return 0;

  let bonus = 0;
  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (!upg || upg.type !== "itemUpgrade") continue;
    if (UPGRADE_REGEX.test(upg.name || "")) {
      bonus += 1;
    }
  }
  return bonus;
}

function addDiceToFormula(formula, extra) {
  if (!formula || !extra) return formula;
  return formula.replace(/(\d+)d(\d+)/i, (_, count, sides) => {
    return `${parseInt(count, 10) + extra}d${sides}`;
  });
}

function wrapDamageRoll(cprRoll, bonusDice, weaponIsAutofire) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumRechamberWrapped) {
    return cprRoll;
  }

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumRechamberWrapped = true;

  cprRoll.roll = async function (...args) {
    if (weaponIsAutofire || isAutofireRoll(this)) {
      return origRoll(...args);
    }

    if (typeof this.formula === "string") {
      const before = this.formula;
      this.formula = addDiceToFormula(this.formula, bonusDice);
      console.log(`%c${LOG_PREFIX} Shell ${before} -> ${this.formula}`, "color: #ff9800");
    }

    return origRoll(...args);
  };

  return cprRoll;
}

// ---------------- Registration ----------------

function patchProto(proto) {
  if (!proto?.createRoll || proto.createRoll.__sanctumRechamber) return false;
  const orig = proto.createRoll;
  const wrapped = function (type, ...rest) {
    const result = orig.call(this, type, ...rest);
    if (type !== "damage") return result;

    const bonusDice = getRechamberBonus(this);
    if (bonusDice <= 0 || !isShotgunShellLoaded(this)) return result;

    const weaponIsAutofire = isAutofireWeapon(this);
    if (result instanceof Promise) {
      return result.then(r => wrapDamageRoll(r, bonusDice, weaponIsAutofire));
    }
    return wrapDamageRoll(result, bonusDice, weaponIsAutofire);
  };
  wrapped.__sanctumRechamber = true;
  proto.createRoll = wrapped;
  return true;
}

function register() {
  let patched = patchProto(CONFIG.Item.documentClass?.prototype);
  const sampleWeapon = game.items?.find(i => i.type === "weapon")
    ?? game.actors?.contents.flatMap(a => a.items.contents).find(i => i.type === "weapon");
  if (sampleWeapon) {
    patched = patchProto(Object.getPrototypeOf(sampleWeapon)) || patched;
  }

  if (patched) {
    console.log(`%c${LOG_PREFIX} Ready (Hooked createRoll)`, "color: #ff9800; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find createRoll to patch`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
