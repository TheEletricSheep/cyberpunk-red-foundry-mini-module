Hooks.once("ready", () => {
  console.info("🎯 Shotgun Automatic Control Group Dialog Script Loaded (v22 - Separated Menus)");
});

Hooks.on("createChatMessage", async function (message) {
  if (game.userId !== (message.author?.id ?? message.user?.id) || !message || !message.content) return;

  const DIV = document.createElement("DIV");
  DIV.innerHTML = message.content;

  const isAttack = DIV.querySelector(`[data-tooltip='${game.i18n.localize("CPR.actorSheets.commonActions.rollDamage")}']`);
  const data = DIV.querySelector("[data-action=rollDamage]")?.dataset;

  if (!isAttack || !data) return;

  let token = canvas.scene?.tokens?.get(message.speaker?.token) || canvas.scene?.tokens?.get(data.tokenId) || canvas.scene?.tokens?.getName(message.speaker?.alias);
  const actor = token?.actor ?? game.actors.get(data.actorId);
  const firedWeapon = actor?.items?.get(data.itemId);

  if (!actor || !firedWeapon || !firedWeapon.name.toLowerCase().includes("shotgun automatic control group")) return;

  const match = firedWeapon.name.match(/\d+/);
  let ammoCost = match ? parseInt(match[0]) : 4;

  const allOtherWeapons = actor.items.filter(i => i.type === "weapon" && i.id !== firedWeapon.id && i.system.isRanged);
  let mainWeapon = allOtherWeapons.find(w => (w.system.installedItems?.list || []).some(id => actor.items.get(id)?.name.toLowerCase().includes("shotgun automatic control group")));

  if (!mainWeapon) {
    ui.notifications.warn("Could not find a main weapon with the Shotgun Automatic Control Group upgrade installed!");
    return;
  }

  // Deduct Ammo
  if (mainWeapon.system.magazine && typeof mainWeapon.system.magazine.value === "number") {
    let currentAmmo = mainWeapon.system.magazine.value;
    if (currentAmmo < ammoCost) {
      await mainWeapon.update({ "system.magazine.value": 0 });
      ChatMessage.create({ user: game.userId, speaker: ChatMessage.getSpeaker(), content: `<p><i><strong>*CLICK*</strong></i> Tried to autofire, but the <strong>${mainWeapon.name}</strong> didn't have enough ammo!</p>` });
      return;
    }
    await mainWeapon.update({ "system.magazine.value": currentAmmo - ammoCost });
    if (firedWeapon.system.magazine?.max) await firedWeapon.update({ "system.magazine.value": firedWeapon.system.magazine.max });
  }

  new Dialog({
    title: `Shotgun Autofire Damage - ${mainWeapon.name}`,
    content: `
      <div style="margin-bottom: 10px;"><p>Did the attack hit? If so, by how much did you beat the DV?</p></div>
      <div class="form-group" style="display: flex; align-items: center; margin-bottom: 10px;">
        <label style="flex: 1; font-weight: bold;">Multiplier:</label>
        <input id="shotgun-multiplier" type="number" value="1" min="1" max="5" style="width: 60px; text-align: center;"/>
      </div>
      <div class="form-group" style="display: flex; align-items: center; margin-bottom: 10px;">
        <label style="flex: 1; font-weight: bold;">Ammo Type:</label>
        <select id="shotgun-ammo" style="width: 140px;">
          <option value="basic">Basic</option>
          <option value="rubber">Rubber</option>
          <option value="armorPiercing">Armor-Piercing</option>
        </select>
      </div>
      <div class="form-group" style="display: flex; align-items: center; margin-bottom: 15px;">
        <label style="flex: 1; font-weight: bold;">Weapon Type:</label>
        <select id="shotgun-weapon-type" style="width: 140px;">
          <option value="standard">Standard</option>
          <option value="tech">Tech (50% Armor Ignore)</option>
          <option value="power">Power (+10 Crit Dmg)</option>
        </select>
      </div>
    `,
    buttons: {
      hit: {
        icon: '<i class="fas fa-crosshairs"></i>',
        label: "Hit! Roll Damage",
        callback: async (html) => {
          let mult = parseInt(html.find('#shotgun-multiplier').val()) || 1;
          let selectedAmmo = html.find('#shotgun-ammo').val();
          let selectedWeaponType = html.find('#shotgun-weapon-type').val();
          
          let roll = await new Roll(`2d6 * ${mult}`).evaluate();
          let keptDice = roll.dice[0].results.map(r => r.result);
          
          let countSixes = keptDice.filter(d => d === 6).length;
          let isCrit = countSixes >= 2;
          
          // Logic for Ammo and Weapon Type combinations
          let ammoDisplay = selectedAmmo === "rubber" ? "Rubber" : selectedAmmo === "armorPiercing" ? "Armor-Piercing" : "Basic";
          let weaponDisplay = selectedWeaponType === "tech" ? "Tech - " : selectedWeaponType === "power" ? "Power - " : "";
          let fullDisplayName = weaponDisplay + ammoDisplay;

          let ablationValue = selectedAmmo === "rubber" ? 0 : selectedAmmo === "armorPiercing" ? 2 : 1;
          let ignoreArmor = selectedWeaponType === "tech" ? 50 : 0;
          let bonusDamage = isCrit ? (selectedWeaponType === "power" ? 10 : 5) : 0;
          
          let diceSizeClass = keptDice.length > 5 ? "d6-30" : "d6-60";
          let diceHTML = keptDice.map(d => {
            if (isCrit && d === 6) {
              return `<img class="d6 ${diceSizeClass}" src="systems/cyberpunk-red-core/icons/dice/red/d6_6_preem.svg" />`;
            }
            return `<img class="d6 ${diceSizeClass}" src="systems/cyberpunk-red-core/icons/dice/black/d6_${d}.svg" />`;
          }).join("");

          ChatMessage.create({
            user: game.userId,
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: `
              <div class="rollcard">
                <div class="rollcard-top"><div class="cpr-block chat-rollTitle-stat"><div class="text-center text-padding-top text-normal text-semi">Shotgun Autofire Damage (${mainWeapon.name})</div><div class="rollcard-subtitle"><div class="rollcard-subtitle-center text-small">Damage</div><div class="rollcard-subtitle-right"><a class="clickable" data-action="applyDamage" data-scope="global" data-total-damage="${roll.total}" data-bonus-damage="${bonusDamage}" data-damage-location="body" data-damage-lethal="true" data-ablation="${ablationValue}" data-ammo-variety="${selectedAmmo}" data-ignore-armor-percent="${ignoreArmor}" data-ignore-below-sp="0"><i class="fas fa-bolt" data-tooltip="Apply damage to selected Token(s)."></i></a></div><div class="rollcard-subtitle-2-center text-small">${fullDisplayName}</div></div></div></div>
                <div class="rollcard-bottom"><div class="cpr-block"><div class="d6-rollcard-data"><div class="d6-dice-div">${diceHTML}</div><div class="d6-number-div"><span class="clickable text-semi" data-action="toggleVisibility" data-visible-element="d6-data-details">${roll.total}</span></div><div class="d6-data-div">${bonusDamage > 0 ? `<div class="text-normal text-semi">Critical Damage: ${bonusDamage}</div>` : ""}<div class="d6-data-details hide">Formula: ${roll.formula}<br>Dice: ${keptDice.join(", ")}</div></div></div></div></div>
              </div>`,
            rolls: [roll],
            type: CONST.CHAT_MESSAGE_TYPES?.ROLL ?? 5
          });
        }
      }
    }
  }).render(true);
});
