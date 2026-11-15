// ============================================
// Sanctum - Tech & Power Rebuild 
// Includes UI Flags, Tech Charged Toggle, and Power Direct Damage
// (No Ammo Deduction)
// ============================================
import {
  FLAG_SCOPE, LOG_PREFIX, getElement, logError, isMessageAuthor,
  isDamageRollCard, getDamageCardTitle, resolveSpeakerActor,
  findWeaponsByTitle
} from "./shared.js";

console.log(`${LOG_PREFIX} Tech & Power Rebuild loaded`);

Hooks.once("ready", () => {
  console.log(`${LOG_PREFIX} Tech & Power Rebuild: Ready`);
});

// ============================================
// 1. ITEM SHEET: Inject Tech & Power Flags
// ============================================
function doInjectWeapon(html, item) {
  const el = getElement(html);
  if (!el || !item || item.type !== "weapon") return false;
  if (el.querySelector(".tech-power-flags")) return true;
  
  const supLi = Array.from(el.querySelectorAll("li.item"))
    .find(li => li.textContent.includes("Has Suppressive Fire"));
  if (!supLi) return false;

  const makeRow = (label, key) => {
    const checked = !!item.getFlag(FLAG_SCOPE, key);
    const li = document.createElement("li");
    li.className = "item flexrow tech-power-flags";
    const iconClass = checked ? "far fa-circle-check" : "far fa-circle";
    li.innerHTML = `
      <div class="item flexrow setting-name text-nowrap">${label}</div>
      <div class="item flexrow setting-value text-nowrap item-end">
        <a class="item-checkbox" data-flag="${key}"><i class="${iconClass}"></i></a>
      </div>`;
      
    li.querySelector("a.item-checkbox").addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      try {
        await item.setFlag(FLAG_SCOPE, key, !item.getFlag(FLAG_SCOPE, key));
      } catch (err) {
        logError(`toggle ${key}`, err, true);
      }
    });
    return li;
  };

  supLi.insertAdjacentElement("afterend", makeRow("Has Power Rebuild", "isPowerWeapon"));
  supLi.insertAdjacentElement("afterend", makeRow("Has Tech Rebuild", "isTechWeapon"));
  return true;
}

function tryInjectWeapon(app, html) {
  const item = app.item ?? app.document;
  if (!item || item.type !== "weapon") return;
  if (doInjectWeapon(html, item)) return;
  setTimeout(() => doInjectWeapon(getElement(app.element) || getElement(html), item), 100);
}

// ============================================
// 2. ACTOR SHEET: Tech Weapon Charged Toggle
// ============================================
async function applyChargedEffects(item, charged) {
  if (charged) {
    let prev = item.getFlag(FLAG_SCOPE, "chargedArmorPrev");
    if (!prev) {
      prev = {
        canIgnoreArmor: !!item.system?.canIgnoreArmor,
        ignoreArmorPercent: Number(item.system?.ignoreArmorPercent) || 0
      };
      await item.setFlag(FLAG_SCOPE, "chargedArmorPrev", prev);
    }
    const keepNative = prev.canIgnoreArmor && prev.ignoreArmorPercent >= 50;
    if (!keepNative) await item.update({ "system.canIgnoreArmor": true, "system.ignoreArmorPercent": 50 });
  } else {
    const prev = item.getFlag(FLAG_SCOPE, "chargedArmorPrev")
      ?? { canIgnoreArmor: false, ignoreArmorPercent: 0 };
    await item.update({
      "system.canIgnoreArmor": prev.canIgnoreArmor,
      "system.ignoreArmorPercent": prev.ignoreArmorPercent
    });
    await item.unsetFlag(FLAG_SCOPE, "chargedArmorPrev");
  }
}

async function setCharged(item, next) {
  try {
    await item.setFlag(FLAG_SCOPE, "isCharged", next);
    await applyChargedEffects(item, next);
  } catch (err) {
    logError("Charged toggle", err, true);
  }
}

function injectCharged(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor || !el.querySelector(".weapon-grid")) return;

  el.querySelectorAll(".weapon-grid li").forEach(li => {
    if (li.textContent.trim().startsWith("Charged")) li.remove();
  });

  for (const grid of el.querySelectorAll(".weapon-grid[data-item-id]")) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!item?.getFlag(FLAG_SCOPE, "isTechWeapon")) continue;
    const list = grid.querySelector("ul");
    if (!list) continue;

    const checked = !!item.getFlag(FLAG_SCOPE, "isCharged");
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="text-padding-sides-small">Charged</span>
      <a class="fire-checkbox" data-item-id="${item.id}">
        <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
      </a>`;
      
    li.querySelector("a").addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setCharged(item, !item.getFlag(FLAG_SCOPE, "isCharged"));
    });
    list.appendChild(li);
    grid.style.height = "auto";
    grid.style.minHeight = "80px";

    const autofire = list.querySelector('a.fire-checkbox[data-fire-mode="autofire"]');
    if (autofire && !autofire.dataset.chargedListener) {
      autofire.dataset.chargedListener = "1";
      autofire.addEventListener("click", () => {
        if (item.getFlag(FLAG_SCOPE, "isCharged")) setCharged(item, false);
      });
    }
  }
}

// ============================================
// 3. CHAT MESSAGE: Power Rebuild Direct Damage
// ============================================
Hooks.on("createChatMessage", async (message) => {
  // Multiplayer safety: only process on the client that made the roll
  if (!isMessageAuthor(message)) return;
  if (!message?.content) return;

  const content = message.content;
  if (!isDamageRollCard(content)) return;
  if (!content.includes("Critical Damage")) return;

  const weaponName = getDamageCardTitle(content);
  if (!weaponName) return;

  const speakerActor = resolveSpeakerActor(message.speaker);
  let isPowerWeapon = false;

  if (speakerActor) {
    const matchedWeapons = findWeaponsByTitle(speakerActor, weaponName);
    isPowerWeapon = matchedWeapons.some(w => w.getFlag(FLAG_SCOPE, "isPowerWeapon"));
  }

  if (!isPowerWeapon && !weaponName.toLowerCase().includes("(power)")) {
    return;
  }

  const targets = Array.from(game.user.targets);

  if (targets.length !== 1) {
    ui.notifications.warn("Power Rebuild: Please target exactly one token to auto-apply the 5 direct damage.");
    return;
  }

  const targetActor = targets[0].actor;
  if (!targetActor) return;

  const currentHp = targetActor.system.derivedStats.hp.value;
  await targetActor.update({
    "system.derivedStats.hp.value": Math.max(0, currentHp - 5)
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="cpr-block">
        <div class="text-normal text-semi" style="margin-left: 12px;">
          Power Rebuild Critical
        </div>
        <div class="text-normal" style="margin-left: 12px;">
          <b>${targetActor.name}</b> suffers <b>5 direct damage</b>.
        </div>
      </div>
    `
  });

  ui.notifications.info(`${weaponName} triggered Power Rebuild`);
});

// ============================================
// 4. REGISTER UI HOOKS
// ============================================
Hooks.on("renderItemSheet", tryInjectWeapon);
Hooks.on("renderItemSheetV2", tryInjectWeapon);
Hooks.on("renderActorSheet", injectCharged);
Hooks.on("renderActorSheetV2", injectCharged);
