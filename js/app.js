let payRiseNurses = 0;
let payRiseTeachers = 0;
let nurseBudgetShare = 50; // % of $500M to nurses; remainder to teachers
let lastImpactShareText = "";

let postcodeData = [];
let dataLoaded = false;
let postcodeToLHD = {};
let lhdPopulation = {};
let regionDataLoaded = false;
var siteAssetsBase = null;

const TOTAL_BUDGET = 500000000;
const COST_PER_WORKER = 110000;
const MAX_WORKERS = Math.floor(TOTAL_BUDGET / COST_PER_WORKER);
const NSW_POPULATION = 8200000;
const TOTAL_NURSES = 180000;
const TOTAL_TEACHERS = 95000;
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

function getDataFetchUrls(filename) {
  if (window.location.protocol === "file:") {
    return [new URL(filename, window.location.href).href];
  }
  var base = siteAssetsBase || resolveSiteAssetsBase();
  var samePage = new URL(filename, window.location.href).href;
  var samePageParent = new URL("../" + filename, window.location.href).href;
  var filesRoot = window.location.origin + "/files/" + filename;
  var candidates = [
    base + filename,
    base + "../" + filename,
    window.location.origin + "/" + filename,
    filesRoot,
    samePage,
    samePageParent
  ];
  for (var c = 0; c < NSW_POSTCODE_CDN_URLS.length; c++) {
    candidates.push(NSW_POSTCODE_CDN_URLS[c].replace("nsw-postcodes.json", filename));
  }
  var seen = {};
  return candidates.filter(function (u) {
    if (seen[u]) return false;
    seen[u] = true;
    return true;
  });
}

async function fetchJsonWithFallback(filename) {
  var urls = getDataFetchUrls(filename);
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
        lastErr = new Error("Got HTML instead of JSON: " + urls[j]);
        continue;
      }
      return JSON.parse(trimmed);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Failed to load " + filename);
}

async function loadPostcodes() {
  if (dataLoaded) return;
  if (!siteAssetsBase) {
    siteAssetsBase = resolveSiteAssetsBase();
  }
  try {
    var data = await fetchJsonWithFallback("nsw-postcodes.json");
    if (!Array.isArray(data) || !data.length) {
      throw new Error("Invalid postcode JSON");
    }
    postcodeData = data;
    dataLoaded = true;
  } catch (err) {
    throw err;
  }
}

