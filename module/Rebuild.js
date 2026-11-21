// ============================================
// Sanctum - Tech Rebuild / Power Rebuild / Bleedout / KNEEL! (Standalone)
// - "Tech Rebuild": "Charged" toggle (50% armor ignore)
// - "Power Rebuild" / "Bleedout": +5 crit damage (can be deactivated in weapon Settings)
// - "KNEEL!": "Kneel!" toggle for +5 crit damage (stacks with Power Rebuild / Bleedout -> +15)
// Handles normal crits AND explosive ammo crits
// ============================================

console.log("%cSanctum Tech/Power Rebuild | Loading", "color: #ff6b00; font-weight: bold");

const FLAG_SCOPE = "world";
const LOG_PREFIX = "Sanctum Tech Power |";
const SOURCE_MAX_AGE_MS = 120000;
const CRIT_BASE = 5;
const CRIT_STEP = 5;

// ---------------- Shared helpers ----------------

function logError(context, err, notify = false) {
  console.error(`${LOG_PREFIX} ${context}:`, err);
  if (notify) ui.notifications?.error(`Sanctum Tech Power: ${context} failed (see console).`);
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

function isMessageAuthor(message) {
  const id = message?.author?.id ?? message?.user?.id ?? message?._source?.author;
  return id === game.user.id;
}

function isDamageRollCard(content) {
  if (!content) return false;
  if (!content.includes('data-action="applyDamage"')) return false;
  if (/HP Reduced By/i.test(content) || /Damage Dealt To/i.test(content)) return false;
  return true;
}

function getDamageCardTitle(content) {
  if (!content) return "";
  const div = document.createElement("div");
  div.innerHTML = content;
  const el = div.querySelector(".chat-rollTitle-stat .text-center")
    ?? div.querySelector(".chat-rollTitle-stat > div");
  return (el?.textContent ?? "").trim();
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

// ---------------- Upgrade verification ----------------

function hasInstalledUpgrade(item, keyword) {
  if (!item || item.type !== "weapon" || !item.actor) return false;
  const upgradeIds = item.system?.installedItems?.list;
  if (!Array.isArray(upgradeIds) || !upgradeIds.length) return false;

  const target = keyword.toLowerCase();
  for (const id of upgradeIds) {
    const upg = item.actor.items.get(id);
    if (upg && upg.type === "itemUpgrade") {
      if ((upg.name || "").toLowerCase().includes(target)) return true;
    }
  }
  return false;
}

function isTechWeapon(item) {
  return hasInstalledUpgrade(item, "tech rebuild");
}

function hasBonusCritUpgrade(item) {
  return hasInstalledUpgrade(item, "power rebuild") || hasInstalledUpgrade(item, "bleedout");
}

function isPowerCritDisabled(item) {
  return !!item?.getFlag(FLAG_SCOPE, "powerCritDisabled");
}

function isPowerWeapon(item) {
  return hasBonusCritUpgrade(item) && !isPowerCritDisabled(item);
}

function hasKneel(item) {
  return hasInstalledUpgrade(item, "kneel");
}

function isKneelActive(item) {
  return hasKneel(item) && !!item?.getFlag(FLAG_SCOPE, "isKneel");
}

function getWeaponCritDamage(item) {
  if (!item) return CRIT_BASE;
  let total = CRIT_BASE;
  if (isPowerWeapon(item)) total += CRIT_STEP;
  if (isKneelActive(item)) total += CRIT_STEP;
  return total;
}

// ---------------- Item sheet: Bonus Crit toggle ----------------

function doInjectWeapon(html, item) {
  const el = getElement(html);
  if (!el || !item || item.type !== "weapon") return false;

  el.querySelectorAll(".power-crit-flag").forEach(n => n.remove());
  if (!hasBonusCritUpgrade(item)) return true;

  const items = Array.from(el.querySelectorAll("li.item"));
  const anchor = items.find(li => li.textContent.includes("Has Suppressive Fire"))
    ?? items.find(li => /ignore\s*armor/i.test(li.textContent))
    ?? items.find(li => li.querySelector(".setting-name"));
  if (!anchor) return false;

  const active = !isPowerCritDisabled(item);
  const li = document.createElement("li");
  li.className = "item flexrow power-crit-flag";
  const iconClass = active ? "far fa-circle-check" : "far fa-circle";
  li.innerHTML = `
    <div class="item flexrow setting-name text-nowrap">Bonus Crit (+5)</div>
    <div class="item flexrow setting-value text-nowrap item-end">
      <a class="item-checkbox" data-flag="powerCritDisabled" title="Toggle Power Rebuild / Bleedout +5 critical damage">
        <i class="${iconClass}"></i>
      </a>
    </div>`;

  li.querySelector("a.item-checkbox").addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    try {
      await item.setFlag(FLAG_SCOPE, "powerCritDisabled", !isPowerCritDisabled(item));
    } catch (err) {
      logError("toggle powerCritDisabled", err, true);
    }
  });

  anchor.insertAdjacentElement("afterend", li);
  return true;
}

