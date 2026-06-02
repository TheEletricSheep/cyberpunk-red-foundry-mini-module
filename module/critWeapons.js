console.log("=== critWeapons.js loaded ===");

const recentAttacks = {};

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

  // --------------------------------------------------
  // TRACK ATTACK CARDS
  // --------------------------------------------------

  const isAttackCard =
    html.querySelector(".d10-rollcard-data");

  if (isAttackCard) {

    const cardText =
      html.textContent?.toLowerCase() ?? "";

    const isMeleeAttack =
      cardText.includes("melee weapon");

    const actorId = html.querySelector(
      "[data-actor-id]"
    )?.dataset?.actorId;

    let hasRedLace = false;

    if (actorId) {

      const attacker =
        game.actors.get(actorId);

      if (attacker) {

        const effectNames =
          attacker.effects.map(
            e => e.name.toLowerCase()
          );

        hasRedLace =
          effectNames.includes("red lace");
      }
    }

    recentAttacks[weaponName] = {
      melee: isMeleeAttack,
      hasRedLace,
      timestamp: Date.now()
    };

    console.log(
      `Stored attack for ${weaponName}`,
      recentAttacks[weaponName]
    );

    return;
  }

  // --------------------------------------------------
  // DAMAGE CARDS ONLY
  // --------------------------------------------------

  if (!html.querySelector(".d6-rollcard-data")) {
    return;
  }

  const lowerName =
    weaponName.toLowerCase();

  const isCritWeapon =
    lowerName.includes("(crit)");

  const isPowerWeapon =
    lowerName.includes("(power)");

  const critText =
    html.querySelector(".d6-data-div")
      ?.textContent || "";

  const isSystemCritical =
    critText.includes("Critical Damage");

  if (isSystemCritical) {

    console.log(
      `${weaponName}: System critical detected, ignoring module crit`
    );

    return;
  }

  const dice = [];

  html.querySelectorAll(
    ".d6-dice-div img"
  ).forEach(img => {

    const match =
      img.src.match(/d6_(\d)\.svg/i);

    if (match) {
      dice.push(Number(match[1]));
    }

  });

  const ammoType =
    html.querySelector(
      ".rollcard-subtitle-2-center"
    )?.textContent?.trim()?.toLowerCase() ?? "";

  const isExplosiveAmmo =
    ammoType.includes("explosive");

  const critDice =
    dice.filter(d => d >= 5);

  const naturalCrit =
    critDice.length >= 2;

  // --------------------------------------------------
  // RED LACE MELEE CHECK
  // --------------------------------------------------

  let redLaceMeleeTrigger = false;

  const attackData =
    recentAttacks[weaponName];

  if (attackData) {

    const age =
      Date.now() - attackData.timestamp;

    if (
      age < 60000 &&
      attackData.melee &&
      attackData.hasRedLace
    ) {

      redLaceMeleeTrigger = true;

      console.log(
        `${weaponName} triggered by Red Lace melee attack`
      );
    }
  }

  console.log(
    `${weaponName} natural crit:`,
    naturalCrit
  );

  console.log(
    `${weaponName} explosive ammo:`,
    isExplosiveAmmo
  );

  console.log(
    `${weaponName} red lace melee:`,
    redLaceMeleeTrigger
  );

  // --------------------------------------------------
  // TRIGGER CONDITIONS
  // --------------------------------------------------

  const shouldTrigger =
    isExplosiveAmmo ||
    (isCritWeapon && naturalCrit) ||
    redLaceMeleeTrigger;

  if (!shouldTrigger) {
    return;
  }

  async function applyCriticalDamage() {

    const targets =
      Array.from(game.user.targets);

    if (targets.length !== 1) {

      ui.notifications.warn(
        "Target exactly one token."
      );

      return;
    }

    const actor =
      targets[0].actor;

    const currentHp =
      actor.system.derivedStats.hp.value;

    await actor.update({
      "system.derivedStats.hp.value":
        Math.max(
          0,
          currentHp - 5
        )
    });

    await ChatMessage.create({
      content: `
        <div class="cpr-block">

          <div
            class="text-normal text-semi"
            style="margin-left:12px;"
          >
            Critical Damage
          </div>

          <div
            class="text-normal"
            style="margin-left:12px;"
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

  for (
    let i = 0;
    i < triggerCount;
    i++
  ) {
    await applyCriticalDamage();
  }

  ui.notifications.info(
    `${weaponName} triggered ${triggerCount} critical effect${triggerCount > 1 ? "s" : ""}`
  );

});
