// ============================================
// Sanctum - Advanced Dice (Roll Extra & Drop Lowest)
// Automatically reads the number from installed "Advanced Dice X" upgrades
// ============================================

console.log("%cSanctum Advanced Dice | Loading", "color: #00bcd4; font-weight: bold");

const LOG_PREFIX = "Sanctum Advanced Dice |";
const UPGRADE_REGEX = /advanced\s*dice(?:\s*(\d+))?/i;

// ---------------- Helpers ----------------

function getExtraDiceCount(item) {
  if (!item || item.type !== "weapon" || !item.actor) return 0;
  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return 0;

  let total = 0;
  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (!upg || upg.type !== "itemUpgrade") continue;
    const match = (upg.name || "").match(UPGRADE_REGEX);
    if (match) {
      total += match[1] ? parseInt(match[1], 10) : 1;
    }
  }
  return total;
}

function addDiceToFormula(formula, extra) {
  if (!formula || !extra) return formula;
  return formula.replace(/(\d+)d(\d+)/i, (_, count, sides) => {
    return `${parseInt(count, 10) + extra}d${sides}`;
  });
}

function applyDropLowest(cprRoll, dropCount) {
  if (!Array.isArray(cprRoll.faces) || cprRoll.faces.length <= dropCount) return;

  const faces = [...cprRoll.faces];
  const dropped = [];

  for (let i = 0; i < dropCount; i++) {
    const lowest = Math.min(...faces);
    const idx = faces.indexOf(lowest);
    if (idx !== -1) {
      dropped.push(faces.splice(idx, 1)[0]);
    }
  }

  const droppedSum = dropped.reduce((a, b) => a + b, 0);
  cprRoll.faces = faces;

  if (typeof cprRoll.resultTotal === "number") cprRoll.resultTotal -= droppedSum;
  if (typeof cprRoll.initialRoll === "number") cprRoll.initialRoll -= droppedSum;

  // Recalculate Critical Injury (2+ sixes among kept dice)
  if ("isCritical" in cprRoll) {
    cprRoll.isCritical = faces.filter(f => f === 6).length >= 2;
  }

  if (typeof cprRoll.rollTitle === "string") {
    cprRoll.rollTitle = `${cprRoll.rollTitle} (Dropped lowest: ${dropped.join(", ")})`;
  }
}

function wrapDamageRoll(cprRoll, extraDice) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumAdvWrapped) return cprRoll;

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumAdvWrapped = true;

  cprRoll.roll = async function (...args) {
    if (typeof this.formula === "string") {
      this.formula = addDiceToFormula(this.formula, extraDice);
    }

    await origRoll(...args);
    applyDropLowest(this, extraDice);
    return this;
  };

  return cprRoll;
}

// ---------------- Registration ----------------

function register() {
  const ItemClass = CONFIG.Item.documentClass;
  const proto = ItemClass?.prototype;

  if (proto?._createDamageRoll && !proto._createDamageRoll.__sanctumAdvDice) {
    const orig = proto._createDamageRoll;
    const wrapped = function (...args) {
      const cprRoll = orig.apply(this, args);
      const extraDice = getExtraDiceCount(this);
      if (extraDice > 0 && cprRoll) {
        return wrapDamageRoll(cprRoll, extraDice);
      }
      return cprRoll;
    };
    wrapped.__sanctumAdvDice = true;
    proto._createDamageRoll = wrapped;
    console.log(`%c${LOG_PREFIX} Ready (Dynamic Upgrade Detection)`, "color: #00bcd4; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find Item.prototype._createDamageRoll`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
