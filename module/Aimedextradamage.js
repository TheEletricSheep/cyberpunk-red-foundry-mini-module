Hooks.once("ready", () => {
  console.info("🎯 Aimed Shot Targeting Script Loaded (Native Crit UI Update)");
});

Hooks.on("createChatMessage", async function (message) {
  // Exit if the message isn't from the current user or is empty
  if (game.userId !== message.author?.id || !message || !message.content) {
    return;
  }

  const DIV = document.createElement("DIV");
  DIV.innerHTML = message.content;

  // Verify this chat message is actually an attack roll
  const isAttack = DIV.querySelector(
    `[data-tooltip='${game.i18n.localize("CPR.actorSheets.commonActions.rollDamage")}']`
  );
  const data = DIV.querySelector("[data-action=rollDamage]")?.dataset;

  if (!isAttack || !data) {
    return;
  }

  // Get the token, actor, and item used for the attack
  let token =
    canvas.scene?.tokens?.get(message.speaker?.token) ||
    canvas.scene?.tokens?.get(data.tokenId) ||
    canvas.scene?.tokens?.getName(message.speaker?.alias);
  
  const actor = token?.actor ?? game.actors.get(data.actorId);
  const item = actor?.items?.get(data.itemId);

  if (!actor || !item) {
    console.log("AimedShotHook: Actor or Item missing.");
    return;
  }

  // Extract all installed upgrades on the weapon
  const upgradeIds = item.system.installedItems?.list || [];
  const upgrades = upgradeIds
    .map(id => actor.items.get(id))
    .filter(upg => upg && upg.type === "itemUpgrade");

  // === Aimed Shot Upgrade Validation ===
  const contentLower = message.content.toLowerCase();
  const isAimedShot = contentLower.includes("aimed");
  
  if (isAimedShot) {
    // Filter and COUNT how many Headhopper or Headtoll upgrades are installed
    const headUpgrades = upgrades.filter(upg => {
      if (!upg.name) return false;
      const lowerName = upg.name.toLowerCase();
      return lowerName.includes("headhopper") || lowerName.includes("headtoll");
    });

    const headUpgradeCount = headUpgrades.length;

    if (headUpgradeCount > 0) {
      
      // === Identify Aimed Shot Location ===
      let systemLocation = "unknown";
      
      if (contentLower.includes("head")) {
        systemLocation = "head";
      } else if (contentLower.includes("leg")) {
        systemLocation = "leg";
      } else if (contentLower.includes("held") || contentLower.includes("item")) {
        systemLocation = "heldItem";
      }

      // Save to System for future reference
      if (systemLocation !== "unknown") {
        await message.setFlag("world", "aimedLocation", systemLocation);
      }

      let displayLocation = "Unknown Target";
      if (systemLocation === "head") displayLocation = "Head";
      if (systemLocation === "leg") displayLocation = "Leg";
      if (systemLocation === "heldItem") displayLocation = "Held Item";

      // === Identify Rebuilds ===
      const rebuildUpgrades = upgrades.filter(upg => {
        if (!upg.name) return false;
        return upg.name.toLowerCase().includes("rebuild");
      });

      const hasPowerRebuild = rebuildUpgrades.some(upg => upg.name.toLowerCase().includes("power"));
      const hasTechRebuild = rebuildUpgrades.some(upg => upg.name.toLowerCase().includes("tech"));

      let rebuildHtml = "";
      if (rebuildUpgrades.length > 0) {
        const rebuildNames = rebuildUpgrades.map(u => u.name).join(", ");
        rebuildHtml = `<p style='font-size: 14px; margin-bottom: 2px; color: #ffaa00;'><b>Rebuild(s):</b> ${rebuildNames}</p>`;
      }

      // Optional Tech Rebuild Checkbox
      let techCheckboxHtml = "";
      if (hasTechRebuild) {
        techCheckboxHtml = `
          <div style="margin-top: 10px; background: rgba(0, 255, 204, 0.1); padding: 5px; border-radius: 4px;">
            <label style="cursor: pointer;">
              <input type="checkbox" id="techRebuildArmor" />
              <b>Tech Rebuild:</b> Ignore 1/2 Armor
            </label>
          </div>
        `;
      }

      // === Extract Base Damage ===
      let weaponDamage = "Unknown";
      if (item.system.damage) {
        if (typeof item.system.damage === "string" || typeof item.system.damage === "number") {
            weaponDamage = item.system.damage.toString().trim();
        } else if (item.system.damage.dice) {
            weaponDamage = item.system.damage.dice.toString().trim();
        } else if (item.system.damage.formula) {
            weaponDamage = item.system.damage.formula.toString().trim();
        } else if (item.system.damage.amount && item.system.damage.diceType) {
            weaponDamage = `${item.system.damage.amount}${item.system.damage.diceType}`;
        }
      }

      // === Calculate Final Roll Formula ===
      let rollFormula = `${weaponDamage} + ${headUpgradeCount}d6`;
      const diceMatch = weaponDamage.match(/^(\d+)d(\d+)$/i);
      
      if (diceMatch && diceMatch[2] === "6") {
         let baseDiceCount = parseInt(diceMatch[1]);
         let newDiceCount = baseDiceCount + headUpgradeCount;
         rollFormula = `${newDiceCount}d6`;
      }

      // === Create the Foundry Dialog Menu for Hit Confirmation ===
      new Dialog({
        title: "Targeting Systems: Hit Confirmation",
        content: `
          <div style='text-align: center; margin: 10px 0;'>
            <p style='font-size: 16px; margin-bottom: 5px; color: #00ffcc;'><b>🎯 Aimed Shot Executed</b></p>
            <p style='font-size: 14px; margin-bottom: 2px;'><b>Target:</b> ${displayLocation}</p>
            ${rebuildHtml}
            ${techCheckboxHtml}
            <p style='font-size: 14px; margin-top: 10px;'>Did the shot hit?</p>
          </div>
        `,
        buttons: {
          hit: {
            label: "Hit (Roll Damage)",
            icon: "<i class='fas fa-crosshairs'></i>",
            callback: async (html) => {
              // Read the Tech Rebuild checkbox if it exists
              let ignoreArmorPercent = 0;
              if (hasTechRebuild) {
                const isChecked = html.find('#techRebuildArmor').is(':checked');
                if (isChecked) ignoreArmorPercent = 50;
              }

              // 1. Execute the actual dice roll
              let damageRoll = await new Roll(rollFormula).evaluate({ async: true });
              let totalDamage = damageRoll.total;
              
              // 2. Count dice to determine the visual size class
              let diceCount = damageRoll.terms[0].results.length;
              let diceSizeClass = "d6-60";
              if (diceCount >= 11) diceSizeClass = "d6-20";
              else if (diceCount >= 6) diceSizeClass = "d6-30";
              
              // 3. Check for Critical Injuries (two or more 6s rolled)
              let sixesRolled = damageRoll.terms[0].results.filter(d => d.result === 6).length;
              let isCrit = sixesRolled >= 2;
              let bonusDamage = 0;
              let critDisplayHtml = "";

              if (isCrit) {
                // If Power Rebuild is installed, critical damage is 10 instead of 5
                bonusDamage = hasPowerRebuild ? 10 : 5;
                critDisplayHtml = `
                  <div class="text-normal text-semi">
                    Critical Damage:
                    <br />
                    ${bonusDamage}
                  </div>
                `;
              }

              // 4. Build the visual dice SVG blocks
              let diceFacesHtml = damageRoll.terms[0].results.map(d => {
                if (isCrit && d.result === 6) {
                  return `<img class="d6 ${diceSizeClass}" src="systems/cyberpunk-red-core/icons/dice/red/d6_6_preem.svg" />`;
                } else {
                  return `<img class="d6 ${diceSizeClass}" src="systems/cyberpunk-red-core/icons/dice/black/d6_${d.result}.svg" />`;
                }
              }).join('\n');

              // 5. Try to get ammo variety, default to basic
              let ammoType = item.system?.magazine?.ammoVariety || "basic";

              // 6. Check for targeted tokens to inject into the damage card
              let targetsHtml = "";
              if (game.user.targets.size > 0) {
                targetsHtml = `
                <br />
                <div class="rollcard-top">
                  <div class="cpr-block chat-rollTitle-stat">
                    <div class="text-center text-padding-top text-normal">
                      Apply damage to the following token(s).
                    </div>
                    <div class="rollcard-subtitle"></div>
                  </div>
                </div>
                <div class="rollcard-bottom">
                  <div class="cpr-block">
                    <br />`;
                
                let targetCount = 1;
                game.user.targets.forEach(t => {
                  targetsHtml += `
                    <div class="text-left text-small">
                      ${targetCount}. ${t.name}
                      <a class="clickable" data-action="applyDamage" data-scope="local" data-actor-id="${t.actor.id}" data-token-id="${t.id}" data-total-damage="${totalDamage}" data-bonus-damage="${bonusDamage}" data-damage-location="${systemLocation}" data-damage-lethal="true" data-ablation="1" data-ammo-variety="${ammoType}" data-ignore-armor-percent="${ignoreArmorPercent}" data-ignore-below-sp="0">
                        <i class="fas fa-bolt" data-tooltip="Apply damage to this token."></i>
                      </a>
                    </div>`;
                  targetCount++;
                });
                targetsHtml += `</div></div>`;
              }

              // 7. Construct the CPR fake damage card HTML
              let fakeCardHtml = `
              <div class="rollcard">
                <div class="rollcard-top">
                  <div class="cpr-block chat-rollTitle-stat">
                    <div class="text-center text-padding-top text-normal text-semi">
                      ${item.name}
                    </div>
                    <div class="rollcard-subtitle">
                      <div class="rollcard-subtitle-center text-small">
                        Damage
                      </div>
                      <div class="rollcard-subtitle-right">
                        <a class="clickable" data-action="applyDamage" data-scope="global" data-total-damage="${totalDamage}" data-bonus-damage="${bonusDamage}" data-damage-location="${systemLocation}" data-damage-lethal="true" data-ablation="1" data-ammo-variety="${ammoType}" data-ignore-armor-percent="${ignoreArmorPercent}" data-ignore-below-sp="0">
                          <i class="fas fa-bolt" data-tooltip="Apply damage to selected Token(s)."></i>
                        </a>
                      </div>
                      <div class="rollcard-subtitle-2-center text-small">
                        Basic
                      </div>
                    </div>
                  </div>
                </div>
                <div class="rollcard-bottom">
                  <div class="cpr-block">
                    <div class="d6-rollcard-data">
                      <div class="d6-dice-div">
                        ${diceFacesHtml}
                      </div>
                      <div class="d6-number-div">
                        <span class="clickable ${isCrit ? 'text-semi' : ''}" data-action="toggleVisibility" data-visible-element="d6-data-details">${totalDamage}</span>
                      </div>
                      <div class="d6-data-div">
                        <div class="text-normal text-semi">
                          Location: ${displayLocation}
                        </div>
                        ${critDisplayHtml}
                        <div class="d6-data-details hide"></div>
                      </div>
                    </div>
                  </div>
                </div>
                ${targetsHtml}
              </div>
              `;

              // 8. Send the generated card to chat
              await ChatMessage.create({
                user: game.userId,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: fakeCardHtml,
                rolls: [damageRoll], // This triggers Dice So Nice 3D dice if you use it
                type: CONST.CHAT_MESSAGE_TYPES?.ROLL || 5
              });
            }
          },
          miss: {
            label: "Miss",
            icon: "<i class='fas fa-times'></i>"
          }
        },
        default: "hit"
      }).render(true);
    }
  }
});
