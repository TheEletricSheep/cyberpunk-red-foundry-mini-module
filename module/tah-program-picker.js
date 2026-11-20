let _cprModules = null;

async function getCprModules() {
  if (_cprModules) return _cprModules;
  const base = foundry.utils.getRoute("systems/cyberpunk-red-core/modules");
  const [{ default: CPRChat }, { default: CPRSystemUtils }, CPRRolls] =
    await Promise.all([
      import(`${base}/chat/cpr-chat.js`),
      import(`${base}/utils/cpr-systemUtils.js`),
      import(`${base}/rolls/cpr-rolls.js`),
    ]);
  _cprModules = { CPRChat, CPRSystemUtils, CPRRolls };
  return _cprModules;
}

Hooks.on("renderCPRCombatHUD", (app, html, data) => {
  const actor = app.actor;
  if (!actor) return;

  const root = html instanceof jQuery ? html[0] : html;
  if (!root) return;

  // 1. WEAPONS & EQUIP STATE: "PROGRAMS X/Y" button next to each Cyberdeck
  if (data.panels?.gear) {
    const equipButtons = root.querySelectorAll('[data-action="equip-cycle"][data-item-id]');
    for (const equipBtn of equipButtons) {
      const deck = actor.items.get(equipBtn.dataset.itemId);
      if (deck?.type !== "cyberdeck") continue;

      const slots = deck.system.installedItems?.slots ?? 0;
      const used = deck.system.installedItems?.usedSlots ?? 0;

      const progBtn = document.createElement("button");
      progBtn.type = "button";
      progBtn.className = "chud-prog-btn";
      progBtn.textContent = `PROGRAMS ${used}/${slots}`;
      progBtn.title = `Manage programs installed on ${deck.name}`;
      Object.assign(progBtn.style, {
        marginRight: "6px",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: "600",
        letterSpacing: "0.04em",
        background: "#14161c",
        color: "#e2e6ef",
        border: "1px solid #d13443",
        borderRadius: "2px",
        cursor: "pointer",
        flex: "0 0 auto",
        width: "auto",
        lineHeight: "1.4",
      });

      progBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openProgramPicker(actor, deck, app);
      });

      equipBtn.parentElement?.insertBefore(progBtn, equipBtn);
    }
  }

  // 2. NET PANEL: List installed programs and run them on click
  if (data.panels?.interface) {
    const equippedDeck = actor.itemTypes.cyberdeck.find(
      (d) => d.system.equipped === "equipped"
    );
    const firstIfaceBtn = root.querySelector('[data-action="interface-roll"]');
    const panelContainer =
      firstIfaceBtn?.closest('[class*="panel"]') || firstIfaceBtn?.parentElement;

    if (!equippedDeck || !panelContainer || panelContainer.querySelector(".chud-net-programs")) {
      return;
    }

    const installedIds = equippedDeck.system.installedItems?.list ?? [];
    const programs = actor.items
      .filter((i) => i.type === "program" && installedIds.includes(i.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    const wrapper = document.createElement("div");
    wrapper.className = "chud-net-programs";
    Object.assign(wrapper.style, {
      marginTop: "10px",
      paddingTop: "8px",
      borderTop: "1px solid #2c313d",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    });

    const header = document.createElement("div");
    header.textContent = `INSTALLED PROGRAMS (${programs.length})`;
    Object.assign(header.style, {
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      color: "#ff4757",
      marginBottom: "2px",
    });
    wrapper.appendChild(header);

    if (programs.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No programs installed";
      Object.assign(empty.style, {
        fontSize: "11px",
        opacity: "0.6",
        padding: "2px 0",
      });
      wrapper.appendChild(empty);
    } else {
      for (const prog of programs) {
        wrapper.appendChild(buildProgramRow(actor, equippedDeck, prog, app));
      }
    }

    panelContainer.appendChild(wrapper);
  }
});

