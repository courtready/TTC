let payRiseNurses = 0;
let payRiseTeachers = 0;
let nurseBudgetShare = 50; // % of $500M to nurses; remainder to teachers

let postcodeData = [];
let dataLoaded = false;

const TOTAL_BUDGET = 500000000; // $500M
const BASE_SALARY = 100000; // average fully loaded cost per worker

const SUPABASE_URL = "https://umouqdubdlqaofqukawa.supabase.co";
const SUPABASE_KEY = "sb_publishable_KrtpOdAseDSNshcJXTW6OQ_krHEXClV";
const SUPABASE_TABLE = "subscribers";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

function getNswPostcodeJsonUrl() {
  return /\/files\//.test(window.location.pathname || "")
    ? "../nsw-postcodes.json"
    : "nsw-postcodes.json";
}

async function loadPostcodes() {
  if (dataLoaded) return;
  var res = await fetch(getNswPostcodeJsonUrl());
  if (!res.ok) {
    throw new Error("Failed to load NSW postcodes");
  }
  postcodeData = await res.json();
  dataLoaded = true;
}

function cleanInput(input) {
  return (input || "").trim().toLowerCase();
}

function findLocation(input) {
  input = cleanInput(input);

  return postcodeData.find(function (item) {
    var suburb = item.suburb.toLowerCase();

    return (
      item.postcode === input ||
      suburb === input ||
      suburb.includes(input)
    );
  });
}

