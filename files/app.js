let payRiseNurses = 0;
let payRiseTeachers = 0;
let nurseBudgetShare = 50; // % of $500M to nurses; remainder to teachers
let lastImpactShareText = "";

let postcodeData = [];
let dataLoaded = false;
var siteAssetsBase = null;

const TOTAL_BUDGET = 500000000; // $500M
const BASE_SALARY = 100000; // average fully loaded cost per worker

const SUPABASE_URL = "https://umouqdubdlqaofqukawa.supabase.co";
const SUPABASE_KEY = "sb_publishable_KrtpOdAseDSNshcJXTW6OQ_krHEXClV";
const SUPABASE_TABLE = "members";
var supabaseClient = null;

var NSW_POSTCODE_CDN_URLS = [
  "https://cdn.jsdelivr.net/gh/courtready/TTC@main/nsw-postcodes.json",
  "https://raw.githubusercontent.com/courtready/TTC/main/nsw-postcodes.json"
];

function resolveSiteAssetsBase() {
  var scripts = document.getElementsByTagName("script");
  for (var i = scripts.length - 1; i >= 0; i--) {
    var full = scripts[i].src;
    if (!full) continue;
    var m = full.match(/^(.*\/)js\/app\.js(\?|#|$)/i);
    if (m) {
      return m[1];
    }
  }
  var p = window.location.pathname || "/";
  var dir = p.replace(/[^/]*$/, "");
  return window.location.origin + (dir || "/");
}

function getNswPostcodeFetchUrls() {
  if (window.location.protocol === "file:") {
    return [new URL("nsw-postcodes.json", window.location.href).href];
  }
  var base = siteAssetsBase || resolveSiteAssetsBase();
  var samePage = new URL("nsw-postcodes.json", window.location.href).href;
  var samePageParent = new URL("../nsw-postcodes.json", window.location.href).href;
  var filesRoot = window.location.origin + "/files/nsw-postcodes.json";
  var candidates = [
    base + "nsw-postcodes.json",
    base + "../nsw-postcodes.json",
    window.location.origin + "/nsw-postcodes.json",
    filesRoot,
    samePage,
    samePageParent
  ];
  for (var c = 0; c < NSW_POSTCODE_CDN_URLS.length; c++) {
    candidates.push(NSW_POSTCODE_CDN_URLS[c]);
  }
  var seen = {};
  return candidates.filter(function (u) {
    if (seen[u]) return false;
    seen[u] = true;
    return true;
  });
}

async function loadPostcodes() {
  if (dataLoaded) return;
  if (!siteAssetsBase) {
    siteAssetsBase = resolveSiteAssetsBase();
  }
  var urls = getNswPostcodeFetchUrls();
  var lastErr = null;
  for (var j = 0; j < urls.length; j++) {
    try {
      var res = await fetch(urls[j], { cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error("HTTP " + res.status + " for " + urls[j]);
        continue;
      }
      var raw = await res.text();
      var trimmed = raw.replace(/^\uFEFF/, "").trim();
      if (trimmed.charAt(0) === "<") {
        lastErr = new Error(
          "Got HTML instead of JSON (often a missing file or rewrite to index). URL: " +
            urls[j]
        );
        continue;
      }
      var data = JSON.parse(trimmed);
      if (!Array.isArray(data) || !data.length) {
        lastErr = new Error("Invalid postcode JSON");
        continue;
      }
      postcodeData = data;
      dataLoaded = true;
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Failed to load NSW postcodes");
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

function getElectorateShare(electorate) {
  if (!electorate || !postcodeData.length) return 0;
  var total = postcodeData.length;
  var inElectorate = 0;
  for (var i = 0; i < postcodeData.length; i++) {
    if (
      postcodeData[i].electorate &&
      cleanInput(postcodeData[i].electorate) === cleanInput(electorate)
    ) {
      inElectorate++;
    }
  }
  return total > 0 ? inElectorate / total : 0;
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
    resultEl.textContent = "Loading NSW postcode data…";
    try {
      await loadPostcodes();
    } catch (err) {
      console.error("Postcode load failed:", err);
      resultEl.innerHTML =
        "<strong>Could not load postcode data.</strong><br><br>" +
        "If you are the site owner, ensure <code>nsw-postcodes.json</code> is deployed next to the site and try a hard refresh (Ctrl+Shift+R).";
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

  var electorateShare = getElectorateShare(loc.electorate);
  var localBudget = TOTAL_BUDGET * electorateShare;
  var localBudgetNurses = localBudget * (nurseBudgetShare / 100);
  var localBudgetTeachers = localBudget * ((100 - nurseBudgetShare) / 100);
  var localFundedNurses = Math.floor(localBudgetNurses / costNurse);
  var localFundedTeachers = Math.floor(localBudgetTeachers / costTeacher);

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

  var shareParts = [
    `${formatSuburbLabel(loc.suburb)} (${loc.postcode})`,
    loc.electorate ? `Electorate: ${formatSuburbLabel(loc.electorate)}` : "",
    `NSW-wide: ${fundedNurses.toLocaleString("en-AU")} nurses, ${fundedTeachers.toLocaleString("en-AU")} teachers`,
    `Local estimate: ${localFundedNurses.toLocaleString("en-AU")} nurses, ${localFundedTeachers.toLocaleString("en-AU")} teachers`,
    `Budget split: ${nurseBudgetShare}% nurses / ${100 - nurseBudgetShare}% teachers`,
    `Pay rises: nurses ${payRiseNurses}%, teachers ${payRiseTeachers}%`
  ].filter(Boolean);
  lastImpactShareText = shareParts.join("\n");

  let output = `${displayLine}<br><br>

<strong>NSW-wide impact</strong><br>
✔ ${fundedNurses.toLocaleString("en-AU")} nurses<br>
${payRiseNurses > 0 ? `✔ ${payRiseNurses}% pay rise for all nurses<br>` : ""}
✔ ${fundedTeachers.toLocaleString("en-AU")} teachers<br>
${payRiseTeachers > 0 ? `✔ ${payRiseTeachers}% pay rise for all teachers<br>` : ""}<br>

<strong>Estimated local area impact (${formatSuburbLabel(loc.electorate || "your electorate")})</strong><br>
≈ ${localFundedNurses.toLocaleString("en-AU")} nurses<br>
≈ ${localFundedTeachers.toLocaleString("en-AU")} teachers<br><br>

<strong>You are allocating a fixed $500M budget.</strong><br>
${nurseBudgetShare}% of funds to nurses; ${100 - nurseBudgetShare}% to teachers. Increasing pay in either pool reduces headcount there.
${comparisonLine}

<div style="font-size:12px; opacity:0.7; margin-top:10px;">
  NSW totals use a fixed $500M model. Local estimate apportions that model by electorate share in the postcode dataset.
</div>`;

  const footer = `
<br><br>
Where is the money going instead?<br><br>
  <div style="margin-top:15px;">
    <button type="button" data-impact-action="support-policy" class="impact-action-btn impact-action-btn--primary">
      I want this for my area
    </button>
  </div>

  <div style="margin-top:10px;">
    <button type="button" data-impact-action="share-impact" class="impact-action-btn impact-action-btn--secondary">
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

window.calculateImpact = function () {
  void showImpact();
};
window.updateSplit = updateSplit;
window.updatePayNurses = updatePayNurses;
window.updatePayTeachers = updatePayTeachers;

function wireLocalImpactControls() {
  var showBtn = document.getElementById("impactShowBtn");
  if (showBtn) {
    showBtn.addEventListener("click", function () {
      void showImpact();
    });
  }
  var split = document.getElementById("splitSlider");
  if (split) {
    split.addEventListener("input", function () {
      updateSplit(this.value);
    });
  }
  var payN = document.getElementById("paySliderNurses");
  if (payN) {
    payN.addEventListener("input", function () {
      updatePayNurses(this.value);
    });
  }
  var payT = document.getElementById("paySliderTeachers");
  if (payT) {
    payT.addEventListener("input", function () {
      updatePayTeachers(this.value);
    });
  }
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

document.addEventListener("click", function (e) {
  var btn = e.target && e.target.closest
    ? e.target.closest("[data-impact-action]")
    : null;
  if (!btn) return;
  var action = btn.getAttribute("data-impact-action");
  if (action === "support-policy") {
    supportPolicy();
  } else if (action === "share-impact") {
    shareImpact();
  }
});

function initSupabaseIfAvailable() {
  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
  } catch (err) {
    console.warn("Supabase client init failed:", err);
  }
}

function onDomReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

onDomReady(function () {
  siteAssetsBase = resolveSiteAssetsBase();
  initSupabaseIfAvailable();

  requestAnimationFrame(scrollToHashTarget);
  window.addEventListener("load", scrollToHashTarget);
  window.addEventListener("hashchange", scrollToHashTarget);

  wireLocalImpactControls();

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
      .insert([
        {
          first_name: "",
          suburb: "",
          email: cleanEmail,
          source: source,
          joined_at: new Date().toISOString()
        }
      ]);

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
  const text = (lastImpactShareText || "").trim();
  const payloadText = text || "See your local impact result on Tax the Church.";
  const payload = `${payloadText}\n${window.location.href}`;
  const subject = "This is what Matt would like to see. From Matthew White | 247 365";
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(payload)}`;

  window.location.href = mailtoUrl;
}
