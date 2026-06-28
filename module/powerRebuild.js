console.log("=== powerRebuild.js loaded ===");

Hooks.once("ready", () => {
  console.log("Power Rebuild: Ready");
});

/**
 * Helper to check if a weapon has a specific upgrade installed.
 */
function hasUpgradeInstalled(weapon, upgradeName) {
    const installedIds = weapon.system.installedItems?.list || [];
    const actor = weapon.actor;
    if (!actor) return false;

    return installedIds.some(id => {
        const item = actor.items.get(id);
        return item && item.name.toLowerCase().includes(upgradeName.toLowerCase());
    });
}

Hooks.on("createChatMessage", async (message) => {
  // 1. Basic validation
  if (!message?.content || game.userId !== message.author?.id) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // 2. Check for Critical Damage indicator
  const critText = html.querySelector(".d6-data-div")?.textContent || "";
  const isCrit = critText.includes("Critical Damage");
  if (!isCrit) return;

  // 3. Identify the Actor and Weapon
  const actor = game.actors.get(message.speaker.actor);
  const weaponName = html.querySelector(".chat-rollTitle-stat .text-center")?.textContent?.trim();
  
  if (!actor || !weaponName) return;

  const weapon = actor.items.find(i => i.name === weaponName && i.type === "weapon");
  if (!weapon) return;

  // 4. Verify the "Power Rebuild" upgrade is installed
  if (!hasUpgradeInstalled(weapon, "Power Rebuild")) {
    return; 
  }

  // 5. Target validation
  const targets = Array.from(game.user.targets);
  if (targets.length !== 1) {
    ui.notifications.warn("Target exactly one token to apply Power Rebuild damage.");
    return;
  }

  // 6. Apply direct damage
  const targetActor = targets[0].actor;
  const currentHp = targetActor.system.derivedStats.hp.value;

  await targetActor.update({
    "system.derivedStats.hp.value": Math.max(0, currentHp - 5)
  });

  // 7. Notify in chat
  await ChatMessage.create({
    speaker: { alias: "Power Rebuild" },
    content: `
      <div class="cpr-block">
        <div class="text-normal text-semi" style="margin-left: 12px;">
          Critical Damage
        </div>
        <div class="text-normal" style="margin-left: 12px;">
          ${targetActor.name} suffers <b>5 direct damage</b> from Power Rebuild.
        </div>
      </div>
    `
  });

  ui.notifications.info(`${weapon.name} triggered Power Rebuild`);
});
