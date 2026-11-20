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
    color: isRezzed ? "#ff47
