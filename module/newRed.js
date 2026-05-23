Hooks.on("createChatMessage", async (message) => {

  const content = message.content;

  // Only attack cards
  if (!content.includes('data-action="rollDamage"')) return;

  // Only NR weapons
  if (!content.includes("(NR)")) return;

  const actorId = content.match(/data-actor-id="([^"]+)"/)?.[1];
  const itemId = content.match(/data-item-id="([^"]+)"/)?.[1];
  const tokenId = content.match(/data-token-id="([^"]+)"/)?.[1];

  await ChatMessage.create({
    content: `
      <div class="nr-card">
        <h2>New RED Attack</h2>

        <p>Did the attack hit?</p>

        <button
          class="nr-hit"
          data-actor="${actorId}"
          data-item="${itemId}"
          data-token="${tokenId}">
          HIT
        </button>

        <button class="nr-miss">
          MISS
        </button>
      </div>
    `
  });

});

Hooks.on("renderChatMessage", (message, html) => {

  html.find(".nr-hit").click(async (event) => {

    // Prevent double-clicks
    html.find(".nr-hit").prop("disabled", true);
    html.find(".nr-miss").prop("disabled", true);

    const roll = await new Roll("5d6kh2").evaluate();

    const keptDice = roll.dice[0].results
      .filter(r => !r.discarded)
      .map(r => r.result);

    const isCritical =
      keptDice.filter(d => d === 6).length >= 2;

    // Create normal CPR damage card
    ui.chat.processMessage(
      `/red 0d6+${roll.total} # Custom Weapon`
    );

    if (isCritical) {

      const targets = Array.from(game.user.targets);

      if (targets.length !== 1) {

        ui.notifications.warn(
          "Critical hit detected, but exactly one target must be selected."
        );

        return;
      }

      const actor = targets[0].actor;

      const currentHp =
        actor.system.derivedStats.hp.value;

      await actor.update({
        "system.derivedStats.hp.value":
          Math.max(0, currentHp - 5)
      });

      ChatMessage.create({
        content: `
          <h3>Critical Damage!</h3>
          <p>Kept dice: ${keptDice.join(", ")}</p>
          <p><b>${actor.name}</b> suffers 5 additional direct damage.</p>
        `
      });
    }
  });

  html.find(".nr-miss").click(() => {

    html.find(".nr-hit").prop("disabled", true);
    html.find(".nr-miss").prop("disabled", true);

    ChatMessage.create({
      content: "<p><b>Attack Missed</b></p>"
    });

  });

});
