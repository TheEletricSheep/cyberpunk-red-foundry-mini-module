Hooks.on("combatRound", async (combat, round) => {

  if (!game.user.isGM) return;

  const burnResults = [];
  const mindfireResults = [];

  for (const combatant of combat.combatants) {

    const actor = combatant.actor;

    if (!actor) continue;

    const effectNames = actor.effects.map(
      e => e.name.toLowerCase()
    );

    // -----------------
    // Burn Damage
    // -----------------

    if (!effectNames.includes("fire immunity")) {

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

      if (damage > 0) {

        const currentHp =
          actor.system.derivedStats.hp.value;

        await actor.update({
          "system.derivedStats.hp.value":
            Math.max(0, currentHp - damage)
        });

        burnResults.push(
          `${actor.name} suffers <b>${damage} burn damage</b>.`
        );
      }
    }

    // -----------------
    // Mindfire
    // -----------------

    if (effectNames.includes("mindfire")) {

      const currentHp =
        actor.system.derivedStats.hp.value;

      if (currentHp > 1) {

        await actor.update({
          "system.derivedStats.hp.value":
            Math.max(1, currentHp - 1)
        });

        mindfireResults.push(
          `${actor.name} suffers <b>1 Mindfire damage</b>.`
        );
      }
    }
  }

  // -----------------
  // Burn Message
  // -----------------

  if (burnResults.length > 0) {

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
            ${burnResults.join("<br>")}
          </div>

        </div>
      `
    });

  }

  // -----------------
  // Mindfire Message
  // -----------------

  if (mindfireResults.length > 0) {

    await ChatMessage.create({
      speaker: {
        alias: "Mindfire"
      },
      content: `
        <div class="cpr-block">

          <div
            class="text-normal text-semi"
            style="margin-left: 12px;"
          >
            Mindfire
          </div>

          <div
            class="text-normal"
            style="margin-left: 12px;"
          >
            ${mindfireResults.join("<br>")}
          </div>

        </div>
      `
    });

  }

});
