let payRiseNurses = 0;
let payRiseTeachers = 0;
let nurseBudgetShare = 50; // % of $500M to nurses; remainder to teachers
let lastImpactShareText = "";

let postcodeData = [];
let dataLoaded = false;
var siteAssetsBase = null;

const TOTAL_BUDGET = 500000000;
const COST_PER_WORKER = 110000;
const MAX_WORKERS = Math.floor(TOTAL_BUDGET / COST_PER_WORKER);
const NSW_POPULATION = 8200000;
const TOTAL_NURSES = 180000;
const TOTAL_TEACHERS = 95000;
const POSTCODE_POP = {
  "2044": 42000,
  "2042": 45000,
  "2010": 25000,
  "2000": 30000,
  "2030": 35000,
  "2130": 65000,
  "2140": 70000,
  "2150": 75000,
  "2160": 80000,
  "2170": 85000
};
const REGION_DATA = {
  "Western Sydney": {
    population: 980000,
    hospitals: ["Westmead Hospital", "Blacktown Hospital", "Mount Druitt Hospital"],
    schools: "Public schools across Western Sydney"
  },
  "South Western Sydney": {
    population: 1050000,
    hospitals: ["Liverpool Hospital", "Campbelltown Hospital", "Bankstown Hospital"],
    schools: "Public schools across South Western Sydney"
  },
  "Sydney": {
    population: 700000,
    hospitals: ["Royal Prince Alfred Hospital", "Concord Hospital"],
    schools: "Public schools across Inner Sydney"
  },
  "South Eastern Sydney": {
    population: 950000,
    hospitals: ["St George Hospital", "Sutherland Hospital", "Prince of Wales Hospital"],
    schools: "Public schools across South Eastern Sydney"
  },
  "Northern Sydney": {
    population: 980000,
    hospitals: ["Royal North Shore Hospital", "Hornsby Hospital", "Northern Beaches Hospital"],
    schools: "Public schools across Northern Sydney"
  }
};

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
  const input = document.getElementById('locationInput').value.trim().toLowerCase();
  const resultEl = document.getElementById('result') || document.getElementById('impactResult');
  if (!resultEl) return;

  if (!postcodeData.length) {
    resultEl.innerHTML = "<p>Loading data...</p>";
    try {
      await loadPostcodes();
    } catch (err) {
      resultEl.innerHTML = "<p>Could not load postcode data. Please refresh and try again.</p>";
      return;
    }
  }
  if (!resultEl) return;

  if (!postcodeData.length) {
    try {
      await loadPostcodes();
    } catch (e) {
      resultEl.innerHTML = "<p>Could not load postcode data.</p>";
      return;
    }
  }

  const match = postcodeData.find(item =>
    item.postcode === input ||
    item.suburb.toLowerCase() === input ||
    item.suburb.toLowerCase().includes(input)
  );

  if (!match) {
    resultEl.innerHTML = "<p>Location not found.</p>";
    return;
  }

  // --- USER SETTINGS ---
  const nurseBudgetPercent = parseInt(
    document.getElementById('nurseBudget')?.value ||
    document.getElementById('splitSlider')?.value ||
    50
  , 10);
  const nurseSplit = nurseBudgetPercent;
  const teacherBudgetPercent = 100 - nurseBudgetPercent;
  const teacherSplit = teacherBudgetPercent;

  // --- SPLIT ---
  const nurseBudget = TOTAL_BUDGET * (nurseBudgetPercent / 100);
  const teacherBudget = TOTAL_BUDGET * (teacherBudgetPercent / 100);

  const nursePayRiseInput = parseInt(
    document.getElementById('nurseRise')?.value ||
    document.getElementById('paySliderNurses')?.value ||
    0
  , 10) || 0;
  const teacherPayRiseInput = parseInt(
    document.getElementById('teacherRise')?.value ||
    document.getElementById('paySliderTeachers')?.value ||
    0
  , 10) || 0;

  // =========================
  // PAY COSTS (reduce hiring budget first)
  // =========================
  let nursePayCost = (nursePayRiseInput / 100) * TOTAL_NURSES * COST_PER_WORKER;
  let teacherPayCost = (teacherPayRiseInput / 100) * TOTAL_TEACHERS * COST_PER_WORKER;
  nursePayCost = Math.min(nursePayCost, nurseBudget);
  teacherPayCost = Math.min(teacherPayCost, teacherBudget);

  const nurseRemaining = nurseBudget - nursePayCost;
  const teacherRemaining = teacherBudget - teacherPayCost;

  // =========================
  // JOBS CREATED (capped to MAX_WORKERS)
  // =========================
  let newNurses = Math.floor(nurseRemaining / COST_PER_WORKER);
  let newTeachers = Math.floor(teacherRemaining / COST_PER_WORKER);
  const totalWorkers = newNurses + newTeachers;
  if (totalWorkers > MAX_WORKERS) {
    const scale = MAX_WORKERS / totalWorkers;
    newNurses = Math.floor(newNurses * scale);
    newTeachers = Math.floor(newTeachers * scale);
  }

  // =========================
  // PAY RISE OUTPUT
  // =========================
  const nursePayRise = nursePayRiseInput.toFixed(1);
  const teacherPayRise = teacherPayRiseInput.toFixed(1);

  // =========================
  // LOCAL SHARE (postcode population based)
  // =========================
  const postcode = String(match.postcode || "");
  const areaPop = POSTCODE_POP[postcode];
  const areaShare = areaPop ? (areaPop / NSW_POPULATION) : 0;
  const localNurses = Math.floor(newNurses * areaShare);
  const localTeachers = Math.floor(newTeachers * areaShare);
  const nursePerPeople = localNurses > 0 ? Math.floor(areaPop / localNurses) : 0;
  const teacherPerPeople = localTeachers > 0 ? Math.floor(areaPop / localTeachers) : 0;
  const perPeopleHtml = areaPop
    ? (
      (localNurses > 0 ? `➡️ 1 nurse per ${nursePerPeople.toLocaleString()} people<br>` : "") +
      (localTeachers > 0 ? `➡️ 1 teacher per ${teacherPerPeople.toLocaleString()} people` : "")
    )
    : "⚠️ Postcode population not in dataset yet";

  // =========================
  // OUTPUT (NO STYLE CHANGES)
  // =========================
  resultEl.innerHTML = `
    <h3>${match.suburb} (${match.postcode})</h3>

    <p>
      ✔ ${localNurses} nurses funded<br>
      ✔ ${localTeachers} teachers funded
    </p>

    <p>AND</p>

    <p>
      ✔ ${nursePayRise}% pay rise for nurses<br>
      ✔ ${teacherPayRise}% pay rise for teachers
    </p>

    <p>
      Based on a $500M annual funding model distributed proportionally.
    </p>

    <p>
      ${perPeopleHtml}
    </p>
  `;

  // Region output: real hospitals + school system impact.
  var regionSelectEl = document.getElementById("regionSelect");
  var regionOutputEl = document.getElementById("region-output");
  if (regionSelectEl && regionOutputEl) {
    var region = regionSelectEl.value;
    var data = REGION_DATA[region];
    if (data) {
      var regionPop = data.population;
      var regionShare = regionPop / NSW_POPULATION;
      var regionTotalWorkers = Math.floor(MAX_WORKERS * regionShare);

      var nurseRatio = nurseSplit / 100;
      var teacherRatio = teacherSplit / 100;

      var regionNurses = Math.floor(regionTotalWorkers * nurseRatio);
      var regionTeachers = Math.floor(regionTotalWorkers * teacherRatio);

      var regionNursePerPeople = regionNurses > 0 ? Math.floor(regionPop / regionNurses) : 0;
      var regionTeacherPerPeople = regionTeachers > 0 ? Math.floor(regionPop / regionTeachers) : 0;

      var hospitalList = data.hospitals.join(", ");

      regionOutputEl.innerHTML = `
  🏥 <strong>${region}</strong><br><br>

  <strong>Hospitals:</strong><br>
  ${hospitalList}
  <br><br>

  👩‍⚕️ ${regionNurses.toLocaleString()} nurses funded
  <br>
  ${regionNurses > 0 ? `➡️ 1 nurse per ${regionNursePerPeople.toLocaleString()} people<br>` : ``}

  <br>

  🏫 <strong>Schools:</strong><br>
  ${data.schools}
  <br><br>

  👩‍🏫 ${regionTeachers.toLocaleString()} teachers funded
  <br>
  ${regionTeachers > 0 ? `➡️ 1 teacher per ${regionTeacherPerPeople.toLocaleString()} people` : ``}

  <br><br>

  <span style="font-size:14px; opacity:0.7;">
    Based on a $500M model distributed across NSW regions
  </span>
`;
    } else {
      regionOutputEl.innerHTML = "";
    }
  }
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
  void showImpact().catch(function () {
    var resultEl = document.getElementById('result') || document.getElementById('impactResult');
    if (resultEl) {
      resultEl.innerHTML = "<p>Something went wrong. Please refresh and try again.</p>";
    }
  });
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
  var regionSelect = document.getElementById("regionSelect");
  if (regionSelect) {
    regionSelect.addEventListener("change", function () {
      void showImpact();
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
