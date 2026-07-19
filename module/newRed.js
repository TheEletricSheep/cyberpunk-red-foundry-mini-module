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

  if (!weaponName || !weaponName.includes("(NR)")) return;

  // Extract the ammo type from the attack card (defaults to Basic if not found)
  const ammoType = parser
    .querySelector(".rollcard-subtitle-2-center")
    ?.textContent
    ?.trim() || "Basic";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="nr-card">
        <h3>${weaponName}</h3>
        <p><strong>Ammo:</strong> ${ammoType}</p>

        <div style="display:flex;gap:5px;">
          <button class="nr-hit"
                  data-weapon="${weaponName}"
                  data-ammo="${ammoType}">
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
    const weaponName = event.currentTarget.dataset.weapon;
    const ammoType = event.currentTarget.dataset.ammo;

    const macro = game.macros.getName(weaponName);

    if (!macro) {
      ui.notifications.warn(`Macro not found: ${weaponName}`);
      return;
    }

    // Pass the parameters to the macro directly
    await macro.execute({ weaponName: weaponName, ammoType: ammoType });

    event.currentTarget.disabled = true;

    const missButton = html.find(".nr-miss")[0];
    if (missButton) {
      missButton.disabled = true;
    }
  });

  html.find(".nr-miss").click(async (event) => {
    event.currentTarget.disabled = true;

    const hitButton = html.find(".nr-hit")[0];
    if (hitButton) {
      hitButton.disabled = true;
    }
  });
});
