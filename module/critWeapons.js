console.log("%c Custom Crit | Loading...", "color: #e83e8c; font-weight: bold");

// ============================================================
// SHARED UTILITIES (Baked In)
// ============================================================

const FLAG_SCOPE = "world";

function logError(context, err, notify = false) {
  console.error(`Sanctum Custom Crit | ${context}:`, err);
  if (notify) ui.notifications?.error(`Sanctum Custom Crit: ${context} failed (see console).`);
}

function getElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  return null;
}

function normalizeName(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isDamageRollCard(content) {
  if (!content) return false;
  if (!content.includes('data-action="applyDamage"')) return false;
  // exclude the damage application result card and anything already applied
  if (/HP Reduced By/i.test(content) || /Damage Dealt To/i.test(content)) return false;
  return true;
}

function resolveActor({ actorId, tokenId, sceneId } = {}) {
  if (tokenId) {
    const tokActor = game.actors.tokens?.[tokenId]
      ?? canvas?.tokens?.get(tokenId)?.actor
      ?? (sceneId ? game.scenes.get(sceneId)?.tokens.get(tokenId)?.actor : null);
    if (tokActor) return tokActor;
  }
  return actorId ? game.actors.get(actorId) ?? null : null;
}

function resolveSpeakerActor(speaker = {}) {
  if (speaker.token) {
    const a = resolveActor({ actorId: speaker.actor, tokenId: speaker.token, sceneId: speaker.scene });
    if (a) return a;
  }
  const base = speaker.actor ? game.actors.get(speaker.actor) : null;
  if (base && base.prototypeToken?.actorLink) return base;
  const tokens = canvas?.tokens?.placeables ?? [];
  const pool = [...(canvas?.tokens?.controlled ?? []), ...tokens];
  const hit = pool.find(t => t.actor && !t.document.actorLink
    && (t.document.actorId === speaker.actor)
    && (!speaker.alias || t.actor.name === speaker.alias || t.name === speaker.alias));
  return hit?.actor ?? base ?? null;
}

function findWeaponsByTitle(actor, title) {
  const key = normalizeName(title);
  if (!actor || !key) return [];
  return actor.items.filter(i => i.type === "weapon" && normalizeName(i.name) === key);
}

// ============================================================
// 1. INJECT TOGGLE INTO WEAPON SHEET
// ============================================================

const CRIT_FLAG = "critOnFives";

function injectCritToggle(html, item) {
  const el = getElement(html);
  if (!el || !item || item.type !== "weapon") return false;
  
  // Prevent duplicate injections
  if (el.querySelector(".custom-crit-flag")) return true;
  
  // Find injection point
  const supLi = Array.from(el.querySelectorAll("li.item"))
    .find(li => li.textContent.includes("Has Suppressive Fire"));
  if (!supLi) return false;

  const checked = !!item.getFlag(FLAG_SCOPE, CRIT_FLAG);
  const iconClass = checked ? "far fa-circle-check" : "far fa-circle";
  
  const li = document.createElement("li");
  li.className = "item flexrow custom-crit-flag";
  li.innerHTML = `
    <div class="item flexrow setting-name text-nowrap">Crit on 5s (Melee/Custom)</div>
    <div class="item flexrow setting-value text-nowrap item-end">
      <a class="item-checkbox" data-flag="${CRIT_FLAG}"><i class="${iconClass}"></i></a>
    </div>`;
    
  li.querySelector("a.item-checkbox").addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    try {
      await item.setFlag(FLAG_SCOPE, CRIT_FLAG, !item.getFlag(FLAG_SCOPE, CRIT_FLAG));
    } catch (err) {
      logError(`toggle ${CRIT_FLAG}`, err, true);
    }
  });

  supLi.insertAdjacentElement("afterend", li);
  return true;
}

function tryInjectWeaponSheet(app, html) {
  const item = app.item ?? app.document;
  if (!item || item.type !== "weapon") return;
  if (injectCritToggle(html, item)) return;
  setTimeout(() => injectCritToggle(getElement(app.element) || getElement(html), item), 100);
}

// ============================================================
// 2. PROCESS DAMAGE CARDS
// ============================================================

