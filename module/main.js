let lastWeaponByActor = {};

Hooks.on("createChatMessage", async (message) => {
  console.log("Power Rebuild: New chat message");

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // ==================================================
  // STEP 1: Remember weapon from attack cards
  // ==================================================

  const attackData = html.querySelector("[data-action='rollDamage']")?.dataset;

  if (attackData?.actorId && attackData?.itemId) {
    lastWeaponByActor[attackData.actorId] = attackData.itemId;

    console.log(
      "Power Rebuild: Stored weapon",
      attackData.itemId,
      "for actor",
      attackData.actorId
    );
  }

  // ==================================================
  // STEP 2: Detect critical damage cards
  // ==================================================

  const critText =
    html.querySelector(".d6-data-div")?.textContent || "";

  const isCrit = critText.includes("Critical Damage");

  console.log("Power Rebuild: Crit check =", isCrit);

  if (!isCrit) return;

  // ==================================================
  // STEP 3: Get actor
  // ==================================================

  const actorId = message.speaker?.actor;

  console.log("Power Rebuild: Actor ID =", actorId);

  if (!actorId) return;

  const actor = game.actors.get(actorId);

  console.log("Power Rebuild: Actor =", actor);

  if (!actor) return;

  // ==================================================
  // STEP 4: Recover weapon from previous attack card
  // ==================================================

  const itemId = lastWeaponByActor[actorId];

  console.log("Power Rebuild: Recovered weapon ID =", itemId);

  if (!itemId) {
    ui.notifications.warn(
      "Power Rebuild: Crit detected but no previous weapon was recorded."
    );
    return;
  }

  const item = actor.items.get(itemId);

  console.log("Power Rebuild: Weapon =", item);

  if (!item) return;

  // ==================================================
  // STEP 5: Check upgrades
  // ==================================================

  const upgradeIds = item.system.installedItems?.list ?? [];

  console.log("Power Rebuild: Upgrade IDs =", upgradeIds);

  const upgrades = upgradeIds
    .map(id => actor.items.get(id))
    .filter(Boolean);

  console.log("Power Rebuild: Upgrades =", upgrades);

  const powerRebuild = upgrades.find(upg =>
    upg.name?.toLowerCase().includes("power rebuild")
  );

  console.log("Power Rebuild: Found =", powerRebuild);

  if (!powerRebuild) return;

  // ==================================================
  // STEP 6: Execute macro
  // ==================================================

  console.log("Power Rebuild triggered!");

  const macro = game.macros.getName("Power Rebuild");

  console.log("Power Rebuild: Macro =", macro);

  if (macro) {
    await macro.execute();
  } else {
    ui.notifications.warn(
      "Power Rebuild macro not found."
    );
  }
});
