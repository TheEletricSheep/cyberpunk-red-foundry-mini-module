console.log("Sanctum Ammo Hooks 2.1 + Crit Weapons | Loading...");

const ammoHookList = [
  "_explosiveDamageHookId",
  "_explosiveCritHookId",
  "_explosiveUpdateHookId",
  "_highPrecisionHookId",
  "_ammoReminderHookId",
  "_critWeaponsHookId" // Added the new crit weapons hook
];

ammoHookList.forEach(id => {
  if (window[id]) {
    Hooks.off("renderCPRRollDialog", window[id]);
    Hooks.off("createChatMessage", window[id]);
    Hooks.off("updateActor", window[id]);
    delete window[id];
  }
});

if (!window._ammoHookProcessed) window._ammoHookProcessed = new WeakMap();
if (!window._sanctumProcessed) window._sanctumProcessed = new Set();
if (!window._explosiveProcessed) window._explosiveProcessed = new Set();
if (!window._explosivePending) window._explosivePending = new Map();

// ============================================================
// SHARED HELPERS
// ============================================================
function getDiceValues(content) {
  const values = [];
  const regex = /d6_(\d)(_preem)?\.svg/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    values.push(parseInt(match[1]));
  }
  if (values.length === 0) {
    const numbers = [...content.matchAll(/>([1-6])</g)].map(m => parseInt(m[1]));
    if (numbers.length >= 3) values.push(...numbers.slice(0, 6));
  }
  return values;
}

function alreadyProcessed(id) {
  if (window._sanctumProcessed.has(id)) return true;
  window._sanctumProcessed.add(id);
  if (window._sanctumProcessed.size > 100) {
    const first = window._sanctumProcessed.values().next().value;
    window._sanctumProcessed.delete(first);
  }
  return false;
}

function getSelectedFireMode(itemId) {
  if (!itemId) return null;
  const checkboxes = document.querySelectorAll(`a.fire-checkbox[data-item-id="${itemId}"]`);
  for (const a of checkboxes) {
    const icon = a.querySelector("i");
    if (icon && icon.classList.contains("fa-circle-dot")) {
      return a.dataset.fireMode; // "aimed" | "autofire" | "suppressive"
    }
  }
  return null;
}

function canUseHighPrecision(actor, item) {
  if (!actor || !item) return false;
  let soloRank = 0;
  const roleInfo = actor.system?.roleInfo;
  if (roleInfo) {
    if (roleInfo.activeRole?.toLowerCase() === "solo") {
      soloRank = roleInfo.rank ?? roleInfo.roleRank ?? roleInfo.value ?? 0;
    }
    if (roleInfo.roles) {
      const solo = Object.values(roleInfo.roles).find(r => 
        (r.name || r.role || "").toLowerCase() === "solo"
      );
      if (solo) soloRank = solo.rank ?? solo.value ?? solo.level ?? 0;
    }
  }
  if (soloRank < 1) {
    const soloItem = actor.items.find(i => 
      i.type === "role" && i.name.toLowerCase() === "solo"
    );
    if (soloItem) {
      soloRank = soloItem.system?.rank ?? soloItem.system?.value ?? soloItem.system?.level ?? 0;
    }
  }
  if (soloRank >= 1) {
    console.log("%c[High Precision] Qualified via Solo role (rank " + soloRank + ")", "color: #7dffa0");
    return true;
  }
  const skillName = item.system?.weaponSkill || item.system?.skill || "";
  if (!skillName) {
    console.log("%c[High Precision] No weapon skill found on item", "color: orange");
    return false;
  }
  const skillItem = actor.items.find(i => 
    i.type === "skill" && i.name.toLowerCase() === skillName.toLowerCase()
  );
  let skillRank = 0;
  if (skillItem) {
    skillRank = skillItem.system?.level ?? skillItem.system?.value ?? skillItem.system?.rank ?? 0;
  } else {
    const skills = actor.system?.skills || {};
    const skillData = skills[skillName] || skills[skillName.toLowerCase()];
    if (skillData) {
      skillRank = skillData.level ?? skillData.value ?? skillData.rank ?? 0;
    }
  }
  if (skillRank >= 7) {
    console.log(`%c[High Precision] Qualified via ${skillName} skill rank: ${skillRank}`, "color: #7dffa0");
    return true;
  }
  console.log("%c[High Precision] NOT qualified", "color: #ff5252", { soloRank, skillName, skillRank });
  return false;
}

