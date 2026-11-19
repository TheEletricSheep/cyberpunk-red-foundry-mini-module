// ============================================
// Sanctum - Advanced Dice (Roll & Keep / Advantage)
// Automatically detects installed upgrades on weapons
// ============================================

console.log("%cSanctum Advanced Dice | Loading", "color: #00bcd4; font-weight: bold");

const LOG_PREFIX = "Sanctum Advanced Dice |";

// ============================================
// CUSTOMIZE YOUR UPGRADES HERE
// ============================================
const RULES = [
  {
    upgradeName: "advanced dice", // Matches any installed itemUpgrade containing this text
    mode: "dropLowest",           // "dropLowest" | "dropHighest" | "advantage"
    extraDice: 1                  // Number of extra dice to roll & drop (ignored for "advantage")
  }
  // Example of adding a second upgrade:
  // {
  //   upgradeName: "precision barrel",
  //   mode: "advantage",
  //   extraDice: 0
  // }
];

// ---------------- Helpers ----------------

function getMatchingRule(item) {
  if (!item || item.type !== "weapon" || !item.actor) return null;
  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return null;

  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (!upg || upg.type !== "itemUpgrade") continue;
    const name = (upg.name || "").toLowerCase();
    const match = RULES.find(r => name.includes(r.upgradeName.toLowerCase()));
    if (match) return match;
  }
  return null;
}

function addDiceToFormula(formula, extra) {
  if (!formula || !extra) return formula;
  return formula.replace(/(\d+)d(\d+)/i, (_, count, sides) => {
    return `${parseInt(count, 10) + extra}d${sides}`;
  });
}

function applyDropLogic(cprRoll, mode, dropCount) {
  if (!Array.isArray(cprRoll.faces) || cprRoll.faces.length <= dropCount) return;

  const faces = [...cprRoll.faces];
  const dropped = [];

  for (let i = 0; i < dropCount; i++) {
    const targetVal = mode === "dropLowest" ? Math.min(...faces) : Math.max(...faces);
    const idx = faces.indexOf(targetVal);
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

  // Show dropped dice in the roll title on the chat card
  const label = mode === "dropLowest" ? "Dropped lowest" : "Dropped highest";
  if (typeof cprRoll.rollTitle === "string") {
    cprRoll.rollTitle = `${cprRoll.rollTitle} (${label}: ${dropped.join(", ")})`;
  }
}

function wrapDamageRoll(cprRoll, rule) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumAdvWrapped) return cprRoll;

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumAdvWrapped = true;

  cprRoll.roll = async function (...args) {
    if (rule.mode === "advantage") {
      // First roll
      await origRoll(...args);
      const first = {
        faces: Array.isArray(this.faces) ? [...this.faces] : this.faces,
        resultTotal: this.resultTotal,
        initialRoll: this.initialRoll,
        isCritical: this.isCritical,
        _roll: this._roll
      };

      // Second roll
      await origRoll(...args);
      const secondTotal = this.resultTotal ?? 0;
      const firstTotal = first.resultTotal ?? 0;

      if (firstTotal > secondTotal) {
        this.faces = first.faces;
        this.resultTotal = first.resultTotal;
        this.initialRoll = first.initialRoll;
        this.isCritical = first.isCritical;
        this._roll = first._roll;
      }

      if (typeof this.rollTitle === "string") {
        const lower = Math.min(firstTotal, secondTotal);
        this.rollTitle = `${this.rollTitle} (Adv, dropped: ${lower})`;
      }
      return this;
    }

    // dropLowest / dropHighest
    const extra = Math.max(1, Number(rule.extraDice) || 1);
    if (typeof this.formula === "string") {
      this.formula = addDiceToFormula(this.formula, extra);
    }

    await origRoll(...args);
    applyDropLogic(this, rule.mode, extra);
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
      const rule = getMatchingRule(this);
      if (rule && cprRoll) {
        return wrapDamageRoll(cprRoll, rule);
      }
      return cprRoll;
    };
    wrapped.__sanctumAdvDice = true;
    proto._createDamageRoll = wrapped;
    console.log(`%c${LOG_PREFIX} Ready (${RULES.length} rule(s) loaded)`, "color: #00bcd4; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find Item.prototype._createDamageRoll`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
