Hooks.once("ready", () => {
  console.log("Power Rebuild: Ready");
});

Hooks.on("createChatMessage", async (message) => {
  console.log("Power Rebuild: New chat message");

  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // ==================================================
  // CRITICAL DAMAGE DETECTION
  // ==================================================

  const critText =
    html.querySelector(".d6-data-div")?.textContent || "";

  const isCrit = critText.includes("Critical Damage");

  console.log("Power Rebuild: Crit check =", isCrit);

  if (!isCrit) return;

  const actorId = message.speaker?.actor;

  console.log("Power Rebuild: Actor ID =", actorId);

  if (!actorId) return;

  const actor = game.actors.get(actorId);

  console.log("Power Rebuild: Actor =", actor);

  if (!actor) return;

  // ==================================================
  // FIND WEAPON WITH "(POWER)" IN NAME
  // ==================================================

  const item = actor.items.find(i =>
    i.type === "weapon" &&
    i.name?.toLowerCase().includes("(power)")
  );

  console.log("Power Rebuild: Power Weapon =", item);

  if (!item) {
    console.log(
      "Power Rebuild: No weapon with '(Power)' found."
    );
    return;
  }

  const upgradeIds = item.system.installedItems?.list ?? [];

  console.log(
    "Power Rebuild: Upgrade IDs =",
    upgradeIds
  );

  const upgrades = upgradeIds
    .map(id => actor.items.get(id))
    .filter(Boolean);

  console.log(
    "Power Rebuild: Upgrades =",
    upgrades
  );

  const powerRebuild = upgrades.find(upg =>
    upg.name?.toLowerCase().includes("power rebuild")
  );

  console.log(
    "Power Rebuild: Found upgrade =",
    powerRebuild
  );

  if (!powerRebuild) return;

  console.log("Power Rebuild triggered!");

  const macro = game.macros.getName("Power Rebuild");

  console.log("Power Rebuild: Macro =", macro);

  if (!macro) {
    ui.notifications.warn(
      "Power Rebuild macro not found."
    );
    return;
  }

  await macro.execute();
});
