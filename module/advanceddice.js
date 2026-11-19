// ============================================
// Sanctum - Advanced Dice (Roll Extra & Drop Lowest)
// Automatically reads the number from installed "Advanced Dice X" upgrades
// Skips Autofire damage rolls & displays dropped dice faces in #880425FF
// ============================================

console.log("%cSanctum Advanced Dice | Loading", "color: #00bcd4; font-weight: bold");

const LOG_PREFIX = "Sanctum Advanced Dice |";
const UPGRADE_REGEX = /advanced\s*dice(?:\s*(\d+))?/i;
const DROPPED_COLOR = "#880425FF";

let lastDropped = null;

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

  lastDropped = { dropped, time: Date.now() };
  console.log(`%c${LOG_PREFIX} Kept [${faces.join(", ")}] | Dropped [${dropped.join(", ")}] | Total: ${cprRoll.resultTotal}`, "color: #00bcd4");
}

function wrapDamageRoll(cprRoll, extraDice) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumAdvWrapped) return cprRoll;

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumAdvWrapped = true;

  cprRoll.roll = async function (...args) {
    if (isAutofireRoll(this)) {
      return origRoll(...args);
    }

    if (typeof this.formula === "string") {
      this.formula = addDiceToFormula(this.formula, extraDice);
    }

    await origRoll(...args);
    applyDropLowest(this, extraDice);
    return this;
  };

  return cprRoll;
}

function onPreCreateChatMessage(message, data) {
  if (!lastDropped || Date.now() - lastDropped.time > 5000) return;

  const content = data.content ?? message.content ?? "";
  if (!content.includes('data-action="applyDamage"')) return;

  const { dropped } = lastDropped;
  lastDropped = null;

  const div = document.createElement("div");
  div.innerHTML = content;

  // Match CPR's existing d6 dice images inside the card
  const diceImg = div.querySelector('img[src*="d6_"], img[src*="d6-"]');
  if (diceImg && diceImg.parentElement) {
    const container = diceImg.parentElement;
    const baseSrc = diceImg.getAttribute("src") || diceImg.src;
    const w = diceImg.getAttribute("width");
    const h = diceImg.getAttribute("height");

    for (const val of dropped) {
      const src = baseSrc.replace(/(d6[_-])\d+/i, `$1${val}`);
      const die = document.createElement("span");
      die.className = diceImg.className;
      die.title = `Dropped lowest (${val})`;
      die.style.display = "inline-block";
      die.style.backgroundColor = DROPPED_COLOR;
      die.style.webkitMaskImage = `url("${src}")`;
      die.style.maskImage = `url("${src}")`;
      die.style.webkitMaskSize = "contain";
      die.style.maskSize = "contain";
      die.style.webkitMaskRepeat = "no-repeat";
      die.style.maskRepeat = "no-repeat";
      die.style.webkitMaskPosition = "center";
      die.style.maskPosition = "center";
      die.style.verticalAlign = "middle";
      if (w) die.style.width = /^\d+$/.test(w) ? `${w}px` : w;
      if (h) die.style.height = /^\d+$/.test(h) ? `${h}px` : h;
      container.appendChild(die);
    }

    message.updateSource({ content: div.innerHTML });
    return;
  }

  // Fallback if no d6 image was found in the template
  const badges = dropped
    .map(v => `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:${DROPPED_COLOR};color:#fff;font-weight:bold;margin:0 2px;" title="Dropped lowest (${v})">${v}</span>`)
    .join("");
  const note = `<div class="text-small text-center" style="margin-top:4px;">Dropped: ${badges}</div>`;
  message.updateSource({ content: content + note });
}

// ---------------- Registration ----------------

function patchProto(proto) {
  if (!proto?.createRoll || proto.createRoll.__sanctumAdvDice) return false;
  const orig = proto.createRoll;
  const wrapped = function (type, ...rest) {
    const result = orig.call(this, type, ...rest);
    if (type !== "damage" || isAutofireWeapon(this)) return result;

    const extraDice = getExtraDiceCount(this);
    if (extraDice <= 0) return result;

    if (result instanceof Promise) {
      return result.then(r => wrapDamageRoll(r, extraDice));
    }
    return wrapDamageRoll(result, extraDice);
  };
  wrapped.__sanctumAdvDice = true;
  proto.createRoll = wrapped;
  return true;
}

function register() {
  if (globalThis._sanctumAdvDiceHook) {
    Hooks.off("preCreateChatMessage", globalThis._sanctumAdvDiceHook);
  }
  globalThis._sanctumAdvDiceHook = Hooks.on("preCreateChatMessage", onPreCreateChatMessage);

  let patched = patchProto(CONFIG.Item.documentClass?.prototype);
  const sampleWeapon = game.items?.find(i => i.type === "weapon")
    ?? game.actors?.contents.flatMap(a => a.items.contents).find(i => i.type === "weapon");
  if (sampleWeapon) {
    patched = patchProto(Object.getPrototypeOf(sampleWeapon)) || patched;
  }

  if (patched) {
    console.log(`%c${LOG_PREFIX} Ready (Hooked createRoll)`, "color: #00bcd4; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find createRoll to patch`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
