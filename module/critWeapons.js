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

  const isCritWeapon = lowerName.includes("(crit)");
  const isPowerWeapon = lowerName.includes("(power)");

  if (!isCritWeapon && !isPowerWeapon) {
    return;
  }

  // Only damage cards
  if (!html.querySelector(".d6-rollcard-data")) {
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

  const critDice = dice.filter(d => d >= 5);

  if (critDice.length < 2) {
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
<div class="rollcard">
  <div class="rollcard-top">
    <div class="cpr-block chat-rollTitle-stat">

      <div class="text-center text-padding-top text-normal text-semi">
        Critical Damage
      </div>

      <div class="rollcard-subtitle">
        <div class="rollcard-subtitle-center text-small">
          Direct Damage
        </div>
      </div>

    </div>
  </div>

  <div class="rollcard-bottom">
    <div class="cpr-block">

      <div class="d6-rollcard-data">

        <div class="d6-dice-div">
          <img
            class="d6 d6-60"
            src="systems/cyberpunk-red-core/icons/dice/black/d6_5.svg"
          />
        </div>

        <div class="d6-number-div">
          <span>5</span>
        </div>

        <div class="d6-data-div">
          <div class="text-normal text-semi">
            ${actor.name}
          </div>

          <div class="d6-data-details">
            Suffers 5 direct damage
          </div>
        </div>

      </div>

    </div>
  </div>
</div>
`
});

  }

  if (isPowerWeapon) {

    console.log(
      `${weaponName} triggered TWO critical effects`
    );

    await applyCriticalDamage();
    await applyCriticalDamage();

    ui.notifications.info(
      `${weaponName} triggered two critical effects`
    );

  } else {

    console.log(
      `${weaponName} triggered a critical effect`
    );

    await applyCriticalDamage();

    ui.notifications.info(
      `${weaponName} triggered a critical effect`
    );
  }

});
