// ============================================
// Sanctum - Tech Rebuild / Power Rebuild (Standalone)
// Automatically detects installed "Tech Rebuild" and "Power Rebuild" upgrades
// Handles normal crits AND explosive ammo crits
// ============================================

console.log("%cSanctum Tech/Power Rebuild | Loading", "color: #ff6b00; font-weight: bold");

const FLAG_SCOPE = "world";
const LOG_PREFIX = "Sanctum Tech Power |";
const SOURCE_MAX_AGE_MS = 120000;
const CRIT_BASE = 5;
const CRIT_POWER = 10;

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
  const hit =
