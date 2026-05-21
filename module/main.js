Hooks.on("createChatMessage", async (message) => {
  console.log("Power Rebuild: New chat message");

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // Detect critical damage
  const critText = html.querySelector(".d6-data-div")?.textContent || "";
  const isCrit = critText.includes("Critical Damage");

  console.log("Power Rebuild: Crit check =", isCrit);
  console.log("Power Rebuild: Crit text =", critText);

  if (!isCrit) return;

  // Actor
  const actorId = message.speaker?.actor;

  console.log("Power Rebuild: Actor ID =", actorId);

  if (!actorId) return;

  const actor = game.actors.get(actorId);

  console.log("Power Rebuild: Actor =", actor);

  if (!actor) return;

  // Show all item IDs in the message
  const itemElement = html.querySelector("[data-item-id]");
  console.log("Power Rebuild: Item element =", itemElement);

  const itemId =
    message.flags?.cyberpunkred?.itemId ||
    itemElement?.dataset?.itemId;

  console.log("Power Rebuild: Item ID =", itemId);

  // If CPR isn't storing item IDs, dump the whole message
  console.log("Power Rebuild: Message =", message);

  if (!itemId) {
    ui.notifications.warn(
      "Power Rebuild: Crit detected but no weapon ID found."
    );
    return;
  }

  const item = actor.items.get(itemId);

  console.log("Power Rebuild: Weapon =", item);

  if (!item) return;

  const upgradeIds = item.system.installedItems?.list ?? [];

  console.log("Power Rebuild: Upgrade IDs =", upgradeIds);

  const upgrades = upgradeIds
    .map(id => actor.items.get(id))
    .filter(upg => upg);

  console.log("Power Rebuild: Upgrades =", upgrades);

  const powerRebuild = upgrades.find(upg =>
    upg.name?.toLowerCase().includes("power rebuild")
  );

  console.log("Power Rebuild: Found =", powerRebuild);

  if (!powerRebuild) return;

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
