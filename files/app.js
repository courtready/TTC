let currentMode = "nurses";
let payRise = 0;

const TOTAL_BUDGET = 500000000; // $500M
const BASE_SALARY = 100000; // average fully loaded cost per worker

const SUPABASE_URL = "https://umouqdubdlqaofqukawa.supabase.co";
const SUPABASE_KEY = "sb_publishable_KrtpOdAseDSNshcJXTW6OQ_krHEXClV";
const SUPABASE_TABLE = "subscribers";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

function setFundingExplanation(visible, opts) {
  var el = document.getElementById("fundingExplanation");
  if (!el) return;
  if (!visible || !opts) {
    el.textContent = "";
    el.hidden = true;
    return;
  }
  var payRiseVal = opts.payRise;
  var base = opts.base;
  var adjusted = opts.adjusted;
  var role = opts.role;
  el.hidden = false;
  var baseStr = base.toLocaleString("en-AU");
  var adjStr = adjusted.toLocaleString("en-AU");
  if (payRiseVal === 0) {
    el.textContent =
      "At 0% pay rise, a $500M budget could fund ~" + adjStr + " " + role + " (full baseline).";
  } else {
    el.textContent =
      "You chose a " +
      payRiseVal +
      "% pay rise — this means funding ~" +
      adjStr +
      " " +
      role +
      " instead of " +
      baseStr +
      ".";
  }
}

function showImpact() {
  var inputEl = document.getElementById("locationInput");
  var resultEl = document.getElementById("impactResult");
  if (!resultEl) return;
  var input = inputEl ? inputEl.value.trim().toLowerCase() : "";
  if (!input) {
    resultEl.innerHTML = "Enter a postcode or suburb";
    setFundingExplanation(false);
    return;
  }
  var map = {
    "2000": "Sydney", "2010": "Sydney", "2020": "Heffron", "2031": "Coogee",
    "2034": "Coogee", "2040": "Summer Hill", "2041": "Balmain", "2042": "Newtown",
    "newtown": "Newtown", "2044": "Summer Hill", "summer hill": "Summer Hill",
    "2050": "Balmain", "2060": "North Shore", "2065": "Lane Cove",
    "2070": "Willoughby", "2088": "Manly", "2095": "Manly",
    "2130": "Strathfield", "2140": "Auburn", "2145": "Seven Hills",
    "2150": "Parramatta", "parramatta": "Parramatta", "2155": "Kellyville",
    "2160": "Fairfield", "2170": "Liverpool", "2200": "Bankstown",
    "2204": "Canterbury", "2217": "Kogarah", "2220": "Miranda", "2229": "Cronulla"
  };
  var electorate = map[input];
  if (!electorate) {
    resultEl.innerHTML =
      "<strong>" + input + "</strong><br><br>" +
      "Across NSW:<br>" +
      "\u2248 150 nurses per electorate<br>" +
      "\u2248 130 teachers per electorate<br><br>" +
      "<em>Electorate data expanding.</em>";
    setFundingExplanation(false);
    return;
  }
  var data = { suburb: electorate };

  const adjustedSalary = BASE_SALARY * (1 + payRise / 100);
  const fundedWorkers = Math.floor(TOTAL_BUDGET / adjustedSalary);
  const baselineWorkers = Math.floor(TOTAL_BUDGET / BASE_SALARY);
  const difference = baselineWorkers - fundedWorkers;
  const roleLabel = currentMode === "nurses" ? "nurses" : "teachers";

  let output = `<strong>${data.suburb || input}</strong><br><br>

✔ ${fundedWorkers.toLocaleString("en-AU")} ${roleLabel}<br>
${payRise > 0 ? `✔ ${payRise}% pay rise for all ${roleLabel}<br>` : ""}<br>

<strong>You are allocating a fixed $500M budget.</strong><br>
Increasing pay reduces total staff — this is the real trade-off.
${payRise > 0 ? `<br><br>
  That's ${difference.toLocaleString("en-AU")} fewer ${roleLabel} compared to no pay rise.` : ""}

<div style="font-size:12px; opacity:0.7; margin-top:10px;">
  Based on ~$100k average cost per worker (salary + super + overhead).
</div>`;

  const footer = `
<br><br>
Where is the money going instead?<br><br>
  <div style="margin-top:15px;">
    <button onclick="supportPolicy()" style="padding:12px 18px; background:#ffd700; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
      I want this for my area
    </button>
  </div>

  <div style="margin-top:10px;">
    <button onclick="shareImpact()" style="padding:10px 14px; border-radius:6px; cursor:pointer;">
      Share this result
    </button>
  </div>
`;

  resultEl.innerHTML = output + footer;

  setFundingExplanation(true, {
    payRise: payRise,
    base: baselineWorkers,
    adjusted: fundedWorkers,
    role: roleLabel
  });
}

function setMode(mode) {
  currentMode = mode;

  document.getElementById("btnNurses").style.opacity = mode === "nurses" ? "1" : "0.5";
  document.getElementById("btnTeachers").style.opacity = mode === "teachers" ? "1" : "0.5";

  showImpact();
}

function updatePay(value) {
  payRise = parseInt(value, 10);
  document.getElementById("payValue").innerText = value;
  showImpact();
}

document.addEventListener('DOMContentLoaded', function () {

  window.calculateImpact = showImpact;

  var bn = document.getElementById("btnNurses");
  var bt = document.getElementById("btnTeachers");
  if (bn && bt) {
    bn.style.opacity = "1";
    bt.style.opacity = "0.5";
  }

  async function saveSignup(email, source) {
    if (!supabaseClient) {
      alert("Signup is temporarily unavailable.");
      return false;
    }

    var cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      alert("Please enter a valid email.");
      return false;
    }

    var response = await supabaseClient
      .from(SUPABASE_TABLE)
      .insert([{ email: cleanEmail, source: source }]);

    if (response.error) {
      alert("Could not save your signup right now. Please try again.");
      return false;
    }

    return true;
  }

  var joinBtn = document.querySelector('.join-form button');
  if (joinBtn) {
    joinBtn.addEventListener('click', async function() {
      var email = document.getElementById('join-email');
      if (email && email.value) {
        var ok = await saveSignup(email.value, "join-section");
        if (ok) {
          email.value = "";
          alert("Thanks! We will be in touch.");
        }
      }
    });
  }

  window.handleSignup = async function(e) {
    e.preventDefault();
    var emailInput = document.getElementById('email');
    var ok = await saveSignup(emailInput ? emailInput.value : "", "footer-form");
    if (ok) {
      if (emailInput) emailInput.value = "";
      alert("Thanks — you're in.");
    }
  };

});

function supportPolicy() {
  window.location.href = "/member.html";
}

function shareImpact() {
  const text = document.getElementById("impactResult").innerText;

  if (navigator.share) {
    navigator.share({
      title: "Local Impact",
      text: text,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(text);
    alert("Result copied to clipboard");
  }
}
