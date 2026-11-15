// ============================================
// Sanctum - Aimed Modifiers (Headhopper / Headtoll)
// Actually changes weapon damage while Aimed is selected!
// Automatically verifies installed upgrades (No toggles needed).
// ============================================

console.log("%cSanctum Aimed Modifiers | Loading...", "color: #9c27b0; font-weight: bold");

const FLAG_SCOPE = "world";
const LOG_PREFIX = "Sanctum Aimed Modifiers |";

function logError(context, err) {
  console.error(`${LOG_PREFIX} ${context}:`, err);
}

function getElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  return null;
}

function incrementDamageString(dmg, bonus) {
  if (!dmg) return dmg;
  return dmg.replace(/(\d+)d6/i, (match, p1) => {
    return (parseInt(p1) + bonus) + "d6";
  });
}

// ============================================
// 1. UPGRADE VERIFICATION
// ============================================

/**
 * Looks at the weapon's installed upgrades and counts how many
 * Headhopper or Headtoll upgrades are attached to it.
 */
function getUpgradeBonus(item) {
  if (!item || !item.actor || !item.system?.installedItems?.list) return 0;
  
  let bonus = 0;
  const upgradeIds = item.system.installedItems.list;
  
  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (upg && upg.type === "itemUpgrade") {
      const lowerName = (upg.name || "").toLowerCase();
      if (lowerName.includes("headhopper") || lowerName.includes("headtoll")) {
        bonus += 1;
      }
    }
  }
  return bonus;
}

// ============================================
// 2. DAMAGE SYNC LOGIC
// ============================================

const isSyncing = new Set();

/**
 * Checks the actor sheet UI to see if "Aimed" is currently selected for this weapon.
 */
function checkAimedStateFromUI(item) {
  if (!item || !item.actor) return false;
  // Look for the weapon grid on an open actor sheet
  const grid = document.querySelector(`.weapon-grid[data-item-id="${item.id}"]`);
  if (grid) {
    const aimedIcon = grid.querySelector('.fire-checkbox[data-fire-mode="aimed"] i');
    return aimedIcon ? aimedIcon.classList.contains("fa-circle-dot") : false;
  }
  return false;
}

/**
 * Applies or removes the damage buff based on the current UI state and installed upgrades.
 */
async function syncWeaponDamage(item, isAimed) {
  if (!item || item.type !== "weapon" || !item.actor) return;
  
  // Prevent infinite loops if multiple clicks happen rapidly
  if (isSyncing.has(item.id)) return;
  isSyncing.add(item.id);

  try {
    const targetBonus = getUpgradeBonus(item);
    const activeBonus = item.getFlag(FLAG_SCOPE, "aimedBuffActive") || 0;
    const baseDamage = item.getFlag(FLAG_SCOPE, "aimedBaseDamage");

    const shouldBeBuffed = isAimed && targetBonus > 0;

    if (shouldBeBuffed) {
      // Needs buff. Has the target bonus changed? (e.g. installed an upgrade while already Aimed)
      if (activeBonus !== targetBonus) {
        // Save base damage if we haven't already
        const currentBase = baseDamage || item.system.damage;
        if (!baseDamage) {
          await item.setFlag(FLAG_SCOPE, "aimedBaseDamage", currentBase);
        }

        const newDmg = incrementDamageString(currentBase, targetBonus);
        console.log(`%c${LOG_PREFIX} Updating ${item.name} to ${newDmg} (Aimed is ON, Upgrades: ${targetBonus})`, "color: #9c27b0");
        
        await item.update({ "system.damage": newDmg });
        await item.setFlag(FLAG_SCOPE, "aimedBuffActive", targetBonus);
      }
    } else {
      // Should NOT be buffed. Revert if currently buffed.
      if (activeBonus > 0 && baseDamage) {
        console.log(`%c${LOG_PREFIX} Reverting ${item.name} to ${baseDamage} (Aimed is OFF or Upgrades Removed)`, "color: #9c27b0");
        await item.update({ "system.damage": baseDamage });
        await item.unsetFlag(FLAG_SCOPE, "aimedBuffActive");
        await item.unsetFlag(FLAG_SCOPE, "aimedBaseDamage");
      }
    }
  } catch (err) {
    logError("syncWeaponDamage", err);
  } finally {
    isSyncing.delete(item.id);
  }
}

// ============================================
// 3. LISTEN TO ACTOR SHEET FIRE MODES
// ============================================

function injectActorSheet(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor) return;

  const grids = el.querySelectorAll(".weapon-grid[data-item-id]");
  for (const grid of grids) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!item || item.type !== "weapon") continue;

    // 1. Check current status immediately on render
    const aimedBox = grid.querySelector('.fire-checkbox[data-fire-mode="aimed"] i');
    const isAimed = aimedBox ? aimedBox.classList.contains("fa-circle-dot") : false;
    syncWeaponDamage(item, isAimed);

    // 2. Attach click listeners to all fire mode buttons for this weapon
    const allFireBoxes = grid.querySelectorAll('.fire-checkbox');
    for (const box of allFireBoxes) {
      if (!box.dataset.sanctumAimedListener) {
        box.dataset.sanctumAimedListener = "1";
        box.addEventListener("click", () => {
          // Wait a tiny moment for CPR to update the DOM dots, then check state
          setTimeout(() => {
            const currentAimedIcon = grid.querySelector('.fire-checkbox[data-fire-mode="aimed"] i');
            const currentlyAimed = currentAimedIcon ? currentAimedIcon.classList.contains("fa-circle-dot") : false;
            syncWeaponDamage(item, currentlyAimed);
          }, 50);
        });
      }
    }
  }
}

// ============================================
// REGISTRATION
// ============================================

const HOOKS = [
  ["renderActorSheet", injectActorSheet],
  ["renderActorSheetV2", injectActorSheet],
  
  // Extra safety: If they install/uninstall an upgrade while the gun is aimed, automatically resync it!
  ["updateItem", (item, changes) => {
    if (item.type === "weapon" && item.actor && changes.system?.installedItems) {
      setTimeout(() => syncWeaponDamage(item, checkAimedStateFromUI(item)), 200);
    }
  }]
];

function register() {
  const prev = globalThis._sanctumAimedModsHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumAimedModsHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  console.log(`%c${LOG_PREFIX} Ready (Automatic Upgrade Verification)`, "color: #9c27b0; font-weight: bold");
}

if (game.ready) register();
else Hooks.once("ready", register);
