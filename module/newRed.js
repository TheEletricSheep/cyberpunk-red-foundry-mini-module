Hooks.on("chatMessage", async (chatLog, message, chatData) => {

  const match = message.match(/^\/newred\s+(.+)$/i);

  if (!match) return;

  const formula = match[1];

  try {

    const roll1 = await new Roll(formula).evaluate();
    const roll2 = await new Roll(formula).evaluate();

    const keptRoll =
      roll1.total >= roll2.total ? roll1 : roll2;

    const html = `
      <div class="dice-roll">
        <h2>New RED Damage</h2>

        <p>
          <strong>Roll 1:</strong> ${roll1.total}
        </p>

        <p>
          <strong>Roll 2:</strong> ${roll2.total}
        </p>

        <hr>

        <p>
          <strong>Kept Highest:</strong>
          ${keptRoll.total}
        </p>
      </div>
    `;

    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker(),
      content: html
    });

  } catch (err) {

    ui.notifications.error(
      `Invalid formula: ${formula}`
    );

    console.error(err);
  }

  return false;
});
