Hooks.once("ready", () => {
  console.info("🎯 Custom CPR Weapons Script Loaded (Charge, False Autofire, Autosear, Shotgun ACG)");
});

// ==========================================
// HOOK 1: RENDER CHAT MESSAGE 
// Handles button clicks for Charge and False Autofire
// ==========================================
Hooks.on("renderChatMessage", (message, html) => {

    // --- 1. CHARGE WEAPON LOGIC ---
    html.find(".charge-hit").click(async (event) => {
        const weaponId = event.currentTarget.dataset.weaponId;
        const actorId = event.currentTarget.dataset.actorId;

        const actor = game.actors.get(actorId);
        if (!actor) return;

        const weapon = actor.items.get(weaponId);
        if (!weapon) return;

        let currentAmmo = weapon.system.magazine?.value ?? 0;
        const maxChargesFromName = parseInt(weapon.name.match(/\(Charge (\d+)\)/)?.[1] || 0);
        const maxCharges = Math.min(currentAmmo, maxChargesFromName);

        let buttons = "";
        for (let i = 0; i <= maxCharges; i++) {
            buttons += `<button class="charge-select" data-charge="${i}">Charge ${i}</button>`;
        }

        new Dialog({
            title: weapon.name,
            content: `<p>Select charge level:</p><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">${buttons}</div>`,
            buttons: {},
            render: (dialogHtml) => {
                dialogHtml.find(".charge-select").click(async ev => {
                    const chargesUsed = parseInt(ev.currentTarget.dataset.charge);
                    const extraAmmo = chargesUsed;

                    await weapon.update({
                        "system.magazine.value": Math.max(0, currentAmmo - extraAmmo)
                    });

                    const totalDice = chargesUsed + 1;
                    await ui.chat.processMessage(`/red ${totalDice}d6 # ${weapon.name} (Charge ${chargesUsed})`);

                    const dlg = ev.currentTarget.closest(".app");
                    if (dlg) {
                        const app = Object.values(ui.windows).find(w => w.element?.[0] === dlg);
                        app?.close();
                    }
                });
            }
        }).render(true);

        event.currentTarget.disabled = true;
        const missButton = html.find(".charge-miss")[0];
        if (missButton) missButton.disabled = true;
    });

    html.find(".charge-miss").click(async (event) => {
        event.currentTarget.disabled = true;
        const hitButton = html.find(".charge-hit")[0];
        if (hitButton) hitButton.disabled = true;
    });

    // --- 2. FALSE AUTOFIRE LOGIC ---
    html.find(".autofire-hit").click(async (event) => {
        const weaponId = event.currentTarget.dataset.weaponId;
        const actorId = event.currentTarget.dataset.actorId;

        const actor = game.actors.get(actorId);
        if (!actor) return;

        const weapon = actor.items.get(weaponId);
        if (!weapon) return;

        // Spend 6 bullets
        let currentAmmo = weapon.system.magazine?.value ?? 0;
        if (currentAmmo < 6) {
            ui.notifications.warn(`Not enough ammo! ${weapon.name} needs 6 bullets for Autofire.`);
        }
        
        await weapon.update({
            "system.magazine.value": Math.max(0, currentAmmo - 6)
        });

        let multiButtons = "";
        for (let i = 1; i <= 4; i++) {
            multiButtons += `<button class="autofire-multi-select" data-multi="${i}">Multiplier ${i}</button>`;
        }

        new Dialog({
            title: `${weapon.name} - Autofire Multiplier`,
            content: `
                <p>What was your margin of success (multiplier)?</p>
                <div style="display:flex;gap:5px;margin-bottom:10px;">${multiButtons}</div>
            `,
            buttons: {},
            render: (dialogHtml) => {
                dialogHtml.find(".autofire-multi-select").click(async ev => {
                    const multiplier = parseInt(ev.currentTarget.dataset.multi);

                    const roll = new Roll("2d6");
                    await roll.evaluate(); 
                    const rollTotal = roll.total;
                    const finalDamage = rollTotal * multiplier;

                    // Generate native Cyberpunk Red dice images
                    const diceImages = roll.terms[0].results.map(d => {
                        return `<img class="d6 d6-60" src="systems/cyberpunk-red-core/icons/dice/black/d6_${d.result}.svg" />`;
                    }).join("");

                    const fakeCard = `
                        <div class="rollcard">
                          <div class="rollcard-top">
                            <div class="cpr-block chat-rollTitle-stat">
                              <div class="text-center text-padding-top text-normal text-semi">
                                ${weapon.name}
                              </div>
                              <div class="rollcard-subtitle">
                                <div class="rollcard-subtitle-center text-small">Autofire Damage</div>
                                <div class="rollcard-subtitle-right">
                                  <a class="clickable" data-action="applyDamage" data-scope="global" data-total-damage="${finalDamage}" data-bonus-damage="0" data-damage-location="body" data-damage-lethal="true" data-ablation="1" data-ammo-variety="basic" data-ignore-armor-percent="0" data-ignore-below-sp="0">
                                    <i class="fas fa-bolt" data-tooltip="Apply damage to selected Token(s)."></i>
                                  </a>
                                </div>
                                <div class="rollcard-subtitle-2-center text-small">
                                  Multiplier x${multiplier} (6 Ammo Spent)
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="rollcard-bottom">
                            <div class="cpr-block">
                              <div class="d6-rollcard-data">
                                <div class="d6-dice-div">${diceImages}</div>
                                <div class="d6-number-div">
                                    <span class="clickable" data-action="toggleVisibility" data-visible-element="d6-data-details">${finalDamage}</span>
                                </div>
                                <div class="d6-data-div">
                                  <div class="d6-data-details hide">Base Roll: ${rollTotal}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                    `;

                    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), content: fakeCard });

                    const dlg = ev.currentTarget.closest(".app");
                    if (dlg) {
                        const app = Object.values(ui.windows).find(w => w.element?.[0] === dlg);
                        app?.close();
                    }
                });
            }
        }).render(true);

        event.currentTarget.disabled = true;
        const missButton = html.find(".autofire-miss")[0];
        if (missButton) missButton.disabled = true;
    });

    html.find(".autofire-miss").click(async (event) => {
        event.currentTarget.disabled = true;
        const hitButton = html.find(".autofire-hit")[0];
        if (hitButton) hitButton.disabled = true;
    });
});