// ============================================================
// CRIT WEAPONS LOGIC
// ============================================================
window._critWeaponsHookId = Hooks.on("createChatMessage", async (message) => {
  // Multiplayer safety: ensure only the person who rolled triggers this
  const authorId = message.author?.id || message.user?.id;
  if (authorId !== game.user.id) return;

  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  const weaponName = html.querySelector(".chat-rollTitle-stat .text-center")?.textContent?.trim();
  if (!weaponName) return;

  const lowerName = weaponName.toLowerCase();
  const isCritWeapon = lowerName.includes("(crit)");
  const isPowerWeapon = lowerName.includes("(power)");

  // Only damage cards
  if (!html.querySelector(".d6-rollcard-data")) return;

  // Ignore normal CPR critical injuries
  const critText = html.querySelector(".d6-data-div")?.textContent || "";
  const isSystemCritical = critText.includes("Critical Damage");

  if (isSystemCritical) {
    console.log(`${weaponName}: System critical detected, ignoring module crit`);
    return;
  }

  // Use the shared getDiceValues helper to read the dice
  const dice = getDiceValues(message.content);
  console.log(`${weaponName} damage dice:`, dice);

  const ammoType = html.querySelector(".rollcard-subtitle-2-center")?.textContent?.trim()?.toLowerCase() ?? "";
  const isExplosiveAmmo = ammoType.includes("explosive");

  const critDice = dice.filter(d => d >= 5);
  const naturalCrit = critDice.length >= 2;

  console.log(`${weaponName} ammo type:`, ammoType);
  console.log(`${weaponName} natural crit:`, naturalCrit);
  console.log(`${weaponName} explosive ammo:`, isExplosiveAmmo);

  // Module crit conditions: Explosive ammo OR (CRIT weapon + natural crit)
  const shouldTrigger = isExplosiveAmmo || (isCritWeapon && naturalCrit);
  if (!shouldTrigger) return;

  async function applyCriticalDamage() {
    const targets = Array.from(game.user.targets);

    if (targets.length !== 1) {
      ui.notifications.warn("Target exactly one token.");
      return;
    }

    const actor = targets[0].actor;
    const currentHp = actor.system.derivedStats.hp.value;

    await actor.update({
      "system.derivedStats.hp.value": Math.max(0, currentHp - 5)
    });

    await ChatMessage.create({
      content: `
        <div class="cpr-block">
          <div class="text-normal text-semi" style="margin-left: 12px;">
            Critical Damage
          </div>
          <div class="text-normal" style="margin-left: 12px;">
            ${actor.name} suffers <b>5 direct damage</b>.
          </div>
        </div>
      `
    });
  }

  const triggerCount = isPowerWeapon ? 2 : 1;
  console.log(`${weaponName} triggered ${triggerCount} module critical effect(s)`);

  for (let i = 0; i < triggerCount; i++) {
    await applyCriticalDamage();
  }

  ui.notifications.info(`${weaponName} triggered ${triggerCount} critical effect${triggerCount > 1 ? "s" : ""}`);
});