function buildProgramRow(actor, deck, prog, hudApp) {
  const progClass = prog.system.class ?? "";
  const isAttacker =
    progClass === "antipersonnelattacker" || progClass === "antiprogramattacker";
  const isRezzed = !!prog.system.isRezzed;

  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  });

  const mainBtn = document.createElement("button");
  mainBtn.type = "button";
  mainBtn.title = isAttacker
    ? `Click to roll Attack with ${prog.name} (Right-click for sheet)`
    : `Click to ${isRezzed ? "Derez" : "Rez"} ${prog.name} (Right-click for sheet)`;

  Object.assign(mainBtn.style, {
    flex: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: "600",
    background: isRezzed ? "rgba(209, 52, 67, 0.22)" : "#14161c",
    color: "#eef1f7",
    border: `1px solid ${isRezzed ? "#ff4757" : "#2c313d"}`,
    borderRadius: "2px",
    cursor: "pointer",
    textAlign: "left",
    lineHeight: "1.3",
  });

  const left = document.createElement("span");
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "6px";
  left.innerHTML = `<img src="${prog.img}" width="16" height="16" style="border:none;" /><span>${prog.name}</span>`;

  const badge = document.createElement("span");
  Object.assign(badge.style, {
    fontSize: "9px",
    fontWeight: "700",
    letterSpacing: "0.05em",
    opacity: isRezzed ? "1" : "0.65",
    color: isRezzed ? "#ff4757" : "#a4b0be",
  });
  badge.textContent = isAttacker ? "ATK" : isRezzed ? "REZZED" : "REZ";

  mainBtn.appendChild(left);
  mainBtn.appendChild(badge);

  mainBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (isAttacker) {
      await rollProgram(ev, actor, deck, prog, "atk", hudApp);
    } else {
      await toggleProgramRez(actor, deck, prog, hudApp);
    }
  });

  mainBtn.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    prog.sheet.render(true);
  });

  row.appendChild(mainBtn);

  // Secondary action button: DMG for Attackers, DEF for Rezzed Boosters/Defenders
  if (isAttacker) {
    row.appendChild(
      makeMiniBtn("DMG", `Roll Damage for ${prog.name}`, (ev) =>
        rollProgram(ev, actor, deck, prog, "damage", hudApp)
      )
    );
  } else if (isRezzed && ["booster", "defender"].includes(progClass)) {
    row.appendChild(
      makeMiniBtn("DEF", `Roll Defense for ${prog.name}`, (ev) =>
        rollProgram(ev, actor, deck, prog, "def", hudApp)
      )
    );
  }

  return row;
}

function makeMiniBtn(label, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.title = title;
  Object.assign(btn.style, {
    flex: "0 0 auto",
    width: "auto",
    padding: "4px 7px",
    fontSize: "10px",
    fontWeight: "700",
    background: "#1a1d24",
    color: "#ff4757",
    border: "1px solid #d13443",
    borderRadius: "2px",
    cursor: "pointer",
    lineHeight: "1.3",
  });
  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    await onClick(ev);
  });
  return btn;
}

