console.log("=== customAutofireAmmo.js loaded (v2) ===");

Hooks.on("createChatMessage", async (message) => {
  // 1. Only run for the person who made the roll
  if (!message.isAuthor) return;
  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // 2. Make sure this is an actual attack roll card
  const isRollCard = html.querySelector(".d10-rollcard-data");
  if (!isRollCard) return;

  // 3. Make sure it's an Autofire attack (looks at the text on the card)
  const textContent = html.textContent.toLowerCase();
  if (!textContent.includes("autofire")) return;

  // 4. Get the weapon name from the chat card
  const weaponName = html.querySelector(".chat-rollTitle-stat .text-center")?.textContent?.trim();
  if (!weaponName) return;

  // 5. Find the actor who fired the weapon
  const speaker = message.speaker;
  let actor = game.actors.get(speaker.actor);
  if (!actor && speaker.token) {
    actor = canvas.tokens.get(speaker.token)?.actor;
  }
  if (!actor) return;

  // 6. Find the specific weapon in the actor's inventory
  const weapon = actor.items.find(i => i.type === "weapon" && i.name.trim() === weaponName);
  if (!weapon) {
    console.log(`[Autofire Ammo] Could not find weapon matching '${weaponName}' on actor.`);
    return;
  }

  console.log(`[Autofire Ammo] Detected Autofire roll with ${weapon.name}`);

  let autofireValue = null;

  // 7. Check if the weapon's name has it directly (e.g., "Assault Rifle (Autofire 20)")
  let match = weapon.name.match(/autofire\s+(\d+)/i);
  if (match) {
    autofireValue = parseInt(match[1], 10);
  }

  // 8. If not in the name, check installed upgrades
  if (!autofireValue) {
    // Look through all items the actor has that are upgrades/gear
    const upgrades = actor.items.filter(i => i.type === "upgrade" || i.type === "gear");
    
    for (const upg of upgrades) {
      const upgMatch = upg.name.match(/autofire\s+(\d+)/i);
      if (upgMatch) {
        // Check if this upgrade is actually installed on the weapon we just fired
        let isInstalled = false;
        if (weapon.system?.upgrades?.includes(upg.id)) isInstalled = true;
        if (weapon.system?.installedItems?.list?.includes(upg.id)) isInstalled = true;
        
        if (isInstalled) {
          autofireValue = parseInt(upgMatch[1], 10);
          console.log(`[Autofire Ammo] Found installed module: ${upg.name}`);
          break;
        }
      }
    }
  }

  // If we found nothing, or the value is 10 or less, do nothing.
  if (!autofireValue || autofireValue <= 10) {
    console.log(`[Autofire Ammo] No extra ammo required. (Module value: ${autofireValue})`);
    return;
  }

  // 9. Calculate extra ammo needed
  const extraAmmo = autofireValue - 10;
  console.log(`[Autofire Ammo] Preparing to deduct ${extraAmmo} extra rounds. Waiting 500ms...`);

  // 10. Wait 500ms so the Core System finishes subtracting the base 10 ammo first
  setTimeout(async () => {
    // Fetch the freshest version of the weapon from the database
    const updatedWeapon = actor.items.get(weapon.id);
    const currentAmmo = updatedWeapon.system.magazine.value;
    
    // Deduct the extra amount
    const newAmmo = Math.max(0, currentAmmo - extraAmmo);

    await updatedWeapon.update({ "system.magazine.value": newAmmo });
    console.log(`[Autofire Ammo] Deducted ${extraAmmo} extra ammo. Old: ${currentAmmo}, New: ${newAmmo}`);

    // Post chat notification
    await ChatMessage.create({
      speaker: message.speaker,
      content: `
        <div class="cpr-block chat-rollTitle-stat" style="border: 1px solid #730000; border-radius: 5px; background: rgba(0,0,0,0.4); margin-top: 4px;">
          <div class="text-center text-small text-semi" style="padding: 5px;">
            <i class="fas fa-angle-double-right" style="color: #ff3333;"></i> 
            <strong>Autofire ${autofireValue} Module</strong> spent ${extraAmmo} extra rounds!<br>
            <span style="color: #aaa;">(${newAmmo} rounds remaining)</span>
          </div>
        </div>
      `
    });
  }, 500); // 500ms delay prevents database collision
});
