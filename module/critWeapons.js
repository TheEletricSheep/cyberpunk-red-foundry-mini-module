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

  const macro =
    game.macros.getName("Power Rebuild");

  if (!macro) {
    ui.notifications.warn(
      "Power Rebuild macro not found."
    );
    return;
  }

  if (isPowerWeapon) {

    console.log(
      `${weaponName} triggered TWO critical effects`
    );

    await macro.execute();
    await macro.execute();

    ui.notifications.info(
      `${weaponName} triggered two critical effects`
    );

  } else {

    console.log(
      `${weaponName} triggered a critical effect`
    );

    await macro.execute();

    ui.notifications.info(
      `${weaponName} triggered a critical effect`
    );
  }

});
