Hooks.on("createChatMessage", (message) => {
  // 1. Only trigger for the user who actually made the roll
  if (message.user.id !== game.user.id) return;

  const html = message.content;

  // 2. Check if the roll is an Evasion check
  if (!html.includes("Evasion")) return;

  // 3. Extract the Evasion total
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

  // 4. Create the Dialog Window
  new Dialog({
    title: "Evasion vs Attack",
    content: `
      <form style="margin-bottom: 10px;">
        <p>You rolled an <strong>${evasionTotal}</strong> for Evasion.</p>
        <div class="form-group">
          <label for="attack-total"><strong>Attack Total:</strong></label>
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

          // 5. Compare and Output
          if (evasionTotal > attackTotal) {
            const damageReduction = evasionTotal - attackTotal;
            
            // --- UPDATED: Apply CPR-Formatted Active Effect ---
            const actor = ChatMessage.getSpeakerActor(message.speaker) || canvas.tokens.controlled[0]?.actor;

            if (actor) {
              const effectData = {
                name: `Evasion DR (+${damageReduction})`,
                img: "icons/svg/shield.svg",
                type: "base",
                changes: [
                  {
                    key: "bonuses.universalDamageReduction", // FIXED: Removed 'system.' prefix
                    mode: 2, // CONST.ACTIVE_EFFECT_MODES.ADD
                    value: `${damageReduction}`
                  }
                ],
                duration: {
                  turns: 1 // Automatically expires at the end of their next turn
                },
                // FIXED: Added mandatory CPR system flags to prevent sheet breaking
                flags: {
                  "cyberpunk-red-core": {
                    "changes": {
                      "cats": {
                        "0": "combat"
                      },
                      "situational": {
                        "0": {
                          "isSituational": false,
                          "onByDefault": false
                        }
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
            // --------------------------------------------------

            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker(),
              content: `
                <div class="cpr-block">
                  <h3 style="text-align: center; border-bottom: 1px solid red;">Evasion Successful</h3>
                  <p style="text-align: center; font-size: 14px;">
                    Evasion (${evasionTotal}) beat Attack (${attackTotal})!
                  </p>
                  <p style="text-align: center; font-size: 16px; font-weight: bold; color: green;">
                    Damage Reduction: ${damageReduction}
                  </p>
                </div>
              `
            });
          } else {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker(),
              content: `
                <div class="cpr-block">
                  <h3 style="text-align: center; border-bottom: 1px solid red;">Evasion Failed</h3>
                  <p style="text-align: center;">Attack (${attackTotal}) beats or ties Evasion (${evasionTotal}). No reduction.</p>
                </div>
              `
            });
          }
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
