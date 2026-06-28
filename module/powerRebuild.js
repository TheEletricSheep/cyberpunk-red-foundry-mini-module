console.log("=== powerRebuild.js loaded ===");

Hooks.on("createChatMessage", async (message) => {
  // 1. Only process if this is a message from the current user
  if (game.userId !== message.author?.id) return;
  if (!message.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // 2. Look for the damage card structure specifically
  // CPR Core damage cards use the 'rollcard' class
  const isRollCard = html.querySelector(".rollcard");
  if (!isRollCard) return;

  // 3. Verify it is a Damage roll (CPR damage cards contain this)
  const isDamage = html.innerHTML.includes("Damage");
  if (!isDamage) return;

  // 4. Identify the weapon name from the header
  const weaponName = html.querySelector(".text-center")?.textContent?.trim();
  if (!weaponName || !weaponName.toLowerCase().includes("(power)")) return;

  // 5. Look for "Critical" in the dice details section
  // In CPR, critical info is often inside the hidden details or the card subtitle
  const d6Details = html.querySelector(".d6-data-details")?.textContent || "";
  const isCrit = d6Details.includes("Critical") || html.innerHTML.includes("Critical");
  
  if (!isCrit) return;

  // 6. Get the actor and verify the upgrade
  const actor = game.actors.get(message.speaker.actor);
  if (!actor) return;

  const weapon = actor.items.find(i => i.name === weaponName && i.type === "weapon");
  if (!weapon) return;

  // Verify the "Power Rebuild" upgrade is installed
  if (!hasUpgradeInstalled(weapon, "Power Rebuild")) return;

  // 7. Apply the damage
  const targets = Array.from(game.user.targets);
  if (targets.length !== 1) {
    ui.notifications.warn("Target exactly one token to apply Power Rebuild damage.");
    return;
  }

  const targetActor = targets[0].actor;
  const currentHp = targetActor.system.derivedStats.hp.value;

  await targetActor.update({
    "system.derivedStats.hp.value": Math.max(0, currentHp - 5)
  });

  await ChatMessage.create({
    speaker: { alias: "Power Rebuild" },
    content: `
      <div class="rollcard">
        <div class="rollcard-bottom">
          <div class="cpr-block" style="padding: 10px;">
            <div class="text-normal">
              ${targetActor.name} suffers <b>5 direct damage</b> from Power Rebuild.
            </div>
          </div>
        </div>
      </div>
    `
  });
});

function hasUpgradeInstalled(weapon, upgradeName) {
    const installedIds = weapon.system.installedItems?.list || [];
    const actor = weapon.actor;
    if (!actor) return false;
    return installedIds.some(id => {
        const item = actor.items.get(id);
        return item && item.name.toLowerCase().includes(upgradeName.toLowerCase());
    });
}