// ============================================================
// EXPLOSIVE AMMO (Sanctum Trackers)
// ============================================================
window._explosiveCritHookId = Hooks.on("createChatMessage", async (message) => {
  try {
    const authorId = message.author?.id || message.user?.id;
    if (authorId !== game.user.id) return;
    if (window._explosiveProcessed.has(message.id)) return;
    window._explosiveProcessed.add(message.id);
    if (window._explosiveProcessed.size > 80) {
      window._explosiveProcessed.delete(window._explosiveProcessed.values().next().value);
    }

    const content = message.content || "";
    const lower = content.toLowerCase();

    if (!/explosive/i.test(content)) return;
    if (!content.includes("d6-rollcard-data") && !lower.includes("damage")) return;
    if (content.includes("Explosive Critical")) return;

    const dice = getDiceValues(content);
    if (!dice.length) return;

    const sixes = dice.filter(v => v === 6).length;
    const highDice = dice.filter(v => v >= 5).length;

    if (sixes >= 2) return;
    if (highDice < 2) return;

    let targets = [...game.user.targets];
    if (!targets.length) targets = canvas.tokens.placeables.filter(t => t.isTargeted);
    if (!targets.length) {
      return ui.notifications.warn("Explosive Ammo: No targets selected.");
    }

    for (const token of targets) {
      const actor = token.actor;
      if (!actor) continue;

      const hpPaths = ["system.derivedStats.hp.value", "system.stats.hp.value", "system.hp.value"];
      let hpPath, currentHP;
      for (const p of hpPaths) {
        const val = foundry.utils.getProperty(actor, p);
        if (typeof val === "number") {
          hpPath = p;
          currentHP = val;
          break;
        }
      }
      if (!hpPath) continue;

      window._explosivePending.set(actor.id, {
        token, actor, hpPath, lastSeenHP: currentHP, bonusActive: false
      });
    }

    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background:#8b0000;border:1px solid #ff4444;">
        <b style="color:#ff5555;">Explosive Critical</b><br>
        5s count as 6s.<br>
        <b>+5 applies after GM damage.<br>
        Re-apply / revert supported.</b>
      </div>`,
      type: message.type,
      whisper: message.whisper
    }, { chatBubble: false });

  } catch (err) {
    console.error("[Sanctum] Explosive Crit error:", err);
  }
});

window._explosiveUpdateHookId = Hooks.on("updateActor", async (actor) => {
  const data = window._explosivePending.get(actor.id);
  if (!data) return;

  const currentHP = foundry.utils.getProperty(actor, data.hpPath);
  if (typeof currentHP !== "number") return;

  const prev = data.lastSeenHP;

  if (currentHP < prev && !data.bonusActive) {
    data.bonusActive = true;
    const newHP = Math.max(0, currentHP - 5);
    await actor.update({ [data.hpPath]: newHP });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ token: data.token }),
      content: `<div class="cpr-block" style="padding:6px 10px;background:#5a0000;border:1px solid #ff4444;">
        <b style="color:#ff5555;">Explosive</b> +5 applied to <b>${data.token.name}</b>
      </div>`
    });
  }
  else if (currentHP > prev && data.bonusActive) {
    data.bonusActive = false;
    await actor.update({ [data.hpPath]: currentHP + 5 });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ token: data.token }),
      content: `<div class="cpr-block" style="padding:6px 10px;background:#333;border:1px solid #888;">
        <b style="color:#aaa;">Explosive</b> +5 <b>reverted</b> on <b>${data.token.name}</b>
      </div>`
    });
  }

  data.lastSeenHP = foundry.utils.getProperty(actor, data.hpPath);
});

// ============================================================
// TO-HIT MODIFIERS (High Precision & Tracers)
// ============================================================
window._highPrecisionHookId = Hooks.on("renderCPRRollDialog", (app, html) => {
  if (!window._ammoHookProcessed) window._ammoHookProcessed = new WeakMap();
  if (window._ammoHookProcessed.has(app)) return;
  window._ammoHookProcessed.set(app, true);

  try {
    const { actor, item } = app;
    if (!item || item.type !== "weapon") return;

    const title = (html.closest(".app")?.find(".window-title").text() || "").toLowerCase();
    const bodyText = html.text().toLowerCase();

    const isDamageDialog =
      title.includes("damage") || title.includes("rolling damage") ||
      bodyText.includes("rolling damage") || bodyText.includes("damage:") ||
      bodyText.includes("damage 5d6") || bodyText.includes("damage 4d6") ||
      bodyText.includes("damage 3d6") || bodyText.includes("damage 2d6") ||
      bodyText.includes("damage 1d6");

    if (isDamageDialog) {
      console.log("%c→ Skipping DAMAGE dialog", "color: orange");
      return;
    }

    const installed = item.system?.installedItems?.list || [];
    const ammoItems = installed.map(id => actor.items.get(id)).filter(a => a?.type === "ammo");

    const hasTracer = ammoItems.some(a => a.system?.type === "tracer" || /tracer/i.test(a.name));
    const hasHighPrecision = ammoItems.some(a => a.system?.type === "highprecision" || /high.?precision/i.test(a.name));
    const hasExplosive = ammoItems.some(a => a.system?.type === "explosive" || /explosive/i.test(a.name));

    const selectedMode = getSelectedFireMode(item.id);
    const isSuppressive = selectedMode === "suppressive";
    const isAutofire = selectedMode === "autofire";
    const isAimed = selectedMode === "aimed";

    const precisionAllowed = hasHighPrecision ? canUseHighPrecision(actor, item) : false;

    console.log("%c[Sanctum FireMode]", "color: #00e5ff", {
      selectedMode, isAimed, isAutofire, isSuppressive, hasTracer, hasHighPrecision, precisionAllowed
    });

    const modInput = html.find("input[name='additionalMods']");
    if (!modInput.length) return;

    const applyMods = () => {
      let added = 0;
      const messages = [];

      if (hasHighPrecision && precisionAllowed && !isAutofire && !isSuppressive) {
        if (isAimed) { added += 2; messages.push("High Precision Ammo: +2 To Hit (Aimed)"); } 
        else { added += 1; messages.push("High Precision Ammo: +1 To Hit"); }
      } else if (hasHighPrecision && !precisionAllowed) {
        messages.push("High Precision Ammo: Requires Solo (any rank) or Weapon Skill 7+");
      }

      if (hasTracer && isAutofire && !isSuppressive) {
        added += 1; messages.push("Tracer Ammo: +1 To Hit (Autofire)");
      }

      if (hasExplosive) {
        if (isAimed) { added -= 100; messages.push("Explosive Ammo: –100 To Hit (Aimed)"); } 
        else { added -= 2; messages.push("Explosive Ammo: –2 To Hit"); }
      }

      console.log("%c[Sanctum Mods]", "color: #ffeb3b", { added, messages });

      html.find("p.sanctum-ammo-msg").remove();

      if (added !== 0 || messages.length) {
        if (added !== 0) {
          modInput.val(added);
          const el = modInput[0];
          el.dispatchEvent(new Event("focus", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
          modInput.trigger("focus").trigger("input").trigger("change").trigger("blur");
        } else {
          modInput.val(0);
          modInput.trigger("input").trigger("change");
        }
        messages.forEach(msg => {
          const color = msg.includes("Requires") ? "#ff9800" : "#e74c3c";
          modInput.closest(".form-group").after(
            `<p class="sanctum-ammo-msg" style="color:${color};font-weight:bold;margin:6px 0;">${msg}</p>`
          );
        });
      } else {
        modInput.val(0);
        modInput.trigger("input").trigger("change");
      }
    };

    setTimeout(applyMods, 100);
  } catch (err) {
    console.error("[Sanctum] To-hit error:", err);
  }
});

// ============================================================
// OTHER AMMO REMINDERS
// ============================================================
window._ammoReminderHookId = Hooks.on("createChatMessage", (message) => {
  const authorId = message.author?.id || message.user?.id;
  if (authorId !== game.user.id) return;
  if (alreadyProcessed(message.id + "-reminder")) return;

  const c = (message.content || "").toLowerCase();
  if (!c.includes("rollcard-data")) return;

  const dice = getDiceValues(message.content);

  if (c.includes("burrowing") && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Burrowing Ammo</b><br>Critical Injuries are harder to Quick Fix (DV +2).</div>`
    }, { chatBubble: false });
  }

  if (c.includes("high velocity") || c.includes("highvelocity")) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>High Velocity Ammo</b><br>Target takes –2 to Dodge.</div>`
    }, { chatBubble: false });
  }

  if (c.includes("hyper expansive") && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Hyper Expansive Ammo</b><br>Extra Critical Injury roll.</div>`
    }, { chatBubble: false });
  }

  if ((c.includes("hollow point") || c.includes("serrated")) && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Hollow Point / Serrated</b><br>+1 Base Death Save + possible extra Injury.</div>`
    }, { chatBubble: false });
  }
});

console.log("Sanctum Ammo Hooks 2.1 + Crit Weapons | Ready");
