// ============================================
// Sanctum - Advanced Dice & Buffer Stock (Roll Extra & Drop Lowest)
// - "Advanced Dice X": Adds X extra dice & drops lowest on non-Autofire damage rolls
// - "Buffer Stock": Rolls 3d6 & drops lowest on Autofire damage rolls
// Displays dropped dice using the native d6 face tinted to #880425FF
// ============================================

console.log("%cSanctum Advanced Dice | Loading", "color: #00bcd4; font-weight: bold");

const LOG_PREFIX = "Sanctum Advanced Dice |";
const UPGRADE_REGEX = /advanced\s*dice(?:\s*(\d+))?/i;
const BUFFER_STOCK_REGEX = /buffer\s*stock/i;
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

function getUpgradeData(item) {
  const data = { extraDice: 0, bufferStock: false };
  if (!item || item.type !== "weapon" || !item.actor) return data;

  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return data;

  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (!upg || upg.type !== "itemUpgrade") continue;
    const name = upg.name || "";

    const advMatch = name.match(UPGRADE_REGEX);
    if (advMatch) {
      data.extraDice += advMatch[1] ? parseInt(advMatch[1], 10) : 1;
    }

    if (BUFFER_STOCK_REGEX.test(name)) {
      data.bufferStock = true;
    }
  }
  return data;
}

function addDiceToFormula(formula, extra) {
  if (!formula || !extra) return formula;
  return formula.replace(/(\d+)d(\d+)/i, (_, count, sides) => {
    return `${parseInt(count, 10) + extra}d${sides}`;
  });
}

function applyDropLowest(cprRoll, dropCount, autofire = false) {
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

  const mult = autofire
    ? (Number(cprRoll.autofireMultiplier ?? cprRoll.multiplier ?? 1) || 1)
    : 1;

  if (typeof cprRoll.initialRoll === "number") cprRoll.initialRoll -= droppedSum;
  if (typeof cprRoll.resultTotal === "number") cprRoll.resultTotal -= droppedSum * mult;

  // Recalculate Critical Injury (2+ sixes among kept dice)
  if ("isCritical" in cprRoll) {
    cprRoll.isCritical = faces.filter(f => f === 6).length >= 2;
  }

  lastDropped = { dropped, time: Date.now() };
  const label = autofire ? "Buffer Stock (Autofire)" : "Advanced Dice";
  console.log(`%c${LOG_PREFIX} ${label} | Kept [${faces.join(", ")}] | Dropped [${dropped.join(", ")}] | Total: ${cprRoll.resultTotal}`, "color: #00bcd4");
}

function wrapDamageRoll(cprRoll, opts) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumAdvWrapped) return cprRoll;

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumAdvWrapped = true;

  cprRoll.roll = async function (...args) {
    const autofire = opts.weaponIsAutofire || isAutofireRoll(this);
    const dropCount = autofire ? (opts.bufferStock ? 1 : 0) : opts.extraDice;

    if (dropCount <= 0) {
      return origRoll(...args);
    }

    if (typeof this.formula === "string") {
      this.formula = addDiceToFormula(this.formula, dropCount);
    }

    await origRoll(...args);
    applyDropLowest(this, dropCount, autofire);
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

    for (const val of dropped) {
      const src = baseSrc.replace(/(d6[_-])\d+/i, `$1${val}`);

      const wrap = document.createElement("span");
      wrap.title = `Dropped lowest (${val})`;
      wrap.style.position = "relative";
      wrap.style.display = "inline-block";
      wrap.style.lineHeight = "0";
      wrap.style.verticalAlign = "middle";
      wrap.style.isolation = "isolate";

      const img = diceImg.cloneNode(true);
      img.setAttribute("src", src);
      img.style.display = "block";
      img.style.filter = "contrast(1.4) brightness(0.85)";

      const tint = document.createElement("span");
      tint.style.position = "absolute";
      tint.style.inset = "0";
      tint.style.backgroundColor = DROPPED_COLOR;
      tint.style.mixBlendMode = "lighten";
      tint.style.pointerEvents = "none";
      tint.style.webkitMaskImage = `url("${src}")`;
      tint.style.maskImage = `url("${src}")`;
      tint.style.webkitMaskSize = "contain";
      tint.style.maskSize = "contain";
      tint.style.webkitMaskRepeat = "no-repeat";
      tint.style.maskRepeat = "no-repeat";
      tint.style.webkitMaskPosition = "center";
      tint.style.maskPosition = "center";

      wrap.appendChild(img);
      wrap.appendChild(tint);
      container.appendChild(wrap);
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
    if (type !== "damage") return result;

    const { extraDice, bufferStock } = getUpgradeData(this);
    if (extraDice <= 0 && !bufferStock) return result;

    const opts = {
      extraDice,
      bufferStock,
      weaponIsAutofire: isAutofireWeapon(this)
    };

    if (result instanceof Promise) {
      return result.then(r => wrapDamageRoll(r, opts));
    }
    return wrapDamageRoll(result, opts);
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
