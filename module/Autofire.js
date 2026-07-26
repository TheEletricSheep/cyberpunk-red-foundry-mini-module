console.log("=== customAutofireAmmo.js loaded ===");

Hooks.on("createChatMessage", async (message) => {
  // Only the person who made the roll should process the ammo deduction.
  // This prevents the GM and 4 players from subtracting the ammo 5 times at once.
  if (!message.isAuthor) return;
  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // 1. Make sure this is an actual attack roll card
  const isRollCard = html.querySelector(".d10-rollcard-data");
  if (!isRollCard) return;

  // 2. Make sure it's an Autofire attack (the system usually prints "Autofire" in the subtitle or text)
  const textContent = html.textContent.toLowerCase();
  if (!textContent.includes("autofire")) return;

  // 3. Get the weapon name from the chat card
  const weaponName = html.querySelector(".chat-rollTitle-stat .text-center")?.textContent?.trim();
  if (!weaponName) return;

  // 4. Find the actor who fired the weapon
  const speaker = message.speaker;
  let actor = game.actors.get(speaker.actor);
  
  // Fallback if actor isn't directly linked, check the token
  if (!actor && speaker.token) {
    actor = canvas.tokens.get(speaker.token)?.actor;
  }
  if (!actor) return;

  // 5. Find the specific weapon in the actor's inventory
  const weapon = actor.items.find(i => i.type === "weapon" && i.name === weaponName);
  if (!weapon) return;

  let autofireValue = null;

  // 6. Look for an installed upgrade item matching "Autofire X"
  if (weapon.system?.upgrades) {
    for (const upgradeId of weapon.system.upgrades) {
      const upgradeItem = actor.items.get(upgradeId);
      if (upgradeItem) {
        // Regex matches "Autofire 15", "autofire 20", etc.
        const match = upgradeItem.name.match(/autofire\s+(\d+)/i);
        if (match) {
          autofireValue = parseInt(match[1], 10);
          break; // Stop looking once we find the module
        }
      }
    }
  }

  // 7. Fallback: If no upgrade is found, check if the weapon's name has it (e.g., "Assault Rifle (Autofire 20)")
  if (!autofireValue) {
    const match = weapon.name.match(/autofire\s+(\d+)/i);
    if (match) {
      autofireValue = parseInt(match[1], 10);
    }
  }

  // 8. If we found a value greater than 10, deduct the extra ammo
  if (autofireValue && autofireValue > 10) {
    const extraAmmo = autofireValue - 10;
    const currentAmmo = weapon.system.magazine.value;
    
    // Ensure we don't accidentally dip into negative ammo numbers
    const newAmmo = Math.max(0, currentAmmo - extraAmmo);

    // Update the weapon's magazine value in Foundry
    await weapon.update({ "system.magazine.value": newAmmo });

    console.log(`[Autofire Ammo] Expended ${extraAmmo} extra ammo for ${weapon.name}.`);

    // Post a brief, clean message in chat so the player and GM know the ammo was spent
    await ChatMessage.create({
      speaker: message.speaker,
      content: `
        <div class="cpr-block chat-rollTitle-stat" style="border: 1px solid #730000; border-radius: 5px; background: rgba(0,0,0,0.4);">
          <div class="text-center text-small text-semi" style="padding: 5px;">
            <i class="fas fa-angle-double-right" style="color: #ff3333;"></i> 
            <strong>Autofire ${autofireValue} Module</strong> spent ${extraAmmo} extra rounds!<br>
            <span style="color: #aaa;">(${newAmmo} rounds remaining)</span>
          </div>
        </div>
      `
    });
  }
});console.log("=== customAutofireAmmo.js loaded ===");

Hooks.on("createChatMessage", async (message) => {
  // Only the person who made the roll should process the ammo deduction.
  // This prevents the GM and 4 players from subtracting the ammo 5 times at once.
  if (!message.isAuthor) return;
  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // 1. Make sure this is an actual attack roll card
  const isRollCard = html.querySelector(".d10-rollcard-data");
  if (!isRollCard) return;

  // 2. Make sure it's an Autofire attack (the system usually prints "Autofire" in the subtitle or text)
  const textContent = html.textContent.toLowerCase();
  if (!textContent.includes("autofire")) return;

  // 3. Get the weapon name from the chat card
  const weaponName = html.querySelector(".chat-rollTitle-stat .text-center")?.textContent?.trim();
  if (!weaponName) return;

  // 4. Find the actor who fired the weapon
  const speaker = message.speaker;
  let actor = game.actors.get(speaker.actor);
  
  // Fallback if actor isn't directly linked, check the token
  if (!actor && speaker.token) {
    actor = canvas.tokens.get(speaker.token)?.actor;
  }
  if (!actor) return;

  // 5. Find the specific weapon in the actor's inventory
  const weapon = actor.items.find(i => i.type === "weapon" && i.name === weaponName);
  if (!weapon) return;

  let autofireValue = null;

  // 6. Look for an installed upgrade item matching "Autofire X"
  if (weapon.system?.upgrades) {
    for (const upgradeId of weapon.system.upgrades) {
      const upgradeItem = actor.items.get(upgradeId);
      if (upgradeItem) {
        // Regex matches "Autofire 15", "autofire 20", etc.
        const match = upgradeItem.name.match(/autofire\s+(\d+)/i);
        if (match) {
          autofireValue = parseInt(match[1], 10);
          break; // Stop looking once we find the module
        }
      }
    }
  }

  // 7. Fallback: If no upgrade is found, check if the weapon's name has it (e.g., "Assault Rifle (Autofire 20)")
  if (!autofireValue) {
    const match = weapon.name.match(/autofire\s+(\d+)/i);
    if (match) {
      autofireValue = parseInt(match[1], 10);
    }
  }

  // 8. If we found a value greater than 10, deduct the extra ammo
  if (autofireValue && autofireValue > 10) {
    const extraAmmo = autofireValue - 10;
    const currentAmmo = weapon.system.magazine.value;
    
    // Ensure we don't accidentally dip into negative ammo numbers
    const newAmmo = Math.max(0, currentAmmo - extraAmmo);

    // Update the weapon's magazine value in Foundry
    await weapon.update({ "system.magazine.value": newAmmo });

    console.log(`[Autofire Ammo] Expended ${extraAmmo} extra ammo for ${weapon.name}.`);

    // Post a brief, clean message in chat so the player and GM know the ammo was spent
    await ChatMessage.create({
      speaker: message.speaker,
      content: `
        <div class="cpr-block chat-rollTitle-stat" style="border: 1px solid #730000; border-radius: 5px; background: rgba(0,0,0,0.4);">
          <div class="text-center text-small text-semi" style="padding: 5px;">
            <i class="fas fa-angle-double-right" style="color: #ff3333;"></i> 
            <strong>Autofire ${autofireValue} Module</strong> spent ${extraAmmo} extra rounds!<br>
            <span style="color: #aaa;">(${newAmmo} rounds remaining)</span>
          </div>
        </div>
      `
    });
  }
});
