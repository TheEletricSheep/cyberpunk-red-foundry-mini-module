const CUSTOM_ACTION = 'manageCyberdeckPrograms';

Hooks.once('ready', () => {
  const tah = game.tokenActionHud;
  if (!tah?.actionHandler || !tah?.rollHandler) return;

  // 1. Inject the "Manage Programs" button into each Cyberdeck group
  const originalBuild = tah.actionHandler.buildSystemActions.bind(tah.actionHandler);
  tah.actionHandler.buildSystemActions = async function (groupIds) {
    await originalBuild(groupIds);

    if (!this.actor || !['character', 'mook'].includes(this.actor.type)) return;

    const cyberdecks = this.actor.itemTypes.cyberdeck ?? [];
    for (const deck of cyberdecks) {
      const slots = deck.system.installedItems?.slots ?? 0;
      const used = deck.system.installedItems?.usedSlots ?? 0;

      this.addActions(
        [
          {
            id: `${CUSTOM_ACTION}-${deck.id}`,
            name: 'Manage Programs',
            encodedValue: [CUSTOM_ACTION, deck.id].join(this.delimiter),
            info1: { class: 'fas fa-microchip', text: ' ' },
            info2: { text: `${used} / ${slots}` },
            tooltip: `Install or uninstall programs on ${deck.name}`,
          },
        ],
        { id: deck.id, type: 'system' }
      );
    }
  };

  // 2. Intercept the click before TAH CPR's RollHandler processes it
  const originalHandle = tah.rollHandler.handleActionClick.bind(tah.rollHandler);
  tah.rollHandler.handleActionClick = async function (event, encodedValue) {
    const [actionType, deckId] = encodedValue.split(this.delimiter);

    if (actionType === CUSTOM_ACTION) {
      const deck = this.actor?.items.get(deckId);
      if (deck) await openProgramPicker(this.actor, deck);
      return;
    }

    return originalHandle(event, encodedValue);
  };
});

async function openProgramPicker(actor, deck) {
  const installedIds = new Set(deck.system.installedItems?.list ?? []);
  const allPrograms = actor.itemTypes.program.sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  if (allPrograms.length === 0) {
    ui.notifications.warn(`${actor.name} has no programs in their inventory.`);
    return;
  }

  const slots = deck.system.installedItems?.slots ?? 0;
  const used = deck.system.installedItems?.usedSlots ?? 0;

  const rows = allPrograms
    .map((prog) => {
      const isInstalledHere = installedIds.has(prog.id);
      const isInstalledElsewhere = prog.system.isInstalled && !isInstalledHere;
      const size = prog.system.size ?? 1;

      return `
        <label style="display:flex; align-items:center; gap:8px; padding:4px 0; ${isInstalledElsewhere ? 'opacity:0.5;' : ''}">
          <input
            type="checkbox"
            name="programId"
            value="${prog.id}"
            ${isInstalledHere ? 'checked' : ''}
            ${isInstalledElsewhere ? 'disabled' : ''}
          />
          <img src="${prog.img}" width="24" height="24" style="border:none;" />
          <span style="flex:1;">${prog.name}</span>
          <span style="font-size:0.85em; opacity:0.8;">${size} slot${size === 1 ? '' : 's'}</span>
        </label>
      `;
    })
    .join('');

  new Dialog({
    title: `${deck.name} — Programs (${used}/${slots} slots)`,
    content: `
      <form>
        <div style="max-height:320px; overflow-y:auto; margin-bottom:8px;">
          ${rows}
        </div>
      </form>
    `,
    buttons: {
      save: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Apply',
        callback: async (html) => {
          const selectedIds = new Set(
            html
              .find('input[name="programId"]:checked')
              .map((_, el) => el.value)
              .get()
          );

          const toInstall = allPrograms.filter(
            (p) => selectedIds.has(p.id) && !installedIds.has(p.id)
          );
          const toUninstall = allPrograms.filter(
            (p) => !selectedIds.has(p.id) && installedIds.has(p.id)
          );

          // Uninstall first so freed slots are available for newly installed programs
          if (toUninstall.length > 0) {
            await deck.uninstallItems(toUninstall);
          }
          if (toInstall.length > 0) {
            await deck.installItems(toInstall);
          }

          Hooks.callAll('forceUpdateTokenActionHud');
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Cancel',
      },
    },
    default: 'save',
  }).render(true);
}
