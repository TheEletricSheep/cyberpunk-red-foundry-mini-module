Hooks.on("combatRound", async (combat, round) => {

  if (!game.user.isGM) return;

  await ChatMessage.create({
    speaker: { alias: "Burn Damage" },
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `
      <div class="burn-card">
        <h3>Apply Burn?</h3>

        <button class="burn-yes">
          YES
        </button>

        <button class="burn-no">
          NO
        </button>
      </div>
    `
  });

});

Hooks.on("renderChatMessage", (message, html) => {

  html.find(".burn-yes").click(async () => {

    const results = [];

    for (const combatant of game.combat.combatants) {

      const actor = combatant.actor;

      if (!actor) continue;

      let damage = 0;

      const effects = actor.effects.map(
        e => e.name.toLowerCase()
      );

      if (effects.includes("on fire (deadly)")) {
        damage = 6;
      } else if (effects.includes("on fire (strong)")) {
        damage = 4;
      } else if (effects.includes("on fire (mild)")) {
        damage = 2;
      }

      if (damage === 0) continue;

      const hp =
        actor.system.derivedStats.hp.value;

      await actor.update({
        "system.derivedStats.hp.value":
          Math.max(0, hp - damage)
      });

      results.push(
        `${actor.name}: ${damage} burn damage`
      );
    }

    if (results.length > 0) {

      await ChatMessage.create({
        content: `
          <h3>Burn Damage Applied</h3>
          ${results.join("<br>")}
        `
      });

    } else {

      await ChatMessage.create({
        content: `
          <h3>Burn Damage Applied</h3>
          No actors were on fire.
        `
      });

    }

  });

  html.find(".burn-no").click(async () => {

    await ChatMessage.create({
      content: `
        <h3>Burn Damage Skipped</h3>
      `
    });

  });

});