function tryInjectWeapon(app, html) {
  const item = app.item ?? app.document;
  if (!item || item.type !== "weapon") return;
  if (doInjectWeapon(html, item)) return;
  setTimeout(() => doInjectWeapon(getElement(app.element) || getElement(html), item), 100);
}

// ---------------- Actor sheet: Charged & Kneel! toggles ----------------

async function applyChargedEffects(item, charged) {
  if (charged) {
    let prev = item.getFlag(FLAG_SCOPE, "chargedArmorPrev");
    if (!prev) {
      prev = {
        canIgnoreArmor: !!item.system?.canIgnoreArmor,
        ignoreArmorPercent: Number(item.system?.ignoreArmorPercent) || 0
      };
      await item.setFlag(FLAG_SCOPE, "chargedArmorPrev", prev);
    }
    const keepNative = prev.canIgnoreArmor && prev.ignoreArmorPercent >= 50;
    if (!keepNative) await item.update({ "system.canIgnoreArmor": true, "system.ignoreArmorPercent": 50 });
  } else {
    const prev = item.getFlag(FLAG_SCOPE, "chargedArmorPrev")
      ?? { canIgnoreArmor: false, ignoreArmorPercent: 0 };
    await item.update({
      "system.canIgnoreArmor": prev.canIgnoreArmor,
      "system.ignoreArmorPercent": prev.ignoreArmorPercent
    });
    await item.unsetFlag(FLAG_SCOPE, "chargedArmorPrev");
  }
}

async function setCharged(item, next) {
  try {
    await item.setFlag(FLAG_SCOPE, "isCharged", next);
    await applyChargedEffects(item, next);
  } catch (err) {
    logError("Charged toggle", err, true);
  }
}

async function setKneel(item, next) {
  try {
    await item.setFlag(FLAG_SCOPE, "isKneel", next);
  } catch (err) {
    logError("Kneel! toggle", err, true);
  }
}

function injectActorToggles(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor || !el.querySelector(".weapon-grid")) return;

  el.querySelectorAll(".weapon-grid li").forEach(li => {
    const txt = li.textContent.trim();
    if (txt.startsWith("Charged") || txt.startsWith("Kneel!")) li.remove();
  });

  for (const grid of el.querySelectorAll(".weapon-grid[data-item-id]")) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!item) continue;
    const list = grid.querySelector("ul");
    if (!list) continue;

    let added = false;

    if (isTechWeapon(item)) {
      const checked = !!item.getFlag(FLAG_SCOPE, "isCharged");
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="text-padding-sides-small">Charged</span>
        <a class="fire-checkbox" data-item-id="${item.id}">
          <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
        </a>`;
      li.querySelector("a").addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setCharged(item, !item.getFlag(FLAG_SCOPE, "isCharged"));
      });
      list.appendChild(li);
      added = true;

      const autofire = list.querySelector('a.fire-checkbox[data-fire-mode="autofire"]');
      if (autofire && !autofire.dataset.chargedListener) {
        autofire.dataset.chargedListener = "1";
        autofire.addEventListener("click", () => {
          if (item.getFlag(FLAG_SCOPE, "isCharged")) setCharged(item, false);
        });
      }
    }

    if (hasKneel(item)) {
      const checked = !!item.getFlag(FLAG_SCOPE, "isKneel");
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="text-padding-sides-small">Kneel!</span>
        <a class="fire-checkbox" data-item-id="${item.id}">
          <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
        </a>`;
      li.querySelector("a").addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setKneel(item, !item.getFlag(FLAG_SCOPE, "isKneel"));
      });
      list.appendChild(li);
      added = true;
    }

    if (added) {
      grid.style.height = "auto";
      grid.style.minHeight = "80px";
    }
  }
}

