// ============================================
// Sanctum - Armor Piercing Upgrade (Standalone)
// Automatically detects installed "Armor Piercing" upgrade
// Adds +1 extra armor ablation to damage rolls
// ============================================

console.log("%cSanctum Armor Piercing | Loading", "color: #ff5722; font-weight: bold");

const LOG_PREFIX = "Sanctum Armor Piercing |";
const UPGRADE_REGEX = /armor\s*piercing/i;

let lastApRoll = null;

// ---------------- Helpers ----------------

function getArmorPiercingBonus(item) {
  if (!item || item.type !== "weapon" || !item.actor) return 0;
  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return 0;

  let bonus = 0;
  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (!upg || upg.type !== "itemUpgrade") continue;
    if (UPGRADE_REGEX.test(upg.name || "")) bonus += 1;
  }
  return bonus;
}

// ---------------- Roll & Ablation Hooks ----------------

function wrapDamageRoll(cprRoll, bonusAblation) {
  if (!cprRoll || typeof cprRoll.roll !== "function" || cprRoll._sanctumApWrapped) {
    return cprRoll;
  }

  const origRoll = cprRoll.roll.bind(cprRoll);
  cprRoll._sanctumApWrapped = true;

  cprRoll.roll = async function (...args) {
    let appliedOnRoll = false;
    if (typeof this.ablation === "number") {
      this.ablation += bonusAblation;
      appliedOnRoll = true;
    }

    lastApRoll = { appliedOnRoll, bonusAblation, time: Date.now() };
    console.log(`%c${LOG_PREFIX} +${bonusAblation} ablation`, "color: #ff5722");
    return origRoll(...args);
  };

  return cprRoll;
}

function onPreCreateChatMessage(message, data) {
  if (!lastApRoll || Date.now() - lastApRoll.time > 5000) return;

  const content = data.content ?? message.content ?? "";
  if (!content.includes('data-action="applyDamage"')) return;

  const { appliedOnRoll, bonusAblation } = lastApRoll;
  lastApRoll = null;

  if (appliedOnRoll) return;

  const updated = content.replace(/data-ablation="(\d+)"/gi, (_, val) => {
    return `data-ablation="${parseInt(val, 10) + bonusAblation}"`;
  });

  if (updated !== content) {
    message.updateSource({ content: updated });
  }
}

// ---------------- Registration (once) ----------------

function patchProto(proto) {
  if (!proto?.createRoll || proto.createRoll.__sanctumArmorPiercing) return false;
  const orig = proto.createRoll;
  const wrapped = function (type, ...rest) {
    const result = orig.call(this, type, ...rest);
    if (type !== "damage") return result;

    const bonus = getArmorPiercingBonus(this);
    if (bonus <= 0) return result;

    if (result instanceof Promise) {
      return result.then(r => wrapDamageRoll(r, bonus));
    }
    return wrapDamageRoll(result, bonus);
  };
  wrapped.__sanctumArmorPiercing = true;
  proto.createRoll = wrapped;
  return true;
}

const HOOKS = [
  ["preCreateChatMessage", onPreCreateChatMessage]
];

function register() {
  const prev = globalThis._sanctumApHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumApHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  let patched = patchProto(CONFIG.Item.documentClass?.prototype);
  const sampleWeapon = game.items?.find(i => i.type === "weapon")
    ?? game.actors?.contents.flatMap(a => a.items.contents).find(i => i.type === "weapon");
  if (sampleWeapon) {
    patched = patchProto(Object.getPrototypeOf(sampleWeapon)) || patched;
  }

  if (patched) {
    console.log(`%c${LOG_PREFIX} Ready (Hooked createRoll)`, "color: #ff5722; font-weight: bold");
  } else {
    console.warn(`${LOG_PREFIX} Could not find createRoll to patch`);
  }
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
