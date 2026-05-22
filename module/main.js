Hooks.once("ready", () => {
  console.log("Power Rebuild: Ready");
});

Hooks.on("createChatMessage", async (message) => {
  console.log("Power Rebuild: New chat message");

  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // ==========================================
  // CRITICAL DAMAGE DETECTION
  // ==========================================

  const critText =
    html.querySelector(".d6-data-div")?.textContent || "";

  const isCrit = critText.includes("Critical Damage");

  console.log("Power Rebuild: Crit check =", isCrit);

  if (!isCrit) return;

  console.log("Power Rebuild: CRIT DETECTED");
  console.log("Power Rebuild: Crit text =", critText);

  // ==========================================
  // GET ACTOR
  // ==========================================

  const actorId = message.speaker?.actor;

  console.log("Power Rebuild: Actor ID =", actorId);

  if (!actorId) {
    console.warn("Power Rebuild: No actor found.");
    return;
  }

  const actor = game.actors.get(actorId);

  console.log("Power Rebuild: Actor =", actor);

  if (!actor) {
    console.warn("Power Rebuild: Actor not found.");
    return;
  }

  // ==========================================
  // FIND WEAPON WITH "(POWER)" IN NAME
  // ==========================================

  const powerWeapon = actor.items.find(i =>
    i.type === "weapon" &&
    i.name?.toLowerCase().includes("(power)")
  );

  console.log(
    "Power Rebuild: Power Weapon =",
    powerWeapon
  );

  if (!powerWeapon) {
    console.log(
      "Power Rebuild: No weapon with '(Power)' found."
    );
    return;
  }

  console.log(
    `Power Rebuild triggered by ${powerWeapon.name}`
  );

  // ==========================================
  // EXECUTE MACRO
  // ==========================================

  const macro = game.macros.getName("Power Rebuild");

  console.log(
    "Power Rebuild: Macro =",
    macro
  );

  if (!macro) {
    ui.notifications.warn(
      "Power Rebuild macro not found."
    );
    return;
  }

  await macro.execute();

  ui.notifications.info(
    `${powerWeapon.name} triggered Power Rebuild`
  );
});
