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

Hooks.on("createChatMessage", async (message) => {

if (!message?.content) return;

const html = document.createElement("div");
html.innerHTML = message.content;

//
// STORE SMART AMMO ATTACKS
//
const attackCard =
html.querySelector(".d10-rollcard-data");

const weaponName =
html.querySelector(
".chat-rollTitle-stat .text-center"
)?.textContent?.trim();

const ammoType =
html.querySelector(
".rollcard-subtitle-2-center"
)?.textContent?.trim()?.toLowerCase() ?? "";

if (
attackCard &&
weaponName &&
ammoType.includes("smart")
) {

const attackTotal =
  Number(
    html.querySelector(
      ".d10-number-div"
    )?.textContent?.trim()
  );

lastSmartAttack = {
  weaponName,
  attackTotal,
  triggered: false,
  timestamp: Date.now()
};

console.log(
  "Stored Smart Ammo attack:",
  lastSmartAttack
);

return;

}

//
// DETECT MISS CARD
//
const text =
html.textContent ?? "";

const missMatch =
text.match(/missed.*?by\s+(\d+)/i);

if (
missMatch &&
lastSmartAttack &&
!lastSmartAttack.triggered
) {

const missBy =
  Number(missMatch[1]);

console.log(
  "Smart Ammo miss detected:",
  missBy
);

if (missBy > 4) return;

lastSmartAttack.triggered = true;

const die =
  rollRedD10();

const total =
  die + 10;

const success =
  total >= missBy;

const margin =
  total - missBy;

const imageNumber =
  Math.min(
    10,
    Math.max(
      1,
      Math.abs(die)
    )
  );

await ChatMessage.create({

  content: `
<div class="cpr-block chat-rollTitle-stat">

  <div class="text-center text-padding-top text-normal text-semi">

    ${lastSmartAttack.weaponName}

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

        Smart Ammo Bonus +10

      </div>

    </div>

  </div>

</div>
${
  success
    ? `<span class="fg-green">HIT</span> by ${margin}!`
    : `<span class="fg-red">MISSED</span> by ${Math.abs(margin)}!`
}

`

});

console.log(
  "Smart Ammo correction roll:",
  total
);

}

});
