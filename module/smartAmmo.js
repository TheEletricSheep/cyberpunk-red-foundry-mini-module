console.log("=== smartAmmo.js loaded ===");

let lastSmartAttack = null;

function rollRedD10() {
  const first = Math.ceil(Math.random() * 10);
  if (first === 10) {
    const second = Math.ceil(Math.random() * 10);
    return 10 + second;
  }
  if (first === 1) {
    const second = Math.ceil(Math.random() * 10);
    return 1 - second;
  }
  return first;
}

// 1. Extracted the roll logic into a reusable function
async function doSmartAmmoCorrection(weaponName) {
  const die = rollRedD10();
  const total = die + 14;
  const imageNumber = Math.min(10, Math.max(1, Math.abs(die)));

  await ChatMessage.create({
    content: `
<div class="cpr-block chat-rollTitle-stat">
  <div class="text-center text-padding-top text-normal text-semi">
    ${weaponName}
  </div>
  <div class="rollcard-subtitle">
    <div class="rollcard-subtitle-center text-small">
      Smart Ammo Correction
    </div>
  </div>
</div>
<div class="cpr-block">
  <div class="d10-rollcard-data">
    <div class="d10-dice-div">
      <img
        class="d10"
        src="systems/cyberpunk-red-core/icons/dice/red/d10_${imageNumber}.svg"
      />
    </div>
    <div class="d10-number-div">
      <span class="text-semi">
        ${total}
      </span>
    </div>
    <div class="d10-data-div">
      <div class="text-normal text-semi">
        Smart Ammo Bonus +14
      </div>
    </div>
  </div>
</div>
`
  });

  console.log("Smart Ammo correction roll:", total);
}

Hooks.on("createChatMessage", async (message) => {
  if (!message?.content) return;

  const html = document.createElement("div");
  html.innerHTML = message.content;

  // STORE SMART AMMO ATTACKS
  const attackCard = html.querySelector(".d10-rollcard-data");
  const weaponName = html.querySelector(".chat-rollTitle-stat .text-center")?.textContent?.trim();
  const ammoType = html.querySelector(".rollcard-subtitle-2-center")?.textContent?.trim()?.toLowerCase() ?? "";

  if (attackCard && weaponName && ammoType.includes("smart")) {
    const attackTotal = Number(html.querySelector(".d10-number-div")?.textContent?.trim());

    lastSmartAttack = {
      weaponName,
      attackTotal,
      triggered: false,
      timestamp: Date.now()
    };

    console.log("Stored Smart Ammo attack:", lastSmartAttack);
    return;
  }

  // DETECT MISS CARD (Auto-trigger)
  const text = html.textContent ?? "";
  const missMatch = text.match(/missed.*?by\s+(\d+)/i);

  if (missMatch && lastSmartAttack && !lastSmartAttack.triggered) {
    const missBy = Number(missMatch[1]);
    console.log("Smart Ammo miss detected:", missBy);

    // Smart Ammo only triggers on misses by 4 or less
    if (missBy > 5) return;

    lastSmartAttack.triggered = true;
    await doSmartAmmoCorrection(lastSmartAttack.weaponName);
  }
});

// 2. Add a manual button to the chat card when it renders
Hooks.on("renderChatMessage", (message, html, data) => {
  // Only show the button to the person who fired the weapon (or the GM)
  if (!message.isAuthor && !game.user.isGM) return;

  const weaponName = html.find(".chat-rollTitle-stat .text-center").text().trim();
  const ammoType = html.find(".rollcard-subtitle-2-center").text().trim().toLowerCase();

  // If this message is a Smart Ammo attack, inject a button at the bottom
  if (weaponName && ammoType.includes("smart")) {
    const btnHtml = $(`
      <button class="smart-ammo-manual-btn" style="margin-top: 5px; cursor: pointer;">
        <i class="fas fa-crosshairs"></i> Force Smart Ammo Reroll
      </button>
    `);

    btnHtml.on("click", async (e) => {
      e.preventDefault();
      
      // Prevent double-firing if the auto-trigger somehow catches it later
      if (lastSmartAttack && lastSmartAttack.weaponName === weaponName) {
        lastSmartAttack.triggered = true;
      }

      console.log("Manual Smart Ammo correction triggered for:", weaponName);
      await doSmartAmmoCorrection(weaponName);
    });

    // Append the button to the bottom of the chat card block
    html.find(".cpr-block").last().after(btnHtml);
  }
});
