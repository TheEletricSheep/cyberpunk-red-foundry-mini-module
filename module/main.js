// ==================================================
// FIND WEAPON WITH "(POWER)" IN NAME
// ==================================================

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
