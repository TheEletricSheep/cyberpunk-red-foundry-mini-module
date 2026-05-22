Hooks.once("ready", () => {
  console.log("Power Rebuild: Ready");
});

Hooks.on("createChatMessage", async (message) => {
  console.log("Power Rebuild: New chat message");

  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;
  const critText =
    html.querySelector(".d6-data-div")?.textContent || "";

  const isCrit = critText.includes("Critical Damage");

  console.log("Power Rebuild: Crit check =", isCrit);

  if (!isCrit) return;

  console.log("Power Rebuild: CRIT DETECTED");


  const weaponName = html.querySelector(
    ".chat-rollTitle-stat .text-center"
  )?.textContent?.trim();

  console.log(
    "Power Rebuild: Weapon Name =",
    weaponName
  );

  if (!weaponName) {
    console.log(
      "Power Rebuild: No weapon name found in card."
    );
    return;
  }

  if (!weaponName.toLowerCase().includes("(power)")) {
    console.log(
      "Power Rebuild: Weapon is not a Power weapon."
    );
    return;
  }

  console.log(
    `Power Rebuild triggered by ${weaponName}`
  );

  const macro = game.macros.getName("Power Rebuild");

  console.log(
    "Power Rebuild: Macro =",
    macro
  );

  if (!macro) {
    ui.notifications.warn(
      "Power Rebuild macro not found."
    );
    return;
  }

  await macro.execute();

  ui.notifications.info(
    `${weaponName} triggered Power Rebuild`
  );
});v