// ---------------- Damage source tracking ----------------

let lastDamageSource = null;

function recordDamageSource(ev) {
  const btn = ev.target?.closest?.('[data-action="rollDamage"]');
  if (!btn) return;
  const { actorId, tokenId, itemId } = btn.dataset;
  if (!itemId) return;
  lastDamageSource = { actorId, tokenId, itemId, time: Date.now() };
}

function bindDamageSourceCapture(message, html) {
  const el = getElement(html);
  if (!el || el.dataset.sanctumDmgSrc) return;
  if (!el.querySelector('[data-action="rollDamage"]')) return;
  el.dataset.sanctumDmgSrc = "1";
  el.addEventListener("click", recordDamageSource, true);
}

function identifyDamageWeapon(content, speaker, flags) {
  const title = getDamageCardTitle(content);

  const stamped = flags?.[FLAG_SCOPE]?.damageSource;
  if (stamped?.itemId) {
    const actor = resolveActor(stamped);
    const item = actor?.items.get(stamped.itemId);
    if (item) return { item, actor, via: "stamp" };
  }

  const src = lastDamageSource;
  if (src && Date.now() - src.time < SOURCE_MAX_AGE_MS) {
    const actor = resolveActor(src);
    const item = actor?.items.get(src.itemId);
    if (item && item.type === "weapon" && (!title || item.name.trim() === title)) {
      return { item, actor, via: "click" };
    }
  }

  const actor = resolveSpeakerActor(speaker);
  const matches = findWeaponsByTitle(actor, title);
  if (matches.length === 1) return { item: matches[0], actor, via: "title" };
  if (matches.length > 1) {
    const firstCrit = getWeaponCritDamage(matches[0]);
    const allSame = matches.every(i => getWeaponCritDamage(i) === firstCrit);
    return { item: allSame ? matches[0] : null, actor, via: "title-ambiguous" };
  }
  return null;
}

function hasBaseCrit(content) {
  return /Critical Damage:\s*\+?5\b/i.test(content) || /data-bonus-damage="5"/.test(content);
}

function rewriteCrit(content, totalCrit) {
  return content
    .replace(/Critical Damage:\s*\+?5\b/gi, `Critical Damage: +${totalCrit}`)
    .replace(/data-bonus-damage="5"/g, `data-bonus-damage="${totalCrit}"`);
}

function onPreCreateChatMessage(message, data) {
  try {
    const content = data.content ?? message.content ?? "";
    if (!isDamageRollCard(content)) return;

    const speaker = data.speaker ?? message.speaker ?? {};
    const found = identifyDamageWeapon(content, speaker, data.flags ?? message.flags);
    if (found?.via === "click") lastDamageSource = null;

    const update = {};
    if (found?.item) {
      const a = found.actor;
      update[`flags.${FLAG_SCOPE}.damageSource`] = {
        actorId: a?.isToken ? a.token?.actorId ?? a.id : a?.id,
        tokenId: a?.isToken ? a.token?.id : null,
        sceneId: a?.isToken ? a.token?.parent?.id : null,
        itemId: found.item.id
      };
    }

    const totalCrit = getWeaponCritDamage(found?.item);
    if (hasBaseCrit(content) && totalCrit > CRIT_BASE) {
      update.content = rewriteCrit(content, totalCrit);
      update[`flags.${FLAG_SCOPE}.critBonus`] = totalCrit;
    }
    if (Object.keys(update).length) message.updateSource(foundry.utils.expandObject(update));
  } catch (err) {
    logError("Bonus crit (preCreate)", err);
  }
}