async function toggleProgramRez(actor, deck, prog, hudApp) {
  const token =
    hudApp?._tokenDoc?.object ??
    canvas?.tokens?.controlled?.find((t) => t.actor?.id === actor.id) ??
    null;

  if (prog.system.isRezzed) {
    await deck.derezProgram(prog);
  } else {
    await deck.rezProgram(prog, token);
  }
  hudApp?.refresh();
}

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
      programId: prog.id,
      executionType,
    });

    if (!cprRoll) {
      console.error("[CHUD Program Picker] createRoll returned empty", {
        rollType,
        availableRollTypes: CPRRolls.rollTypes,
        executionType,
        prog,
        deck,
        netRoleItem,
      });
      ui.notifications.warn(
        `Could not create ${executionType} roll for ${prog.name}. Check F12 console.`
      );
      return;
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

function openProgramPicker(actor, deck, hudApp) {
  const installedIds = new Set(deck.system.installedItems?.list ?? []);
  const allPrograms = [...actor.itemTypes.program].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  if (allPrograms.length === 0) {
    ui.notifications.warn(`${actor.name} has no programs in inventory.`);
    return;
  }

  const maxSlots = deck.system.installedItems?.slots ?? 0;
  const nonProgramUsedSlots = (deck.system.installedItems?.list ?? [])
    .map((id) => actor.items.get(id))
    .filter((item) => item && item.type !== "program")
    .reduce((sum, item) => sum + (Number(item.system.size) || 1), 0);

  const rows = allPrograms
    .map((prog) => {
      const isInstalledHere = installedIds.has(prog.id);
      const isInstalledElsewhere = prog.system.isInstalled && !isInstalledHere;
      const size = Number(prog.system.size) || 1;
      const progClass = prog.system.class ?? "";

      return `
        <label style="
          display:flex; align-items:center; gap:8px; padding:6px 8px;
          border:1px solid ${isInstalledHere ? "#d13443" : "#2c313d"};
          background:${isInstalledHere ? "rgba(209,52,67,0.12)" : "#14161c"};
          margin-bottom:4px; cursor:${isInstalledElsewhere ? "not-allowed" : "pointer"};
          opacity:${isInstalledElsewhere ? "0.45" : "1"};
        ">
          <input
            type="checkbox"
            name="programId"
            value="${prog.id}"
            data-size="${size}"
            ${isInstalledHere ? "checked" : ""}
            ${isInstalledElsewhere ? "disabled" : ""}
          />
          <img src="${prog.img}" width="24" height="24" style="border:none; flex:0 0 24px;" />
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; color:#eef1f7;">${prog.name}</div>
            <div style="font-size:11px; opacity:0.7; text-transform:uppercase;">
              ${progClass}${isInstalledElsewhere ? " • installed on another deck" : ""}
            </div>
          </div>
          <span style="font-size:11px; font-weight:700; opacity:0.85;">
            ${size} SLOT${size === 1 ? "" : "S"}
          </span>
        </label>
      `;
    })
    .join("");

  new Dialog({
    title: `${deck.name} — Installed Programs`,
    content: `
      <form style="color:#e2e6ef;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:4px 8px; background:#0f1116; border:1px solid #2c313d;">
          <span style="font-size:12px; font-weight:700; letter-spacing:0.05em;">SLOTS USED</span>
          <span class="chud-slot-counter" style="font-size:13px; font-weight:700;"></span>
        </div>
        <div style="max-height:340px; overflow-y:auto; padding-right:2px;">
          ${rows}
        </div>
      </form>
    `,
    render: (html) => {
      const updateSlotCounter = () => {
        let progSlots = 0;
        html.find('input[name="programId"]:checked').each((_, el) => {
          progSlots += Number(el.dataset.size) || 1;
        });
        const totalUsed = nonProgramUsedSlots + progSlots;
        const over = totalUsed > maxSlots;

        const counter = html.find(".chud-slot-counter");
        counter.text(`${totalUsed} / ${maxSlots}`);
        counter.css("color", over ? "#ff4757" : "#4cd137");

        html.closest(".app").find('button[data-button="apply"]').prop("disabled", over);
      };

      html.on("change", 'input[name="programId"]', updateSlotCounter);
      updateSlotCounter();
    },
    buttons: {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Apply",
        callback: async (html) => {
          const selectedIds = new Set(
            html
              .find('input[name="programId"]:checked')
              .map((_, el) => el.value)
              .get()
          );

          const toUninstall = allPrograms.filter(
            (p) => !selectedIds.has(p.id) && installedIds.has(p.id)
          );
          const toInstall = allPrograms.filter(
            (p) => selectedIds.has(p.id) && !installedIds.has(p.id)
          );

          if (toUninstall.length > 0) await deck.uninstallItems(toUninstall);
          if (toInstall.length > 0) await deck.installItems(toInstall);

          hudApp?.refresh();
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
      },
    },
    default: "apply",
  }).render(true);
}
