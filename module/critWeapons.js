console.log("=== critWeapons.js loaded ===");

Hooks.once("ready", () => {
  console.log("Crit Weapons: Ready");
});

Hooks.on("createChatMessage", async (message) => {

  if (!message?.rolls?.length) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  const weaponName = html.querySelector(
    ".chat-rollTitle-stat .text-center"
  )?.textContent?.trim();

  if (!weaponName) return;

  const lowerName = weaponName.toLowerCase();

  const isCritWeapon = lowerName.includes("(crit)");
  const isPowerWeapon = lowerName.includes("(power)");

  if (!isCritWeapon && !isPowerWeapon) return;

  const roll = message.rolls[0];

  if (!roll?.dice?.length) return;

  const d6Results = [];

  for (const die of roll.dice) {

    if (die.faces !== 6) continue;

    for (const result of die.results) {

      if (result.discarded) continue;

      d6Results.push(result.result);

    }
  }

  const critDice =
    d6Results.filter(r => r >= 5);

  const critCount =
    Math.floor(critDice.length / 2);

  if (critCount < 1) return;

  console.log(
    `Crit Weapons: ${weaponName} triggered ${critCount} crit(s)`
  );

  const macro =
    game.macros.getName("Power Rebuild");

  if (!macro) {
    ui.notifications.warn(
      "Power Rebuild macro not found."
    );
    return;
  }

  for (let i = 0; i < critCount; i++) {
    await macro.execute();
  }

  ui.notifications.info(
    `${weaponName} triggered ${critCount} critical effect(s)`
  );

});
