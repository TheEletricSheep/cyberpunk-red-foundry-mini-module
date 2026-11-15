// ============================================
// Sanctum - Power Rebuild (Direct Damage Auto-Apply)
// ============================================
import {
  FLAG_SCOPE, LOG_PREFIX, isMessageAuthor, isDamageRollCard, 
  getDamageCardTitle, resolveSpeakerActor, findWeaponsByTitle
} from "./shared.js";

console.log(`${LOG_PREFIX} Power Rebuild (Direct Damage) loaded`);

Hooks.once("ready", () => {
  console.log(`${LOG_PREFIX} Power Rebuild: Ready`);
});

Hooks.on("createChatMessage", async (message) => {
  // 1. MULTIPLAYER SAFETY: Only the client who rolled the damage should process this, 
  // otherwise every connected player will subtract 5 HP simultaneously!
  if (!isMessageAuthor(message)) return;
  if (!message?.content) return;

  const content = message.content;

  // 2. Validate it's actually a CPR Damage Roll card
  if (!isDamageRollCard(content)) return;

  // 3. Did it Crit?
  if (!content.includes("Critical Damage")) return;

  // 4. Extract weapon name using shared.js helper
  const weaponName = getDamageCardTitle(content);
  if (!weaponName) return;

  // 5. Check if it's a Power Weapon (checks both your UI flag AND name fallback)
  const speakerActor = resolveSpeakerActor(message.speaker);
  let isPowerWeapon = false;

  if (speakerActor) {
    const matchedWeapons = findWeaponsByTitle(speakerActor, weaponName);
    isPowerWeapon = matchedWeapons.some(w => w.getFlag(FLAG_SCOPE, "isPowerWeapon"));
  }

  // Fallback to name check if flags aren't applied
  if (!isPowerWeapon && !weaponName.toLowerCase().includes("(power)")) {
    return;
  }

  // 6. Target validation
  const targets = Array.from(game.user.targets);

  if (targets.length !== 1) {
    ui.notifications.warn("Power Rebuild: Please target exactly one token to auto-apply the 5 direct damage.");
    return;
  }

  const targetActor = targets[0].actor;
  if (!targetActor) return;

  // 7. Auto-deduct the 5 HP directly
  const currentHp = targetActor.system.derivedStats.hp.value;
  
  await targetActor.update({
    "system.derivedStats.hp.value": Math.max(0, currentHp - 5)
  });

  // 8. Output Chat Message to confirm deduction
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
