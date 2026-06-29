Hooks.once("ready", () => {
  console.info("🎯 Efficient Autosear Module Script Loaded (v3)");
});

Hooks.on("createChatMessage", async function (message) {
  // console.log("AutosearHook: ChatMessage hook triggered.");

  if (game.userId !== message.author?.id || !message || !message.content) {
    return;
  }

  const DIV = document.createElement("DIV");
  DIV.innerHTML = message.content;

  const isAttack = DIV.querySelector(
    `[data-tooltip='${game.i18n.localize("CPR.actorSheets.commonActions.rollDamage")}']`
  );
  const data = DIV.querySelector("[data-action=rollDamage]")?.dataset;

  if (!isAttack || !data) {
    return;
  }

  const isAutoOrSuppressive = (
    message.content.toLowerCase().includes("autofire") ||
    message.content.toLowerCase().includes("suppressive")
  );
  
  if (!isAutoOrSuppressive) {
    return;
  }

  let token =
    canvas.scene?.tokens?.get(message.speaker?.token) ||
    canvas.scene?.tokens?.get(data.tokenId) ||
    canvas.scene?.tokens?.getName(message.speaker?.alias);
  const actor = token?.actor ?? game.actors.get(data.actorId);
  const item = actor?.items?.get(data.itemId);

  if (!actor || !item) {
    return;
  }

  if (
    !item.system.isRanged ||
    ["bow", "grenadeLauncher", "rocketLauncher"].includes(item.system.weaponType) ||
    item.system.variety === "grenade"
  ) {
    return;
  }

  const upgradeIds = item.system.installedItems?.list || [];
  const upgrades = upgradeIds
    .map(id => actor.items.get(id))
    .filter(upg => upg && upg.type === "itemUpgrade");

  const autosearUpgrades = upgrades.filter(
    upg => upg.name && upg.name.toLowerCase().includes("efficient autosear")
  );
  
  if (autosearUpgrades.length > 1) {
    ui.notifications.warn("Multiple Efficient Autosears installed—Pick one choom!");
    return;
  }

  const autosearUpgrade = autosearUpgrades[0];
  const autosearName = autosearUpgrade?.name;

  if (!upgrades.length || !autosearUpgrade || !autosearName) {
    return;
  }

  const match = autosearName.match(/\d+/);
  let refundInteger = match ? parseInt(match[0]) : 1; 

  if (!item.system.magazine || typeof item.system.magazine.value !== "number") {
    return;
  }

  let ammoCount = item.system.magazine.value;
  let maxAmmo = item.system.magazine.max || 999; 
  
  // === CHANGED: Allow refund at EXACTLY 0, block and reset if below 0 ===
  // If ammo goes negative, they didn't have enough rounds for a full autofire.
  if (ammoCount < 0) {
    // Clamp the ammo to 0 so it doesn't stay negative
    await item.update({ "system.magazine.value": 0 });
    
    // Send a chat message letting them know they fired dry (no refund)
    ChatMessage.create({
      user: game.userId,
      speaker: ChatMessage.getSpeaker(),
      content: '<p><i><strong>*CLICK*</strong></i> Not enough ammo for a full Autofire! No Autosear refund.</p>',
    });
    
    return; // Exit script, preventing the refund below
  }
  
  // If ammo is 0 or higher, apply the refund!
  ammoCount = ammoCount + refundInteger;
  
  // Make sure we don't refund past the maximum magazine capacity
  if (ammoCount > maxAmmo) {
      ammoCount = maxAmmo;
  }

  // Update the gun with the refunded ammo
  await item.update({ "system.magazine.value": ammoCount });
});
