console.log("=== powerRebuild.js loaded ===");

Hooks.once("ready", () => {
  console.log("Power Rebuild: Ready");
});

Hooks.on("createChatMessage", async (message) => {

  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  const critText =
    html.querySelector(".d6-data-div")?.textContent || "";

  const isCrit =
    critText.includes("Critical Damage");

  if (!isCrit) return;

  const weaponName = html.querySelector(
    ".chat-rollTitle-stat .text-center"
  )?.textContent?.trim();

  if (!weaponName) return;

  if (!weaponName.toLowerCase().includes("(power)")) {
    return;
  }

  const targets = Array.from(game.user.targets);

  if (targets.length !== 1) {
    ui.notifications.warn(
      "Target exactly one token."
    );
    return;
  }

  const actor = targets[0].actor;

  const currentHp =
    actor.system.derivedStats.hp.value;

  await actor.update({
    "system.derivedStats.hp.value":
      Math.max(0, currentHp - 5)
  });

  await ChatMessage.create({
    content: `
      ${actor.name} suffers
      <b>5 additional direct damage</b>
      from Power Rebuild.
    `
  });

  ui.notifications.info(
    `${weaponName} triggered Power Rebuild`
  );

});
