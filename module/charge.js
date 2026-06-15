Hooks.on("renderChatMessage", (message, html) => {

  html.find(".charge-hit").click(async (event) => {

    const weaponId =
      event.currentTarget.dataset.weaponId;

    const actorId =
      event.currentTarget.dataset.actorId;

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const weapon = actor.items.get(weaponId);
    if (!weapon) return;

    let currentAmmo =
      weapon.system.magazine?.value ?? 0;

    // Read maximum charge from weapon name
    // Example: Heavy Pistol (Charge 4)
    const maxChargesFromName =
      parseInt(
        weapon.name.match(/\(Charge (\d+)\)/)?.[1] || 0
      );

    // CPR already spent the base shot
    // Remaining ammo determines extra charge levels available
    const maxCharges =
      Math.min(
        currentAmmo,
        maxChargesFromName
      );

    let buttons = "";

    for (let i = 0; i <= maxCharges; i++) {

      buttons += `
        <button class="charge-select"
                data-charge="${i}">
          Charge ${i}
        </button>
      `;
    }

    new Dialog({
      title: weapon.name,
      content: `
        <p>Select charge level:</p>

        <div style="
          display:flex;
          flex-wrap:wrap;
          gap:5px;
        ">
          ${buttons}
        </div>
      `,
      buttons: {},
      render: (dialogHtml) => {

        dialogHtml.find(".charge-select").click(
          async ev => {

            const chargesUsed =
              parseInt(
                ev.currentTarget.dataset.charge
              );

            // Spend only extra ammo
            const extraAmmo = chargesUsed;

            await weapon.update({
              "system.magazine.value":
                Math.max(
                  0,
                  currentAmmo - extraAmmo
                )
            });

            // Charge 0 = 1d6
            // Charge 1 = 2d6
            // Charge 4 = 5d6
            const totalDice =
              chargesUsed + 1;

            await ui.chat.processMessage(
              `/red ${totalDice}d6 # ${weapon.name} (Charge ${chargesUsed})`
            );

            dialog.close();
          }
        );
      }
    }).render(true);

    event.currentTarget.disabled = true;

    const missButton =
      html.find(".charge-miss")[0];

    if (missButton) {
      missButton.disabled = true;
    }

  });

  html.find(".charge-miss").click(async (event) => {

    event.currentTarget.disabled = true;

    const hitButton =
      html.find(".charge-hit")[0];

    if (hitButton) {
      hitButton.disabled = true;
    }

  });

});


Hooks.on("createChatMessage", async (message) => {

  if (
    game.user.id !== message.author?.id
  ) return;

  const html = message.content;

  if (!html.includes("rollDamage")) return;

  const parser =
    document.createElement("div");

  parser.innerHTML = html;

  const weaponName =
    parser
      .querySelector(".text-center")
      ?.textContent
      ?.trim();

  if (!weaponName) return;

  if (!weaponName.includes("(Charge")) return;

  const rollButton =
    parser.querySelector(
      "[data-action='rollDamage']"
    );

  if (!rollButton) return;

  const actorId =
    rollButton.dataset.actorId;

  const itemId =
    rollButton.dataset.itemId;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="charge-card">
        <h3>${weaponName}</h3>

        <div style="display:flex;gap:5px;">

          <button
            class="charge-hit"
            data-weapon-id="${itemId}"
            data-actor-id="${actorId}">
            FIRE
          </button>

          <button
            class="charge-miss">
            CANCEL
          </button>

        </div>
      </div>
    `
  });

});