async function upgradePowerCrit(message) {
  try {
    if (!isMessageAuthor(message)) return;
    if (message.getFlag(FLAG_SCOPE, "critBonus")) return;
    const content = message.content || "";
    if (!isDamageRollCard(content) || !hasBaseCrit(content)) return;

    const found = identifyDamageWeapon(content, message.speaker, message.flags);
    const totalCrit = getWeaponCritDamage(found?.item);
    if (totalCrit <= CRIT_BASE) return;

    await message.update({
      content: rewriteCrit(content, totalCrit),
      [`flags.${FLAG_SCOPE}.critBonus`]: totalCrit
    });
  } catch (err) {
    logError("Bonus crit (update)", err);
  }
}

function lastCritBonus() {
  for (const msg of game.messages.contents.slice().reverse()) {
    const c = msg.content || "";
    if (!/Critical Damage/i.test(c) && !/data-bonus-damage/.test(c)) continue;
    if (/HP Reduced By/i.test(c) || /Damage Dealt To/i.test(c)) continue;

    const flagged = Number(msg.getFlag(FLAG_SCOPE, "critBonus"));
    if (flagged > CRIT_BASE) return flagged;

    const m = c.match(/data-bonus-damage="(\d+)"/i) || c.match(/Critical Damage:\s*\+?(\d+)\b/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > CRIT_BASE) return val;
    }
    return CRIT_BASE;
  }
  return CRIT_BASE;
}

// ---------------- Registration (once) ----------------

const HOOKS = [
  ["renderItemSheet", (app, html) => tryInjectWeapon(app, html)],
  ["renderItemSheetV2", (app, html) => tryInjectWeapon(app, html)],
  ["renderActorSheet", (app, html) => injectActorToggles(app, html)],
  ["renderActorSheetV2", (app, html) => injectActorToggles(app, html)],
  ["updateItem", (item, changes, _options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "weapon" || !item.actor || !changes.system?.installedItems) return;
    if (item.getFlag(FLAG_SCOPE, "isCharged") && !isTechWeapon(item)) {
      setCharged(item, false);
    }
    if (item.getFlag(FLAG_SCOPE, "isKneel") && !hasKneel(item)) {
      setKneel(item, false);
    }
    if (isPowerCritDisabled(item) && !hasBonusCritUpgrade(item)) {
      item.unsetFlag(FLAG_SCOPE, "powerCritDisabled");
    }
  }],
  ["renderChatMessage", bindDamageSourceCapture],
  ["preCreateChatMessage", onPreCreateChatMessage],
  ["updateChatMessage", (message) => upgradePowerCrit(message)],
  ["createChatMessage", (message) => { if (isMessageAuthor(message)) setTimeout(() => upgradePowerCrit(message), 300); }]
];

function register() {
  const prev = globalThis._sanctumTechPowerHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumTechPowerHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  const ActorClass = CONFIG.Actor.documentClass;
  const proto = ActorClass?.prototype;
  if (proto?._applyDamage && !proto._applyDamage.__sanctumPower) {
    const orig = proto._applyDamage;
    globalThis._origApplyDamage ??= orig;
    const wrapped = async function (...args) {
      if (args[1] === CRIT_BASE) {
        const bonus = lastCritBonus();
        if (bonus > CRIT_BASE) args[1] = bonus;
      }
      return orig.apply(this, args);
    };
    wrapped.__sanctumPower = true;
    proto._applyDamage = wrapped;
  }

  console.log(`%c${LOG_PREFIX} Tech/Power/Bleedout/KNEEL! ready`, "color: #ff6b00; font-weight: bold");
}

if (globalThis.game?.ready) register();
else Hooks.once("ready", register);
