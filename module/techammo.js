Hooks.once("ready", () => {
  console.info("🎯 Tech Rebuild Ammo Deduction Script Loaded (v3 - Autofire Support)");
});

Hooks.on("createChatMessage", async function (message) {
  // Handle Foundry v11 vs v12 user ID and content differences
  if (game.userId !== (message.author?.id ?? message.user?.id) || !message || !message.content) {
    return;
  }

  const messageText = message.content || message.flavor || "";
  const DIV = document.createElement("DIV");
  DIV.innerHTML = messageText;

  // Check if this chat message is an Attack card
  const isAttack = DIV.querySelector(
    `[data-tooltip='${game.i18n.localize("CPR.actorSheets.commonActions.rollDamage")}']`
  );
  const data = DIV.querySelector("[data-action=rollDamage]")?.dataset;

  if (!isAttack || !data) {
    return;
  }

  let token =
    canvas.scene?.tokens?.get(message.speaker?.token) ||
    canvas.scene?.tokens?.get(data.tokenId) ||
    canvas.scene?.tokens?.getName(message.speaker?.alias);
  
  const actor = token?.actor ?? game.actors.get(data.actorId) ?? game.actors.getName(message.speaker?.alias);
  const firedWeapon = actor?.items?.get(data.itemId);

  if (!actor || !firedWeapon) {
    return;
  }

  // === 1. Check if the weapon fired is our Tech Rebuild dummy weapon ===
  if (!firedWeapon.name.toLowerCase().includes("tech rebuild")) {
    return; 
  }

  // === DYNAMIC AMMO CHECK: 10 for Autofire, 1 for Standard ===
  const isAutofire = messageText.toLowerCase().includes("autofire");
  const ammoCost = isAutofire ? 10 : 1;

  // === 2. Find the Main Weapon ===
  // IMPORTANT: We explicitly ignore the fired dummy weapon here (i.id !== firedWeapon.id)
  const allOtherWeapons = actor.items.filter(
    i => i.type === "weapon" && i.id !== firedWeapon.id && i.system.isRanged
  );
  
  let mainWeapon = null;
  for (const w of allOtherWeapons) {
    const upgradeIds = w.system.installedItems?.list || [];
    const hasTheUpgrade = upgradeIds.some(id => {
      const upg = actor.items.get(id);
      return upg && upg.name.toLowerCase().includes("tech rebuild");
    });

    if (hasTheUpgrade) {
      mainWeapon = w;
      break;
    }
  }

  if (!mainWeapon) {
    ui.notifications.warn("Could not find a main weapon with the Tech Rebuild upgrade installed!");
    return;
  }

  // === 3. Deduct the ammo from the Main Weapon ===
  if (mainWeapon.system.magazine && typeof mainWeapon.system.magazine.value === "number") {
    let currentAmmo = mainWeapon.system.magazine.value;

    if (currentAmmo < ammoCost) {
      // Not enough ammo - block the attack entirely
      await mainWeapon.update({ "system.magazine.value": 0 });
      ChatMessage.create({
        user: game.userId,
        speaker: ChatMessage.getSpeaker(),
        content: `<p><i><strong>*CLICK*</strong></i> Tried to fire, but the <strong>${mainWeapon.name}</strong> doesn't have enough ammo!</p>`,
      });
      return; 
    } else {
      // Deduct ammo and keep the dummy weapon full
      const newAmmo = currentAmmo - ammoCost;
      await mainWeapon.update({ "system.magazine.value": newAmmo });
      
      if (firedWeapon.system.magazine && firedWeapon.system.magazine.max) {
        await firedWeapon.update({ "system.magazine.value": firedWeapon.system.magazine.max });
      }
    }
  }
});
