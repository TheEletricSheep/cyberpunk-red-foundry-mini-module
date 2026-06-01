console.log("=== critWeapons.js loaded ===");

Hooks.once("ready", () => {
  console.log("Crit Weapons: Ready");
});

Hooks.on("createChatMessage", async (message) => {

  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  const weaponName = html.querySelector(
    ".chat-rollTitle-stat .text-center"
  )?.textContent?.trim();

  if (!weaponName) return;

  const lowerName = weaponName.toLowerCase();

  const isCritWeapon =
    lowerName.includes("(crit)");

  const isPowerWeapon =
    lowerName.includes("(power)");

  // Only damage cards
  if (!html.querySelector(".d6-rollcard-data")) {
    return;
  }

  // Ignore normal CPR critical injuries
  const critText =
    html.querySelector(".d6-data-div")?.textContent || "";

  const isSystemCritical =
    critText.includes("Critical Damage");

  if (isSystemCritical) {
    console.log(
      `${weaponName}: System critical detected, ignoring module crit`
    );
    return;
  }

  const dice = [];

  html.querySelectorAll(".d6-dice-div img").forEach(img => {

    const match = img.src.match(/d6_(\d)\.svg/i);

    if (match) {
      dice.push(Number(match[1]));
    }

  });

  console.log(
    `${weaponName} damage dice:`,
    dice
  );

  const ammoType = html.querySelector(
    ".rollcard-subtitle-2-center"
  )?.textContent?.trim()?.toLowerCase() ?? "";

  const isExplosiveAmmo =
    ammoType.includes("explosive");

  const critDice =
    dice.filter(d => d >= 5);

  const naturalCrit =
    critDice.length >= 2;

  console.log(
    `${weaponName} ammo type:`,
    ammoType
  );

  console.log(
    `${weaponName} natural crit:`,
    naturalCrit
  );

  console.log(
    `${weaponName} explosive ammo:`,
    isExplosiveAmmo
  );

  // Module crit conditions:
  // - Explosive ammo
  // - OR (CRIT weapon + natural crit)
  const shouldTrigger =
    isExplosiveAmmo ||
    (isCritWeapon && naturalCrit);

  if (!shouldTrigger) {
    return;
  }

  async function applyCriticalDamage() {

    const targets = Array.from(game.user.targets);

    if (targets.length !== 1) {
      ui.notifications.warn(
        "Target exactly one token."
      );
      return;
    }

    const actor = targets[0].actor;

    const currentHp =
      actor.system.derivedStats.hp.value;

    await actor.update({
      "system.derivedStats.hp.value":
        Math.max(0, currentHp - 5)
    });

    await ChatMessage.create({
      content: `
        <div class="cpr-block">
          <div
            class="text-normal text-semi"
            style="margin-left: 12px;"
          >
            Critical Damage
          </div>

          <div
            class="text-normal"
            style="margin-left: 12px;"
          >
            ${actor.name} suffers
            <b>5 direct damage</b>.
          </div>
        </div>
      `
    });

  }

  const triggerCount =
    isPowerWeapon ? 2 : 1;

  console.log(
    `${weaponName} triggered ${triggerCount} module critical effect(s)`
  );

  for (let i = 0; i < triggerCount; i++) {
    await applyCriticalDamage();
  }

  ui.notifications.info(
    `${weaponName} triggered ${triggerCount} critical effect${triggerCount > 1 ? "s" : ""}`
  );

});
