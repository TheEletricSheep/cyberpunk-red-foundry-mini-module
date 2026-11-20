async function rollProgram(event, actor, deck, prog, executionType, hudApp) {
  try {
    const { CPRChat, CPRSystemUtils, CPRRolls } = await getCprModules();

    const netRoleItem =
      actor.itemTypes.role.find(
        (r) => r.id === actor.system.roleInfo?.activeNetRole
      ) ??
      actor.itemTypes.role.find((r) =>
        r.name.toLowerCase().includes("netrunner")
      ) ??
      actor.itemTypes.role[0];

    const rollType =
      CPRRolls.rollTypes.CYBERDECKPROGRAM ?? "cyberdeckProgram";

    let cprRoll = deck.createRoll(rollType, actor, {
      cyberdeck: deck,
      netRoleItem,
      program: prog,
      programId: prog.id,
      executionType,
    });

    if (!cprRoll) {
      ui.notifications.warn(
        `Could not create ${executionType} roll for ${prog.name}.`
      );
      return;
    }

    // Fallback if CPR left the damage formula blank (e.g. Black ICE-only attackers)
    if (executionType === "damage" && !cprRoll.formula) {
      const std = prog.system.damage?.standard?.trim();
      const bi = prog.system.damage?.blackIce?.trim();
      cprRoll.formula = std || bi || "";
      if (!cprRoll.formula) {
        ui.notifications.warn(`${prog.name} has no damage formula configured.`);
        return;
      }
    }

    const rollEvent = {
      type: "click",
      ctrlKey: event?.ctrlKey ?? false,
      metaKey: event?.metaKey ?? false,
    };

    const keepRolling = await cprRoll.handleRollDialog(rollEvent, actor, deck);
    if (!keepRolling) return;

    cprRoll = await deck.confirmRoll(cprRoll);
    if (!cprRoll) return;

    await cprRoll.roll();

    // Consume LUCK if spent in the roll dialog
    if (Number.isInteger(cprRoll.luck) && cprRoll.luck > 0) {
      const luckStat = actor.system.stats.luck.value;
      await actor.update({
        "system.stats.luck.value":
          luckStat - (cprRoll.luck > luckStat ? luckStat : cprRoll.luck),
      });
    }

    const targetedTokens = CPRSystemUtils.getUserTargetedOrSelected("targeted");
    cprRoll.entityData = {
      actor: actor.id,
      token: hudApp?._tokenDoc?.id ?? null,
      tokens: targetedTokens,
      item: deck.id,
    };

    CPRChat.RenderRollCard(cprRoll);
  } catch (err) {
    console.error("[CHUD Program Picker] Program roll failed:", err);
    ui.notifications.error(`Program roll failed: ${err.message}`);
  }
}
