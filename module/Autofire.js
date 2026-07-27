Hooks.once("ready", () => {
  console.info("🎯 Autofire Ammo Module Script Loaded (v3)");
});

Hooks.on("createChatMessage", async function (message) {
  // 1. Only the person who made the roll processes the ammo deduction
  if (game.userId !== message.author?.id || !message || !message.content) {
    return;
  }

  const DIV = document.createElement("DIV");
  DIV.innerHTML = message.content;

  // 2. Identify if this is an attack roll using the CPR system's rollDamage button
  const isAttack = DIV.querySelector(
    `[data-tooltip='${game.i18n.localize("CPR.actorSheets.commonActions.rollDamage")}']`
  );
  const data = DIV.querySelector("[data-action=rollDamage]")?.dataset;

  if (!isAttack || !data) {
    return;
  }

  // 3. Ensure this is specifically an AUTOFIRE attack
  const isAutofire = message.content.toLowerCase().includes("autofire");
  if (!isAutofire) {
    return;
  }

  // 4. Resolve the Token, Actor, and Item
  let token =
    canvas.scene?.tokens?.get(message.speaker?.token) ||
    canvas.scene?.tokens?.get(data.tokenId) ||
    canvas.scene?.tokens?.getName(message.speaker?.alias);
  
  const actor = token?.actor ?? game.actors.get(data.actorId);
  const item = actor?.items?.get(data.itemId);

  if (!actor || !item) {
    console.log(`AutofireHook: Actor or Item missing.`);
    return;
  }

  // 5. Look for installed upgrades
  const upgradeIds = item.system.installedItems?.list || [];
  const upgrades = upgradeIds
    .map(id => actor.items.get(id))
    .filter(upg => upg && upg.type === "itemUpgrade");

  // === Autofire Upgrade Validation ===
  const autofireUpgrades = upgrades.filter(
    upg => upg.name && upg.name.toLowerCase().includes("autofire")
  );

  if (autofireUpgrades.length === 0) {
    return; // No custom Autofire module installed, let the system handle normal 10 rounds
  }

  const autofireUpgrade = autofireUpgrades[0];
  const autofireName = autofireUpgrade?.name;

  // 6. Extract the number from the upgrade name (e.g., "Autofire 15" -> 15)
  const match = autofireName.match(/\d+/);
  let autofireInteger = match ? parseInt(match[0]) : null;

  if (!Number.isInteger(autofireInteger)) {
    console.log("AutofireHook: Autofire mod has no integer in its name.");
    return;
  }

  // Calculate the extra ammo to deduct (Total module value - 10 base already spent by system)
  let extraAmmo = autofireInteger - 10;

  if (extraAmmo < 1) {
    console.log("AutofireHook: Module value is 10 or less, no extra ammo to deduct.");
    return;
  }

  // 7. Defensive checks for magazine
  if (!item.system.magazine || typeof item.system.magazine.value !== "number") {
    console.log("AutofireHook: Magazine or value missing from item.system.");
    return;
  }

  let ammoCount = item.system.magazine.value;
  ammoCount = ammoCount - extraAmmo;

  // 8. Update the weapon's magazine
  if (ammoCount < 0) {
    await item.update({ "system.magazine.value": 0 });
    
    ChatMessage.create({
      user: game.userId,
      speaker: ChatMessage.getSpeaker(),
      content: `<p><i><strong>*CLICK*</strong></i> Your <strong>${autofireName}</strong> module drained the rest of the mag mid-spray!</p>`,
    });
  } else {
    await item.update({ "system.magazine.value": ammoCount });
    
    // Post a brief, clean message in chat so the player and GM know the extra ammo was spent
    ChatMessage.create({
      user: game.userId,
      speaker: ChatMessage.getSpeaker(),
      content: `
        <div class="cpr-block chat-rollTitle-stat" style="border: 1px solid #730000; border-radius: 5px; background: rgba(0,0,0,0.4); margin-top: 4px;">
          <div class="text-center text-small text-semi" style="padding: 5px;">
            <i class="fas fa-angle-double-right" style="color: #ff3333;"></i> 
            <strong>${autofireName}</strong> spent ${extraAmmo} extra rounds!<br>
            <span style="color: #aaa;">(${ammoCount} rounds remaining)</span>
          </div>
        </div>
      `
    });
  }
});