function formatSuburbLabel(suburb) {
  return suburb.replace(/\w+/g, function (w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

function setFundingExplanationText(
  fundedNurses,
  fundedTeachers,
  baselineNurses,
  baselineTeachers
) {
  var el = document.getElementById("fundingExplanation");
  if (!el) return;
  el.hidden = false;
  var n0 = payRiseNurses === 0;
  var t0 = payRiseTeachers === 0;
  var lineN;
  if (nurseBudgetShare === 0) {
    lineN = "No nurse allocation — move “Budget to nurses” above 0% to fund nurses.";
  } else if (n0) {
    lineN =
      "At 0% pay rise for nurses, your nurse share of a $500M budget could fund ~" +
      fundedNurses.toLocaleString("en-AU") +
      " nurses (full baseline for that share).";
  } else {
    lineN =
      "You chose a " +
      payRiseNurses +
      "% pay rise for nurses — this means funding ~" +
      fundedNurses.toLocaleString("en-AU") +
      " nurses instead of " +
      baselineNurses.toLocaleString("en-AU") +
      ".";
  }
  var lineT;
  if (nurseBudgetShare === 100) {
    lineT = "No teacher allocation — move “Budget to nurses” below 100% to fund teachers.";
  } else if (t0) {
    lineT =
      "At 0% pay rise for teachers, your teacher share of a $500M budget could fund ~" +
      fundedTeachers.toLocaleString("en-AU") +
      " teachers (full baseline for that share).";
  } else {
    lineT =
      "You chose a " +
      payRiseTeachers +
      "% pay rise for teachers — this means funding ~" +
      fundedTeachers.toLocaleString("en-AU") +
      " teachers instead of " +
      baselineTeachers.toLocaleString("en-AU") +
      ".";
  }
  el.innerHTML = lineN + "<br><br>" + lineT;
}

async function showImpact() {
  var inputEl = document.getElementById("locationInput");
  var resultEl = document.getElementById("impactResult");
  if (!resultEl) return;

  if (!dataLoaded) {
    try {
      await loadPostcodes();
    } catch (err) {
      resultEl.innerHTML =
        "Could not load NSW postcode data. Check your connection and refresh the page.";
      setFundingExplanationHidden();
      return;
    }
  }

  var raw = inputEl ? inputEl.value : "";
  var input = cleanInput(raw);
  if (!input) {
    resultEl.innerHTML = "Enter a postcode or suburb";
    setFundingExplanationHidden();
    return;
  }

  var loc = findLocation(raw);
  if (!loc) {
    resultEl.innerHTML =
      "<strong>Location not found</strong><br><br>" +
      "Try a NSW postcode (e.g. 2044) or suburb name (e.g. Newtown).";
    setFundingExplanationHidden();
    return;
  }

  var displayLine =
    "<strong>" +
    formatSuburbLabel(loc.suburb) +
    "</strong> <span style=\"opacity:0.85\">(" +
    loc.postcode +
    ")</span>";
  if (loc.electorate) {
    displayLine +=
      "<br><span style=\"font-size:0.92em;opacity:0.9\">Electorate: " +
      formatSuburbLabel(loc.electorate) +
      "</span>";
  }

  var budgetNurses = TOTAL_BUDGET * (nurseBudgetShare / 100);
  var budgetTeachers = TOTAL_BUDGET * ((100 - nurseBudgetShare) / 100);

  var costNurse = BASE_SALARY * (1 + payRiseNurses / 100);
  var costTeacher = BASE_SALARY * (1 + payRiseTeachers / 100);

  var fundedNurses = Math.floor(budgetNurses / costNurse);
  var fundedTeachers = Math.floor(budgetTeachers / costTeacher);

  var baselineNurses = Math.floor(budgetNurses / BASE_SALARY);
  var baselineTeachers = Math.floor(budgetTeachers / BASE_SALARY);

  var diffN = baselineNurses - fundedNurses;
  var diffT = baselineTeachers - fundedTeachers;

  var comparisonParts = [];
  if (payRiseNurses > 0 && diffN > 0) {
    comparisonParts.push(diffN.toLocaleString("en-AU") + " fewer nurses");
  }
  if (payRiseTeachers > 0 && diffT > 0) {
    comparisonParts.push(diffT.toLocaleString("en-AU") + " fewer teachers");
  }
  var comparisonLine =
    comparisonParts.length > 0
      ? `<br><br>Compared to 0% pay in each pool: ${comparisonParts.join("; ")}.`
      : "";

  let output = `${displayLine}<br><br>

✔ ${fundedNurses.toLocaleString("en-AU")} nurses<br>
${payRiseNurses > 0 ? `✔ ${payRiseNurses}% pay rise for all nurses<br>` : ""}
✔ ${fundedTeachers.toLocaleString("en-AU")} teachers<br>
${payRiseTeachers > 0 ? `✔ ${payRiseTeachers}% pay rise for all teachers<br>` : ""}<br>

<strong>You are allocating a fixed $500M budget.</strong><br>
${nurseBudgetShare}% of funds to nurses; ${100 - nurseBudgetShare}% to teachers. Increasing pay in either pool reduces headcount there.
${comparisonLine}

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

  setFundingExplanationText(
    fundedNurses,
    fundedTeachers,
    baselineNurses,
    baselineTeachers
  );
}

function setFundingExplanationHidden() {
  var el = document.getElementById("fundingExplanation");
  if (!el) return;
  el.textContent = "";
  el.hidden = true;
}

function updateSplit(value) {
  nurseBudgetShare = parseInt(value, 10);
  var el = document.getElementById("splitValue");
  if (el) el.innerText = value;
  void showImpact();
}

function updatePayNurses(value) {
  payRiseNurses = parseInt(value, 10);
  var el = document.getElementById("payValueNurses");
  if (el) el.innerText = value;
  void showImpact();
}

function updatePayTeachers(value) {
  payRiseTeachers = parseInt(value, 10);
  var el = document.getElementById("payValueTeachers");
  if (el) el.innerText = value;
  void showImpact();
}

function scrollToHashTarget() {
  var hash = location.hash;
  if (!hash || hash.length < 2) return;
  var id = decodeURIComponent(hash.slice(1));
  var el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "auto", block: "start" });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  requestAnimationFrame(scrollToHashTarget);
  window.addEventListener("load", scrollToHashTarget);
  window.addEventListener("hashchange", scrollToHashTarget);

  window.calculateImpact = function () {
    void showImpact();
  };

  loadPostcodes().catch(function (e) {
    console.error("NSW postcodes preload failed:", e);
  });

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

  var joinBtn = document.querySelector(".join-form button");
  if (joinBtn) {
    joinBtn.addEventListener("click", async function () {
      var email = document.getElementById("join-email");
      if (email && email.value) {
        var ok = await saveSignup(email.value, "join-section");
        if (ok) {
          email.value = "";
          alert("Thanks! We will be in touch.");
        }
      }
    });
  }

  window.handleSignup = async function (e) {
    e.preventDefault();
    var emailInput = document.getElementById("email");
    var ok = await saveSignup(emailInput ? emailInput.value : "", "footer-form");
    if (ok) {
      if (emailInput) emailInput.value = "";
      alert("Thanks — you're in.");
    }
  };

});

function supportPolicy() {
  var el = document.getElementById("join");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
