Hooks.on("renderCPRCombatHUD", (app, html, data) => {
  const actor = app.actor;
  if (!actor) return;

  const root = html instanceof jQuery ? html[0] : html;
  if (!root) return;

  // 1. Inject a "PROGRAMS" button next to each Cyberdeck in WEAPONS & EQUIP STATE
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

  // 2. Also inject a "MANAGE PROGRAMS" button inside the NET panel for the equipped deck
  if (data.panels?.interface) {
    const equippedDeck = actor.itemTypes.cyberdeck.find(
      (d) => d.system.equipped === "equipped"
    );
    const firstIfaceBtn = root.querySelector('[data-action="interface-roll"]');
    const panelContainer =
      firstIfaceBtn?.closest('[class*="panel"]') || firstIfaceBtn?.parentElement;

    if (equippedDeck && panelContainer && !panelContainer.querySelector(".chud-net-prog-btn")) {
      const slots = equippedDeck.system.installedItems?.slots ?? 0;
      const used = equippedDeck.system.installedItems?.usedSlots ?? 0;

      const netBtn = document.createElement("button");
      netBtn.type = "button";
      netBtn.className = "chud-net-prog-btn";
      netBtn.textContent = `MANAGE PROGRAMS (${used}/${slots})`;
      Object.assign(netBtn.style, {
        display: "block",
        width: "100%",
        marginTop: "8px",
        padding: "5px 8px",
        fontSize: "11px",
        fontWeight: "700",
        letterSpacing: "0.05em",
        background: "#1a1d24",
        color: "#ff4757",
        border: "1px solid #d13443",
        borderRadius: "2px",
        cursor: "pointer",
      });

      netBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openProgramPicker(actor, equippedDeck, app);
      });

      panelContainer.appendChild(netBtn);
    }
  }
});

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
  // Account for non-program hardware/upgrades already occupying slots on the deck
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

  const dialog = new Dialog({
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

          // Uninstall first so freed slots are available for newly installed programs
          if (toUninstall.length > 0) {
            await deck.uninstallItems(toUninstall);
          }
          if (toInstall.length > 0) {
            await deck.installItems(toInstall);
          }

          hudApp?.refresh();
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
      },
    },
    default: "apply",
  });

  dialog.render(true);
}
