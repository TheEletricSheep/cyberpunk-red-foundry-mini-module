Hooks.on("createChatMessage", async (message) => {

  const html = message.content;

  // Only attack cards
  if (!html.includes("rollDamage")) return;

  const parser = document.createElement("div");
  parser.innerHTML = html;

  const weaponName = parser
    .querySelector(".text-center")
    ?.textContent
    ?.trim();

  if (!weaponName) return;

  if (!weaponName.includes("(CHARGE")) return;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="charge-card">
        <h3>${weaponName}</h3>

        <div style="display:flex;gap:5px;">
          <button class="charge-hit"
                  data-weapon="${weaponName}">
            HIT
          </button>

          <button class="charge-miss">
            MISS
          </button>
        </div>
      </div>
    `
  });

});

Hooks.on("renderChatMessage", (message, html) => {

  html.find(".charge-hit").click(async (event) => {

    const weaponName =
      event.currentTarget.dataset.weapon;

    const match =
      weaponName.match(/\(CHARGE\s*(\d+)\)/i);

    if (!match) {
      ui.notifications.warn(
        `No charge value found on ${weaponName}`
      );
      return;
    }

    const maxCharges =
      parseInt(match[1]);

    const buttons = {};

    for (let i = 1; i <= maxCharges; i++) {

      buttons[`charge${i}`] = {

        label: `${i}`,

        callback: async () => {

          const formula =
            `${1 + i}d6`;

          const roll =
            await new Roll(formula)
              .evaluate({ async: true });

          await roll.toMessage({
            speaker: ChatMessage.getSpeaker(),
            flavor: `
              <h2>${weaponName}</h2>
              <p><b>Charges Used:</b> ${i}</p>
              <p><b>Damage:</b> ${formula}</p>
            `
          });

        }
      };
    }

    new Dialog({
      title: weaponName,
      content: `
        <p>Select how many charges to use.</p>
      `,
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
