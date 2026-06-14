Hooks.on("createChatMessage", async (message) => {

  const html = message.content;

  if (!html.includes("rollDamage")) return;

  const parser = document.createElement("div");
  parser.innerHTML = html;

  const weaponName =
    parser.querySelector(".text-center")
      ?.textContent
      ?.trim();

  if (!weaponName) return;

  const match = weaponName.match(/\(CHARGE\s*(\d+)\)/i);

  if (!match) return;

  const maxCharges = Number(match[1]);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="nr-card">
        <h3>${weaponName}</h3>

        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          ${Array.from({length:maxCharges}, (_,i) => `
            <button
              class="charge-roll"
              data-charges="${i+1}"
              data-weapon="${weaponName}">
              ${i+1} Charge${i ? "s" : ""}
            </button>
          `).join("")}
        </div>
      </div>
    `
  });

});

Hooks.on("renderChatMessage", (message, html) => {

  html.find(".charge-roll").click(async (event) => {

    const chargesUsed =
      Number(event.currentTarget.dataset.charges);

    const weaponName =
      event.currentTarget.dataset.weapon;

    const roll =
      await new Roll(`1d6 + ${chargesUsed}d6`)
        .evaluate({ async: true });

    await ui.chat.processMessage(
      `/red 0d6+${roll.total} # ${weaponName} (${chargesUsed} Charge${chargesUsed > 1 ? "s" : ""})`
    );

    html.find(".charge-roll").prop("disabled", true);

  });

});
