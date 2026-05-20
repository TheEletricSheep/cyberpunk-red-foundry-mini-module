Hooks.on("createChatMessage", async (message) => {
  const html = document.createElement("div");
  html.innerHTML = message.content;

  // 1. detect critical damage
  const isCrit = html.querySelector(".d6-data-div")
    ?.textContent.includes("Critical Damage");

  if (!isCrit) return;

  // 2. get actor
  const actorId = message.speaker?.actor;
  if (!actorId) return;

  const actor = game.actors.get(actorId);
  if (!actor) return;

  // 3. get itemId (try multiple sources)
  const itemId =
    message.flags?.cyberpunkred?.itemId ||
    html.querySelector("[data-item-id]")?.dataset.itemId;

  if (!itemId) return;

  const item = actor.items.get(itemId);
  if (!item) return;

  // 4. get upgrades safely
  const upgradeIds = item.system.installedItems?.list ?? [];

  const upgrades = upgradeIds
    .map(id => actor.items.get(id))
    .filter(upg => upg && upg.type === "itemUpgrade");

  // 5. Power Rebuild check
  const powerRebuild = upgrades.find(upg =>
    upg.name?.toLowerCase().includes("power rebuild")
  );

  if (powerRebuild) {
    console.log("Power Rebuild triggered");

    const macro = game.macros.getName("Power Rebuild");
    if (macro) await macro.execute();

    ui.notifications.info(
      `${actor.name}: Power Rebuild activated on critical damage!`
    );
  }
});