async function loadRegionDatasets() {
  if (regionDataLoaded) return;
  var lhdMap = await fetchJsonWithFallback("data/nsw_postcode_lhd.json");
  var popMap = await fetchJsonWithFallback("data/lhd_population.json");
  postcodeToLHD = lhdMap || {};
  lhdPopulation = popMap || {};
  regionDataLoaded = true;
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
  const regionSelectEl = document.getElementById("regionSelect");
  if (!resultEl) return;

  const hasInput = input.length > 0;
  if (hasInput && !postcodeData.length) {
    resultEl.innerHTML = "<p>Loading data...</p>";
    try {
      await loadPostcodes();
    } catch (err) {
      console.error("Impact data load failed:", err);
      resultEl.innerHTML = "<p>Could not load postcode data. Please refresh and try again.</p>";
      return;
    }
  }
  if (!regionDataLoaded) {
    try {
      await loadRegionDatasets();
    } catch (e) {
      // Keep calculator working with built-in REGION_DATA if JSON files are missing.
      console.warn("Region datasets unavailable; using built-in region defaults.", e);
    }
  }

  let match = null;
  if (hasInput) {
    match = postcodeData.find(function (item) {
      return (
        item.postcode === input ||
        item.suburb.toLowerCase() === input ||
        item.suburb.toLowerCase().includes(input)
      );
    });
    if (!match) {
      resultEl.innerHTML = "<p>Location not found. Choose a region from the dropdown.</p>";
      return;
    }
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

  let region = regionSelectEl && regionSelectEl.value ? regionSelectEl.value : "Sydney";
  if (match) {
    const postcode = String(match.postcode || "");
    region = postcodeToLHD[postcode];
    if (!region) {
      // Fallback to nearest known postcode region when exact mapping is missing.
      var knownPostcodes = Object.keys(postcodeToLHD);
      if (knownPostcodes.length) {
        var best = knownPostcodes[0];
        var bestDistance = Math.abs(parseInt(postcode, 10) - parseInt(best, 10));
        for (var k = 1; k < knownPostcodes.length; k++) {
          var candidate = knownPostcodes[k];
          var distance = Math.abs(parseInt(postcode, 10) - parseInt(candidate, 10));
          if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
          }
        }
        region = postcodeToLHD[best];
        console.warn("Postcode not found in LHD map, using nearest region:", postcode, "=>", region);
      }
    }
    if (!region || !REGION_DATA[region]) {
      region = "Sydney";
      console.warn("Defaulting to Sydney region for postcode:", postcode);
    }
    if (regionSelectEl && REGION_DATA[region]) {
      regionSelectEl.value = region;
    }
  }

  const regionPop = lhdPopulation[region] || REGION_DATA[region].population || 0;
  const regionShare = regionPop > 0 ? (regionPop / NSW_POPULATION) : 0;
  const localNurses = Math.floor(newNurses * regionShare);
  const localTeachers = Math.floor(newTeachers * regionShare);
  const nursePerPeople = localNurses > 0 ? Math.floor(regionPop / localNurses) : 0;
  const teacherPerPeople = localTeachers > 0 ? Math.floor(regionPop / localTeachers) : 0;
  const perPeopleHtml =
    (localNurses > 0 ? `➡️ 1 nurse per ${nursePerPeople.toLocaleString()} people<br>` : "") +
    (localTeachers > 0 ? `➡️ 1 teacher per ${teacherPerPeople.toLocaleString()} people` : "");

  // =========================
  // OUTPUT (NO STYLE CHANGES)
  // =========================
  resultEl.innerHTML = `
    <h3>${region}</h3>
    ${match ? `<p>${formatSuburbLabel(match.suburb)} (${match.postcode})</p>` : ""}

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
      ${perPeopleHtml || "⚠️ Region population data unavailable"}
    </p>
  `;

  // Region output: real hospitals + school system impact.
  var regionOutputEl = document.getElementById("region-output");
  if (regionSelectEl && regionOutputEl) {
    var region = regionSelectEl.value;
    var data = REGION_DATA[region];
    if (data) {
      var regionPop = lhdPopulation[region] || data.population;
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

function resolveRegionFromInput(rawInput) {
  var input = cleanInput(rawInput);
  if (!input) return null;

  var match = null;
  if (postcodeData.length) {
    match = postcodeData.find(function (item) {
      return (
        item.postcode === input ||
        cleanInput(item.suburb) === input ||
        cleanInput(item.suburb).includes(input)
      );
    });
  }

  var postcode = match ? String(match.postcode || "") : input;
  var region = postcodeToLHD[postcode];

  if (!region) {
    var knownPostcodes = Object.keys(postcodeToLHD);
    if (knownPostcodes.length && /^\d+$/.test(postcode)) {
      var best = knownPostcodes[0];
      var bestDistance = Math.abs(parseInt(postcode, 10) - parseInt(best, 10));
      for (var i = 1; i < knownPostcodes.length; i++) {
        var candidate = knownPostcodes[i];
        var distance = Math.abs(parseInt(postcode, 10) - parseInt(candidate, 10));
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
      region = postcodeToLHD[best];
    }
  }

  if (!region || !REGION_DATA[region]) return null;
  return region;
}

function calculateImpactForRegion(region, nurseSplit) {
  var teacherSplit = 1 - nurseSplit;
  var nurseBudget = TOTAL_BUDGET * nurseSplit;
  var teacherBudget = TOTAL_BUDGET * teacherSplit;

  var nursePayRiseInput = parseInt(
    document.getElementById('nurseRise')?.value ||
    document.getElementById('paySliderNurses')?.value ||
    0,
    10
  ) || 0;
  var teacherPayRiseInput = parseInt(
    document.getElementById('teacherRise')?.value ||
    document.getElementById('paySliderTeachers')?.value ||
    0,
    10
  ) || 0;

  var nursePayCost = (nursePayRiseInput / 100) * TOTAL_NURSES * COST_PER_WORKER;
  var teacherPayCost = (teacherPayRiseInput / 100) * TOTAL_TEACHERS * COST_PER_WORKER;
  nursePayCost = Math.min(nursePayCost, nurseBudget);
  teacherPayCost = Math.min(teacherPayCost, teacherBudget);

  var nurseRemaining = nurseBudget - nursePayCost;
  var teacherRemaining = teacherBudget - teacherPayCost;

  var newNurses = Math.floor(nurseRemaining / COST_PER_WORKER);
  var newTeachers = Math.floor(teacherRemaining / COST_PER_WORKER);
  var totalWorkers = newNurses + newTeachers;
  if (totalWorkers > MAX_WORKERS) {
    var scale = MAX_WORKERS / totalWorkers;
    newNurses = Math.floor(newNurses * scale);
    newTeachers = Math.floor(newTeachers * scale);
  }

  var regionPop = lhdPopulation[region] || REGION_DATA[region].population || 0;
  var regionShare = regionPop > 0 ? regionPop / NSW_POPULATION : 0;

  return {
    nursesFunded: Math.floor(newNurses * regionShare),
    teachersFunded: Math.floor(newTeachers * regionShare),
    nursePayRise: nursePayRiseInput.toFixed(1),
    teacherPayRise: teacherPayRiseInput.toFixed(1)
  };
}

function ensurePersuasiveImpactUI() {
  try {
  var inputEl = document.getElementById('postcodeInput') || document.getElementById('locationInput');
  if (!inputEl) return;

  if (!document.getElementById('budgetSlider')) {
    var sliderHTML = `
<div id="budgetSliderWrap" style="margin-top:20px;">
  <label><strong>How should funding be split?</strong></label>
  <input
    type="range"
    id="budgetSlider"
    min="0"
    max="100"
    value="50"
    style="width:100%;"
  />
  <div style="display:flex; justify-content:space-between; font-size:14px;">
    <span id="nursePercent">50% Nurses</span>
    <span id="teacherPercent">50% Teachers</span>
  </div>
</div>
`;
    inputEl.insertAdjacentHTML('afterend', sliderHTML);
  }

  if (!document.getElementById('output')) {
    var outputDiv = document.createElement('div');
    outputDiv.id = 'output';
    outputDiv.style.marginTop = '20px';
    inputEl.parentNode.appendChild(outputDiv);
  }

  var slider = document.getElementById('budgetSlider');
  var nurseLabel = document.getElementById('nursePercent');
  var teacherLabel = document.getElementById('teacherPercent');
  var splitSlider = document.getElementById('splitSlider');
  var splitValue = document.getElementById('splitValue');

  if (slider && !slider.dataset.wired) {
    if (splitSlider && splitSlider.value) {
      slider.value = splitSlider.value;
      if (nurseLabel) nurseLabel.textContent = `${slider.value}% Nurses`;
      if (teacherLabel) teacherLabel.textContent = `${100 - slider.value}% Teachers`;
    }
    slider.addEventListener('input', function () {
      if (nurseLabel) nurseLabel.textContent = `${slider.value}% Nurses`;
      if (teacherLabel) teacherLabel.textContent = `${100 - slider.value}% Teachers`;
      if (splitSlider) splitSlider.value = slider.value;
      if (splitValue) splitValue.textContent = slider.value;
      void updateImpact();
      void showImpact();
    });
    slider.dataset.wired = "1";
  }
  } catch (err) {
    console.warn("Persuasive UI setup failed, keeping core calculator active:", err);
  }
}

async function updateImpact() {
  try {
    var inputEl = document.getElementById('postcodeInput') || document.getElementById('locationInput');
    var outputEl = document.getElementById('output');
    if (!inputEl || !outputEl) return;

  if (!regionDataLoaded) {
    try {
      await loadRegionDatasets();
    } catch (err) {
      console.warn("Region datasets unavailable for persuasive output.", err);
    }
  }
  if (!postcodeData.length) {
    try {
      await loadPostcodes();
    } catch (err2) {
      console.warn("Postcode dataset unavailable for persuasive output.", err2);
    }
  }

  var rawInput = (inputEl.value || "").trim();
  if (!rawInput) {
    outputEl.innerHTML = "";
    return;
  }

  var region = resolveRegionFromInput(rawInput);
  var regionSelectEl = document.getElementById("regionSelect");
  if (regionSelectEl && region) {
    regionSelectEl.value = region;
  }
  if (!region) {
    outputEl.innerHTML = "Enter a valid NSW postcode";
    return;
  }

  var slider = document.getElementById('budgetSlider');
  var nurseSplit = slider ? parseInt(slider.value, 10) / 100 : 0.5;
  var result = calculateImpactForRegion(region, nurseSplit);

    outputEl.innerHTML = `
    <div style="margin-top:20px; line-height:1.6;">
      <div style="font-size:18px; font-weight:bold;">
        ${region}
      </div>

      <div style="margin-top:10px;">
        This funding delivers real impact in your community:
      </div>

      <div style="margin-top:12px;">
        ✔ <strong>${result.nursesFunded}</strong> additional nurses on the ground<br>
        ✔ <strong>${result.teachersFunded}</strong> additional teachers in classrooms
      </div>

      <div style="margin-top:12px;">
        ✔ <strong>${result.nursePayRise}%</strong> pay rise for existing nurses<br>
        ✔ <strong>${result.teacherPayRise}%</strong> pay rise for existing teachers
      </div>

      <div style="margin-top:14px; font-size:14px; opacity:0.85;">
        That means shorter hospital wait times, more support for families, and better outcomes for students.
      </div>
    </div>
  `;
  } catch (err3) {
    console.warn("Persuasive output update failed, keeping core calculator active:", err3);
  }
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
  var locationInput = document.getElementById("locationInput");
  if (locationInput) {
    locationInput.addEventListener("change", function () {
      void showImpact();
      void updateImpact();
    });
    locationInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        void showImpact();
        void updateImpact();
      }
    });
    locationInput.addEventListener("input", function () {
      void updateImpact();
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
  ensurePersuasiveImpactUI();
  void updateImpact();
  void showImpact();

  loadPostcodes().catch(function (e) {
    console.error("NSW postcodes preload failed:", e);
  });
  loadRegionDatasets().catch(function (e) {
    console.error("Region datasets preload failed:", e);
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