// ==========================================
// HOOK 2: CREATE CHAT MESSAGE
// Intercepts attacks to spawn the custom logic/buttons
// ==========================================
Hooks.on("createChatMessage", async (message) => {
    if (game.user.id !== message.author?.id) return;
    const html = message.content;
    if (!html) return;

    // We only care if the message contains a damage button
    if (!html.includes("rollDamage")) return;

    const parser = document.createElement("div");
    parser.innerHTML = html;

    const rollDamageBtn = parser.querySelector("[data-action='rollDamage']");
    if (!rollDamageBtn) return;

    const weaponName = parser.querySelector(".text-center")?.textContent?.trim() || "";
    const lowerWeaponName = weaponName.toLowerCase();
    
    const actorId = rollDamageBtn.dataset.actorId;
    const itemId = rollDamageBtn.dataset.itemId;
    const actor = game.actors.get(actorId);
    if (!actor) return;

    // --- 1. CHARGE INTERCEPT ---
    if (weaponName.includes("(Charge")) {
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker(),
            content: `
                <div class="charge-card">
                    <h3>${weaponName}</h3>
                    <div style="display:flex;gap:5px;">
                        <button class="charge-hit" data-weapon-id="${itemId}" data-actor-id="${actorId}">FIRE</button>
                        <button class="charge-miss">CANCEL</button>
                    </div>
                </div>
            `
        });
        return;
    }

    // --- 2. FALSE AUTOFIRE INTERCEPT ---
    if (weaponName.includes("(False Autofire)")) {
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker(),
            content: `
                <div class="charge-card">
                    <h3>${weaponName}</h3>
                    <div style="display:flex;gap:5px;">
                        <button class="autofire-hit" data-weapon-id="${itemId}" data-actor-id="${actorId}">HIT (Spend 6 Ammo)</button>
                        <button class="autofire-miss">MISS / CANCEL</button>
                    </div>
                </div>
            `
        });
        return;
    }

    // --- 3. AUTOFIRE UPGRADES INTERCEPT (Autosear & Shotgun ACG) ---
    const isAutosear = lowerWeaponName.includes("efficient autosear");
    const isShotgunACG = lowerWeaponName.includes("shotgun automatic control group");

    if (isAutosear || isShotgunACG) {
        const upgradeKeyword = isAutosear ? "efficient autosear" : "shotgun automatic control group";
        const upgradeLabel = isAutosear ? "Autosear" : "Automatic Control Group";

        const firedWeapon = actor.items.get(itemId);
        if (!firedWeapon) return;

        // Hardcode the ammo cost based on the upgrade type
        let ammoCost = isAutosear ? 6 : 4; 

        // Find Main Weapon (must have the specific upgrade installed)
        const allOtherWeapons = actor.items.filter(i => i.type === "weapon" && i.id !== firedWeapon.id && i.system.isRanged);
        let mainWeapon = null;
        for (const w of allOtherWeapons) {
            const upgradeIds = w.system.installedItems?.list || [];
            const hasTheUpgrade = upgradeIds.some(id => {
                const upg = actor.items.get(id);
                return upg && upg.name.toLowerCase().includes(upgradeKeyword);
            });
            if (hasTheUpgrade) {
                mainWeapon = w;
                break;
            }
        }

        if (!mainWeapon) {
            ui.notifications.warn(`Could not find a main weapon with the ${upgradeLabel} upgrade installed!`);
            return;
        }

        // Deduct ammo
        if (mainWeapon.system.magazine && typeof mainWeapon.system.magazine.value === "number") {
            let currentAmmo = mainWeapon.system.magazine.value;
            if (currentAmmo < ammoCost) {
                await mainWeapon.update({ "system.magazine.value": 0 });
                ChatMessage.create({
                    user: game.userId,
                    speaker: ChatMessage.getSpeaker(),
                    content: `<p><i><strong>*CLICK*</strong></i> Tried to autofire, but the <strong>${mainWeapon.name}</strong> didn't have enough ammo!</p>`,
                });
                return; 
            } else {
                await mainWeapon.update({ "system.magazine.value": currentAmmo - ammoCost });
                if (firedWeapon.system.magazine && firedWeapon.system.magazine.max) {
                    await firedWeapon.update({ "system.magazine.value": firedWeapon.system.magazine.max });
                }
            }
        }

        // Pop Dialog
        new Dialog({
            title: `${upgradeLabel} Damage - ${mainWeapon.name}`,
            content: `
              <div style="margin-bottom: 10px;">
                <p>Did the attack hit? If so, by how much did you beat the DV?</p>
              </div>
              <div class="form-group" style="display: flex; align-items: center; margin-bottom: 15px;">
                <label style="flex: 1; font-weight: bold;">Multiplier (Amount beat DV by):</label>
                <input id="autofire-upgrade-multiplier" type="number" value="1" min="1" max="5" style="width: 60px; text-align: center;"/>
              </div>
            `,
            buttons: {
                hit: {
                    icon: '<i class="fas fa-crosshairs"></i>',
                    label: "Hit! Roll Damage",
                    callback: async (dialogHtml) => {
                        let mult = parseInt(dialogHtml.find('#autofire-upgrade-multiplier').val());
                        if (isNaN(mult) || mult < 1) mult = 1;
                        
                        // Roll 2d6
                        let roll = new Roll("2d6");
                        await roll.evaluate();
                        let rollTotal = roll.total;
                        let finalDamage = rollTotal * mult;
                        
                        // Grab actual dice faces for native styling
                        let keptDice = roll.terms[0].results.map(r => r.result);
                        let isCrit = keptDice.filter(d => d === 6).length >= 2;
                        let bonusDamage = isCrit ? 5 : 0; 
                        
                        const diceImages = keptDice.map(d => {
                            return `<img class="d6 d6-60" src="systems/cyberpunk-red-core/icons/dice/black/d6_${d}.svg" />`;
                        }).join("");

                        let customHTML = `
                            <div class="rollcard">
                              <div class="rollcard-top">
                                <div class="cpr-block chat-rollTitle-stat">
                                  <div class="text-center text-padding-top text-normal text-semi">
                                    ${upgradeLabel} Damage (${mainWeapon.name})
                                  </div>
                                  <div class="rollcard-subtitle">
                                    <div class="rollcard-subtitle-center text-small">Damage</div>
                                    <div class="rollcard-subtitle-right">
                                      <a class="clickable" data-action="applyDamage" data-scope="global" data-total-damage="${finalDamage}" data-bonus-damage="${bonusDamage}" data-damage-location="body" data-damage-lethal="true" data-ablation="1" data-ammo-variety="" data-ignore-armor-percent="0" data-ignore-below-sp="0">
                                        <i class="fas fa-bolt" data-tooltip="Apply damage to selected Token(s)."></i>
                                      </a>
                                    </div>
                                    <div class="rollcard-subtitle-2-center text-small">
                                      Multiplier x${mult}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div class="rollcard-bottom">
                                <div class="cpr-block">
                                  <div class="d6-rollcard-data">
                                    <div class="d6-dice-div">${diceImages}</div>
                                    <div class="d6-number-div">
                                      <span class="clickable" data-action="toggleVisibility" data-visible-element="d6-data-details">${finalDamage}</span>
                                    </div>
                                    <div class="d6-data-div">
                                      <div class="d6-data-details hide">
                                        Base Roll: ${rollTotal}
                                        ${bonusDamage > 0 ? `<br><strong>Critical Bonus: +${bonusDamage}</strong>` : ""}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                        `;

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
                        ui.notifications.info(`${upgradeLabel} attack missed. ${ammoCost} rounds were spent from ${mainWeapon.name}.`);
                    }
                }
            },
            default: "hit"
        }).render(true);
        return;
    }
});
