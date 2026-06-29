Hooks.once("ready", () => {
  console.info("🎯 Efficient Autosear Dialog Script Loaded (v7 - Custom CPR Card)");
});

Hooks.on("createChatMessage", async function (message) {
  if (game.userId !== message.author?.id || !message || !message.content) {
    return;
  }

  const DIV = document.createElement("DIV");
  DIV.innerHTML = message.content;

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
  const actor = token?.actor ?? game.actors.get(data.actorId);
  const firedWeapon = actor?.items?.get(data.itemId);

  if (!actor || !firedWeapon) {
    return;
  }

  // === 1. Check if the weapon fired is our Autosear dummy weapon ===
  if (!firedWeapon.name.toLowerCase().includes("efficient autosear")) {
    return; 
  }

  // === 2. Get the ammo cost from the dummy weapon's name ===
  const match = firedWeapon.name.match(/\d+/);
  let ammoCost = match ? parseInt(match[0]) : 1; 

  // === 3. Find the Main Weapon ===
  const allOtherWeapons = actor.items.filter(
    i => i.type === "weapon" && i.id !== firedWeapon.id && i.system.isRanged
  );
  
  let mainWeapon = null;
  for (const w of allOtherWeapons) {
    const upgradeIds = w.system.installedItems?.list || [];
    const hasTheUpgrade = upgradeIds.some(id => {
      const upg = actor.items.get(id);
      return upg && upg.name.toLowerCase().includes("efficient autosear");
    });

    if (hasTheUpgrade) {
      mainWeapon = w;
      break;
    }
  }

  if (!mainWeapon) {
    ui.notifications.warn("Could not find a main weapon with the Efficient Autosear upgrade installed!");
    return;
  }

  // === 4. Deduct the ammo from the Main Weapon ===
  if (mainWeapon.system.magazine && typeof mainWeapon.system.magazine.value === "number") {
    let currentAmmo = mainWeapon.system.magazine.value;

    if (currentAmmo < ammoCost) {
      // Not enough ammo - block the attack entirely
      await mainWeapon.update({ "system.magazine.value": 0 });
      ChatMessage.create({
        user: game.userId,
        speaker: ChatMessage.getSpeaker(),
        content: `<p><i><strong>*CLICK*</strong></i> Tried to autofire, but the <strong>${mainWeapon.name}</strong> didn't have enough ammo!</p>`,
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

  // === 5. The Fake Damage Card Dialog ===
  new Dialog({
    title: `Autosear Damage - ${mainWeapon.name}`,
    content: `
      <div style="margin-bottom: 10px;">
        <p>Did the attack hit? If so, by how much did you beat the DV?</p>
      </div>
      <div class="form-group" style="display: flex; align-items: center; margin-bottom: 15px;">
        <label style="flex: 1; font-weight: bold;">Multiplier (Amount beat DV by):</label>
        <input id="autosear-multiplier" type="number" value="1" min="1" max="5" style="width: 60px; text-align: center;"/>
      </div>
    `,
    buttons: {
      hit: {
        icon: '<i class="fas fa-crosshairs"></i>',
        label: "Hit! Roll Damage",
        callback: async (html) => {
          let mult = parseInt(html.find('#autosear-multiplier').val());
          if (isNaN(mult) || mult < 1) mult = 1;
          
          // Generate the roll logic (2d6 * multiplier)
          let roll = await new Roll(`2d6 * ${mult}`).evaluate();
          
          // Extract the 2d6 results
          let keptDice = roll.dice[0].results.map(r => r.result);
          
          // Generate simple HTML elements for the die faces
          let diceHTML = keptDice.map(d => `<span style="display:inline-block; border:1px solid #777; border-radius:3px; padding: 2px 6px; margin: 0 2px; background: rgba(0,0,0,0.1); font-weight:bold;">${d}</span>`).join("");
          
          // Calculate CPR Critical Injury (if both dice are 6s, add 5 bonus damage)
          let isCrit = keptDice.filter(d => d === 6).length >= 2;
          let bonusDamage = isCrit ? 5 : 0;

          // Build the Custom CPR Chat Card HTML
          let customHTML = `
            <div class="rollcard">
              <div class="rollcard-top">
                <div class="cpr-block chat-rollTitle-stat">
                  <div class="text-center text-padding-top text-normal text-semi">
                    Autosear Damage (${mainWeapon.name})
                  </div>
                  <div class="rollcard-subtitle">
                    <div class="rollcard-subtitle-center text-small">
                      Damage
                    </div>
                    <div class="rollcard-subtitle-right">
                      <a class="clickable"
                         data-action="applyDamage"
                         data-scope="global"
                         data-total-damage="${roll.total}"
                         data-bonus-damage="${bonusDamage}"
                         data-damage-location="body"
                         data-damage-lethal="true"
                         data-ablation="1"
                         data-ammo-variety=""
                         data-ignore-armor-percent="0"
                         data-ignore-below-sp="0">
                        <i class="fas fa-bolt" data-tooltip="Apply damage to selected Token(s)."></i>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <div class="rollcard-bottom">
                <div class="cpr-block">
                  <div class="d6-rollcard-data">
                    <div class="d6-dice-div">
                      ${diceHTML}
                    </div>
                    <div class="d6-number-div">
                      <span class="clickable" data-action="toggleVisibility" data-visible-element="d6-data-details">
                        ${roll.total}
                      </span>
                    </div>
                    <div class="d6-data-div">
                      <div class="d6-data-details hide">
                        Formula: ${roll.formula}
                        <br>
                        Dice: ${keptDice.join(", ")}
                        ${bonusDamage > 0 ? `<br><strong>Critical Bonus: +${bonusDamage}</strong>` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;

          // Send to chat with the roll attached so Dice So Nice still triggers 3D dice
          ChatMessage.create({
            user: game.userId,
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: customHTML,
            rolls: [roll],
            type: CONST.CHAT_MESSAGE_TYPES?.ROLL ?? 5
          });
        }
      },
      miss: {
        icon: '<i class="fas fa-times"></i>',
        label: "Missed",
        callback: () => {
           ui.notifications.info(`Autosear attack missed. ${ammoCost} rounds were still spent from the ${mainWeapon.name}.`);
        }
      }
    },
    default: "hit"
  }).render(true);

});
