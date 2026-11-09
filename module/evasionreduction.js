// 1. Register the toggle setting when Foundry initializes
Hooks.once("init", () => {
  game.settings.register("my-custom-cpr-tweaks", "enableEvasionDR", {
    name: "Enable Evasion Damage Reduction",
    hint: "When enabled, rolling Evasion will output a 'Bullet Dodge' button to chat.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

// 2. The main chat message hook (Creates the Button)
Hooks.on("createChatMessage", async (message) => {
  if (!game.settings.get("my-custom-cpr-tweaks", "enableEvasionDR")) return;
  if (message.user.id !== game.user.id) return;

  const html = message.content;
  if (!html.includes("Evasion")) return;

  // Extract the Evasion total
  let evasionTotal = 0;
  if (message.rolls && message.rolls.length > 0) {
    evasionTotal = message.rolls[0].total;
  } else {
    const parser = document.createElement("div");
    parser.innerHTML = html;
    const span = parser.querySelector(".d10-number-div span");
    if (span) evasionTotal = parseInt(span.textContent.trim());
  }

  if (isNaN(evasionTotal) || evasionTotal === 0) return;

  // Extract actor/token IDs now so the button knows who to apply the effect to later
  const speakerToken = message.speaker.token || "";
  const speakerActor = message.speaker.actor || "";

  await ChatMessage.create({
    speaker: message.speaker,
    content: `
      <div class="cpr-block" style="margin-top: 5px; text-align: center;">
        <button class="bullet-dodge-btn" 
                data-evasion="${evasionTotal}" 
                data-token="${speakerToken}" 
                data-actor="${speakerActor}"
                style="border-radius: 0px; border: 1px solid #ff0033; background: #111; color: #ff0033; font-weight: bold; text-transform: uppercase; padding: 5px;">
          BULLET DODGE
        </button>
      </div>
    `
  });
});

// 3. Listen for the button click (Opens Dialog & Calculates Math)
Hooks.on("renderChatMessage", (message, html) => {
  html.find(".bullet-dodge-btn").click(async (event) => {
    event.preventDefault();
    const btn = event.currentTarget;
    
    // Pull the data we stored inside the button
    const evasionTotal = parseInt(btn.dataset.evasion);
    const tokenId = btn.dataset.token;
    const actorId = btn.dataset.actor;

    // Create the Dialog Window
    new Dialog({
      title: "Bullet Dodge (Evasion vs Attack)",
      content: `
        <form style="margin-bottom: 10px;">
          <p>Evasion Total: <strong>${evasionTotal}</strong></p>
          <div class="form-group">
            <label for="attack-total"><strong>Incoming Attack Total:</strong></label>
            <input type="number" id="attack-total" name="attack-total" autofocus>
          </div>
        </form>
      `,
      buttons: {
        compare: {
          icon: '<i class="fas fa-shield-alt"></i>',
          label: "Compare",
          callback: async (dialogHtml) => {
            const attackTotal = parseInt(dialogHtml.find('#attack-total').val());

            if (isNaN(attackTotal)) {
              ui.notifications.warn("You must enter a valid attack number.");
              return;
            }

            // Compare and Output
            if (evasionTotal > attackTotal) {
              const damageReduction = evasionTotal - attackTotal;
              let actor = null;
              
              // 1. Try to get the specific token from the button data
              if (tokenId) {
                const tokenDoc = canvas.scene.tokens.get(tokenId);
                if (tokenDoc) actor = tokenDoc.actor;
              }
              
              // 2. Fallback to actor ID from the button data
              if (!actor && actorId) {
                actor = game.actors.get(actorId);
              }
              
              // 3. Fallback to currently selected token
              if (!actor && canvas.tokens.controlled.length > 0) {
                actor = canvas.tokens.controlled[0].actor;
              }

              if (actor) {
                const effectData = {
                  name: `Evasion DR (+${damageReduction})`,
                  img: "icons/svg/shield.svg",
                  type: "base",
                  changes: [
                    {
                      key: "bonuses.universalDamageReduction",
                      mode: 2, 
                      value: `${damageReduction}`
                    }
                  ],
                  duration: { turns: 1 },
                  flags: {
                    "cyberpunk-red-core": {
                      "changes": {
                        "cats": { "0": "combat" },
                        "situational": {
                          "0": { "isSituational": false, "onByDefault": false }
                        }
                      }
                    }
                  }
                };
                
                await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
                ui.notifications.info(`Applied +${damageReduction} Damage Reduction to ${actor.name}`);
              } else {
                ui.notifications.warn("Could not find an actor to apply Damage Reduction to.");
              }

              await ChatMessage.create({
                speaker: message.speaker,
                content: `
                  <div class="cpr-block">
                    <h3 style="text-align: center; border-bottom: 1px solid red; border-radius: 0;">Bullet Dodge Successful</h3>
                    <p style="text-align: center; font-size: 14px;">
                      Evasion (${evasionTotal}) beat Attack (${attackTotal})
                    </p>
                    <p style="text-align: center; font-size: 16px; font-weight: bold; color: #00ff00;">
                      Damage Reduction: ${damageReduction}
                    </p>
                  </div>
                `
              });
            } else {
              await ChatMessage.create({
                speaker: message.speaker,
                content: `
                  <div class="cpr-block">
                    <h3 style="text-align: center; border-bottom: 1px solid red; border-radius: 0;">Bullet Dodge Failed</h3>
                    <p style="text-align: center;">Attack (${attackTotal}) beats or ties Evasion (${evasionTotal}). No reduction.</p>
                  </div>
                `
              });
            }

            // Disable the button after use to prevent double-clicking
            btn.disabled = true;
            btn.textContent = "RESOLVED";
            btn.style.borderColor = "#555";
            btn.style.color = "#555";
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "compare"
    }).render(true);
  });
});