// Tracks button clicks if the tech-power preCreate stamp isn't ready
let localDamageSource = null;
document.addEventListener("click", (ev) => {
  const btn = ev.target?.closest?.('[data-action="rollDamage"]');
  if (btn && btn.dataset.itemId) {
    localDamageSource = {
      itemId: btn.dataset.itemId,
      actorId: btn.dataset.actorId,
      tokenId: btn.dataset.tokenId,
      time: Date.now()
    };
  }
}, { capture: true });

function identifyDamageWeapon(message, content) {
  // 1. Try to read the stamp left by your tech-power script
  const stamped = message.getFlag(FLAG_SCOPE, "damageSource");
  if (stamped?.itemId) {
    const actor = resolveActor(stamped);
    const item = actor?.items.get(stamped.itemId);
    if (item) return { item, actor };
  }

  // 2. Fallback to local click tracking
  if (localDamageSource && Date.now() - localDamageSource.time < 2000) {
    const actor = resolveActor(localDamageSource);
    const item = actor?.items.get(localDamageSource.itemId);
    if (item) return { item, actor };
  }

  // 3. Fallback to title match
  const title = content.match(/chat-rollTitle-stat[\s\S]*?<div[^>]*>\s*([^<]+?)\s*<\/div>/i)?.[1]?.trim() || "";
  if (title) {
    const actor = resolveSpeakerActor(message.speaker);
    const matches = findWeaponsByTitle(actor, title);
    if (matches.length === 1) return { item: matches[0], actor };
  }

  return { item: null, actor: null };
}

function rewriteCardForCustomCrit(content, bonus) {
  let updated = content;
  const b = String(bonus);

  updated = updated.replace(
    /(<a[^>]*data-action="applyDamage"[^>]*)>/g,
    (full, openTag) => /data-bonus-damage="\d+"/.test(openTag)
      ? openTag.replace(/data-bonus-damage="\d+"/, `data-bonus-damage="${b}"`) + ">"
      : openTag + ` data-bonus-damage="${b}">`
  );

  updated = updated.replace(
    /(<div class="d6-data-div">\s*)/,
    `$1<div class="text-normal text-semi">
      Critical Damage:
      ${b}
    </div>\n`
  );

  updated = updated.replace(/icons\/dice\/black\/d6_6\.svg/g, "icons/dice/red/d6_6_preem.svg");
  updated = updated.replace(
    /<img([^>]*\bd6_5(?:_preem)?\.svg[^>]*)>/g,
    '<span style="display:inline-block;border:2px solid #ffd700;border-radius:4px;"><img$1></span>'
  );

  return updated;
}

Hooks.on("createChatMessage", async (message) => {
  try {
    const authorId = message.author?.id || message.user?.id;
    if (authorId !== game.user.id) return;

    const content = message.content || "";
    if (!isDamageRollCard(content)) return;
    if (/Critical Damage:/i.test(content)) return; // Don't double-process

    const { item, actor } = identifyDamageWeapon(message, content);
    if (!item || !item.getFlag(FLAG_SCOPE, CRIT_FLAG)) return;

    const dice = [...content.matchAll(/d6_(\d)(_preem)?\.svg/g)].map(m => Number(m[1]));
    if (!dice.length) return;

    const sixes = dice.filter(v => v === 6).length;
    const high = dice.filter(v => v === 5 || v === 6).length;

    // Normal crits (2+ sixes) are handled natively. We only intervene if 5s are what pushes it over.
    if (sixes >= 2 || high < 2) return;

    // Support integration with your Tech/Power module (+10 vs +5)
    const isPower = item.getFlag(FLAG_SCOPE, "isPowerWeapon");
    const bonus = isPower ? 10 : 5;
    
    const updated = rewriteCardForCustomCrit(content, bonus);
    const updateData = { content: updated };
    
    if (isPower) updateData[`flags.${FLAG_SCOPE}.powerCrit`] = true;
    
    await message.update(updateData);
    
    const el = document.querySelector(`li[data-message-id="${message.id}"]`);
    const div = el?.querySelector(".message-content");
    if (div) div.innerHTML = updated;

    console.log("%c[Custom Crit] 5s counted as 6s", "color: #e83e8c; font-weight: bold", {
      actor: actor.name,
      weapon: item.name,
      bonus
    });
  } catch (err) {
    logError("Custom Crit Hook", err);
  }
});

// ============================================================
// REGISTRATION
// ============================================================

Hooks.on("renderItemSheet", tryInjectWeaponSheet);
Hooks.on("renderItemSheetV2", tryInjectWeaponSheet);

console.log("Sanctum Custom Crit | Ready");
