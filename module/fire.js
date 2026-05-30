Hooks.on("combatRound", async (combat, round) => {

  if (!game.user.isGM) return;

  const results = [];

  for (const combatant of combat.combatants) {

    const actor = combatant.actor;

    if (!actor) continue;

    const effectNames = actor.effects.map(
      e => e.name.toLowerCase()
    );

    // Fire Immunity prevents all burn damage
    if (
      effectNames.includes("fire immunity")
    ) {
      continue;
    }

    let damage = 0;

    if (
      effectNames.includes("on fire (deadly)")
    ) {
      damage = 6;
    }
    else if (
      effectNames.includes("on fire (strong)")
    ) {
      damage = 4;
    }
    else if (
      effectNames.includes("on fire (mild)")
    ) {
      damage = 2;
    }

    if (damage === 0) continue;

    const currentHp =
      actor.system.derivedStats.hp.value;

    await actor.update({
      "system.derivedStats.hp.value":
        Math.max(0, currentHp - damage)
    });

    results.push(
      `${actor.name}: ${damage} burn damage`
    );
  }

  if (results.length > 0) {

   await ChatMessage.create({
  speaker: {
    alias: "Burn Damage"
  },
  content: `
    <div class="cpr-block">

      <div
        class="text-normal text-semi"
        style="margin-left: 12px;"
      >
        Burn Damage
      </div>

      <div
        class="text-normal"
        style="margin-left: 12px;"
      >
        ${results.join("<br>")}
      </div>

    </div>
  `
});

  }

});
