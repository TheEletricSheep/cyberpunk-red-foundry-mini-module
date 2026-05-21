Hooks.once("ready", () => {
  game.powerRebuild ??= {};
  game.powerRebuild.lastWeaponByActor ??= {};

  console.log("Power Rebuild: Ready");
});

Hooks.on("createChatMessage", async (message) => {
  console.log("Power Rebuild: New chat message");
  console.log("Power Rebuild: Speaker =", message.speaker);

  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // ==================================================
  // STORE WEAPON FROM ATTACK CARD
  // ==================================================

  const attackData = html.querySelector("[data-action='rollDamage']")?.dataset;

  if (attackData?.actorId && attackData?.itemId) {
    game.powerRebuild.lastWeaponByActor[attackData.actorId] =
      attackData.itemId;

    console.log(
      "Power Rebuild: Stored weapon",
      attackData.itemId,
      "for actor",
      attackData.actorId
    );

    console.log(
      "Power Rebuild: Storage contents",
      JSON.stringify(game.powerRebuild.lastWeaponByActor)
    );
  }

  // ==================================================
  // CRITICAL DAMAGE DETECTION
  // ==================================================

  const critText =
    html.querySelector(".d6-data-div")?.textContent || "";

  const isCrit = critText.includes("Critical Damage");

  console.log("Power Rebuild: Crit check =", isCrit);

  if (!isCrit) return;

  console.log("Power Rebuild: Crit text =", critText);

  const actorId = message.speaker?.actor;

  console.log("Power Rebuild: Actor ID =", actorId);

  if (!actorId) {
    console.warn("Power Rebuild: No actor on damage card.");
    return;
  }

  const actor = game.actors.get(actorId);

  console.log("Power Rebuild: Actor =", actor);

  if (!actor) return;

  console.log(
    "Power Rebuild: Storage contents at crit",
    JSON.stringify(game.powerRebuild.lastWeaponByActor)
  );

  const itemId =
    game.powerRebuild.lastWeaponByActor?.[actorId];

  console.log(
    "Power Rebuild: Recovered weapon ID =",
    itemId
  );

  if (!itemId) {
    ui.notifications.warn(
      "Power Rebuild: Crit detected but no previous weapon was recorded."
    );
    return;
  }

  const item = actor.items.get(itemId);

  console.log("Power Rebuild: Weapon =", item);

  if (!item) {
    console.warn("Power Rebuild: Weapon not found on actor.");
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
