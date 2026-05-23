Hooks.on("createChatMessage", async (message) => {

  const html = message.content;

  console.log("NR CHECK MESSAGE:");
  console.log(html);

  // Only attack cards
  if (!html.includes("rollDamage")) return;

  const parser = document.createElement("div");
  parser.innerHTML = html;

  const weaponName = parser
    .querySelector(".text-center")
    ?.textContent
    ?.trim();

  console.log("NR WEAPON:", weaponName);

  if (!weaponName) return;

  if (!weaponName.includes("(NR)")) return;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="nr-card">
        <h3>${weaponName}</h3>

        <div style="display:flex;gap:5px;">
          <button class="nr-hit"
                  data-weapon="${weaponName}">
            HIT
          </button>

          <button class="nr-miss">
            MISS
          </button>
        </div>
      </div>
    `
  });

});

Hooks.on("renderChatMessage", (message, html) => {

  html.find(".nr-hit").click(async (event) => {

    const weaponName =
      event.currentTarget.dataset.weapon;

    const macro =
      game.macros.getName(weaponName);

    if (!macro) {
      ui.notifications.warn(
        `Macro not found: ${weaponName}`
      );
      return;
    }

    await macro.execute();

    event.currentTarget.disabled = true;

    const missButton =
      html.find(".nr-miss")[0];

    if (missButton) {
      missButton.disabled = true;
    }
  });

  html.find(".nr-miss").click(async (event) => {

    event.currentTarget.disabled = true;

    const hitButton =
      html.find(".nr-hit")[0];

    if (hitButton) {
      hitButton.disabled = true;
    }
  });

});
