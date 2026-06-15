Hooks.on("renderChatMessage", (message, html) => {

  html.find(".charge-hit").click(async (event) => {

    const weaponName =
      event.currentTarget.dataset.weapon;

    const itemId =
      event.currentTarget.dataset.itemId;

    const actor =
      game.actors.get(
        event.currentTarget.dataset.actorId
      );

    const item =
      actor?.items?.get(itemId);

    if (!actor || !item) {
      ui.notifications.warn(
        "Weapon not found."
      );
      return;
    }

    const currentAmmo =
      item.system.magazine.value;

    let buttons = {};

    const maxCharges =
      Math.min(
        currentAmmo,
        parseInt(
          weaponName.match(/\(Charge (\d+)\)/)?.[1] || 1
        )
      );

    for (let i = 1; i <= maxCharges; i++) {

      buttons[`charge${i}`] = {

        label: `Charge ${i}`,

        callback: async () => {

          const chargesUsed = i;

          const roll =
            await new Roll(
              `1d6 + ${chargesUsed}d6`
            ).evaluate({ async: true });

          await ui.chat.processMessage(
            `/red 0d6+${roll.total} # ${weaponName} (Charge ${chargesUsed})`
          );

          // CPR already spent 1 ammo
          const extraAmmo =
            Math.max(0, chargesUsed - 1);

          if (currentAmmo < extraAmmo) {

            ui.notifications.warn(
              "Not enough ammo."
            );

            return;
          }

          const newAmmo =
            Math.max(
              0,
              currentAmmo - extraAmmo
            );

          await item.update({
            "system.magazine.value":
              newAmmo
          });

        }
      };
    }

    new Dialog({
      title: weaponName,
      content:
        "<p>Select charge level:</p>",
      buttons
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

  const token =
    canvas.tokens.controlled[0];

  const actor =
    token?.actor;

  if (!actor) return;

  const item =
    actor.items.find(
      i => i.name === weaponName
    );

  if (!item) return;

  await ChatMessage.create({

    speaker:
      ChatMessage.getSpeaker(),

    content: `
      <div class="charge-card">

        <h3>${weaponName}</h3>

        <div style="display:flex;gap:5px;">

          <button
            class="charge-hit"
            data-weapon="${weaponName}"
            data-item-id="${item.id}"
            data-actor-id="${actor.id}">
            FIRE
          </button>

          <button class="charge-miss">
            CANCEL
          </button>

        </div>

      </div>
    `
  });

});
