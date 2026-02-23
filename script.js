const totalSteps = 7;
let currentStep = 1;
let plantDatabase = [];
let lastTopPlants = [];
let lastAnswers = {};

const quizForm = document.getElementById("quizForm");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const stepIndicator = document.getElementById("stepIndicator");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const progressBar = document.getElementById("progressBar");
const validationMessage = document.getElementById("validationMessage");
const resultsSection = document.getElementById("resultsSection");
const loadingScreen = document.getElementById("loadingScreen");
const bestMatch = document.getElementById("bestMatch");
const startGrowingCard = document.getElementById("startGrowingCard");
const alternativesGrid = document.getElementById("alternativesGrid");
const carePanel = document.getElementById("carePanel");
const restartBtn = document.getElementById("restartBtn");
const soilMixBtn = document.getElementById("soilMixBtn");
const downloadPlanBtn = document.getElementById("downloadPlanBtn");
const emailForm = document.getElementById("emailForm");
const emailStatus = document.getElementById("emailStatus");
const emailSubmitBtn = document.getElementById("emailSubmitBtn");
const stepDots = document.getElementById("stepDots");
const stepFeedback = document.getElementById("stepFeedback");

soilMixBtn.disabled = true;
downloadPlanBtn.disabled = true;

const fieldOrder = ["type", "sunlight", "water", "space", "difficulty", "purpose", "petSafe"];
const labels = {
  type: "placement",
  sunlight: "sunlight",
  water: "watering",
  space: "space",
  difficulty: "experience",
  purpose: "purpose",
  petSafe: "pet safety",
};

const microFeedbackByStep = {
  1: "Great start! We'll tailor plants to your space.",
  2: "Nice choice! Matching light needs is key to healthy growth.",
  3: "Perfect — we'll balance care level with your watering rhythm.",
  4: "Awesome! We'll suggest plants that fit your available space.",
  5: "Great! We'll tune recommendations to your experience level.",
  6: "Love it! We'll prioritize plants that match your purpose.",
  7: "Final step — let's make sure your recommendation is pet friendly.",
};

function renderStepDots() {
  stepDots.innerHTML = Array.from({ length: totalSteps }, (_, index) => {
    const isActive = index + 1 <= currentStep ? "active" : "";
    return `<span class="step-dot ${isActive}"></span>`;
  }).join("");
}

async function loadPlants() {
  const response = await fetch("plants.json");
  plantDatabase = await response.json();
}

function updateStepUI() {
  document.querySelectorAll(".step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === currentStep);
  });

  const percent = Math.round((currentStep / totalSteps) * 100);
  stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", String(percent));
  renderStepDots();

  prevBtn.disabled = currentStep === 1;
  nextBtn.textContent = currentStep === totalSteps ? "See Results" : "Next";
  validationMessage.textContent = "";
  stepFeedback.textContent = microFeedbackByStep[currentStep];
}

function validateCurrentStep() {
  const fieldName = fieldOrder[currentStep - 1];
  const checked = quizForm.querySelector(`input[name="${fieldName}"]:checked`);
  if (!checked) {
    validationMessage.textContent = "Please choose an option to continue.";
    return false;
  }
  return true;
}

function calculateTopPlants(answers) {
  const weights = { type: 3, sunlight: 3, water: 3, space: 2, difficulty: 2, purpose: 4, petSafe: 3 };

  return plantDatabase
    .map((plant) => {
      let score = 0;
      const matchedAttributes = [];

      Object.entries(weights).forEach(([attribute, weight]) => {
        if (answers[attribute] === "no" && attribute === "petSafe") {
          score += 1;
          return;
        }
        if (plant[attribute] === answers[attribute]) {
          score += weight;
          matchedAttributes.push(attribute);
        }
      });

      if (answers.purpose === plant.purpose) score += 2;
      if (answers.petSafe === "yes" && plant.petSafe === "yes") score += 2;

      return { ...plant, score, matchedAttributes };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function renderBestMatch(plant) {
  const matchSummary = plant.matchedAttributes.length
    ? plant.matchedAttributes.map((key) => labels[key]).join(", ")
    : "general suitability";

  bestMatch.innerHTML = `
    <span class="rank">Best Match</span>
    <h3>${plant.name}</h3>
    <span class="score-pill">Match Score: ${plant.score}</span>
    <p class="best-match-copy">Strong alignment on ${matchSummary}. This is the highest confidence fit for your inputs.</p>
    <h4>Why this fits you</h4>
    <ul>${plant.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
    <h4>Care instructions</h4>
    <p>${plant.care}</p>
    <button type="button" class="btn btn-primary best-match-cta" id="emailCtaBtn">Email this recommendation</button>
  `;

  const emailCtaBtn = document.getElementById("emailCtaBtn");
  emailCtaBtn?.addEventListener("click", () => {
    document.getElementById("subscriberEmail")?.focus();
    document.getElementById("subscriberEmail")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function renderAlternatives(plants) {
  alternativesGrid.innerHTML = plants
    .map(
      (plant, index) => `
      <article class="result-card">
        <span class="rank">#${index + 2} Alternative</span>
        <h3>${plant.name}</h3>
        <span class="score-pill">Match Score: ${plant.score}</span>
        <p>${plant.reasons[0]}</p>
      </article>`
    )
    .join("");
}

function renderCarePanel(topPlants) {
  const tips = topPlants.map((plant) => `<li><strong>${plant.name}:</strong> ${plant.care}</li>`).join("");
  carePanel.innerHTML = `<h3 class="section-title">Care Tips Snapshot</h3><ul>${tips}</ul>`;
}

function getPotSize(space, type) {
  if (space === "small") return type === "outdoor" ? "8-10 inch terracotta pot" : "6-8 inch indoor pot";
  if (space === "medium") return type === "outdoor" ? "12-14 inch planter" : "10-12 inch indoor planter";
  return type === "outdoor" ? "18+ inch grow container / garden bed" : "14-16 inch floor planter";
}

function getWateringSchedule(waterLevel) {
  if (waterLevel === "low") return "Water deeply every 10-14 days. Let top soil dry between watering.";
  if (waterLevel === "medium") return "Water about once a week. Keep soil lightly moist, not soggy.";
  return "Water every 2-3 days and check topsoil moisture frequently.";
}

function getSunlightPlacement(sunlightLevel, plantType) {
  if (sunlightLevel === "low") return plantType === "indoor" ? "Near a bright room corner with indirect light." : "Outdoor partial shade (no harsh afternoon sun).";
  if (sunlightLevel === "medium") return plantType === "indoor" ? "Place near an east-facing window or filtered balcony light." : "Morning sun + filtered afternoon light.";
  return plantType === "indoor" ? "Closest bright window with a few hours of direct sun." : "Open sunny area with 5-6+ hours of direct sunlight.";
}

function renderStartGrowing(plant, answers) {
  const potSize = getPotSize(answers.space, plant.type);
  const watering = getWateringSchedule(plant.water);
  const sunlight = getSunlightPlacement(plant.sunlight, plant.type);

  startGrowingCard.innerHTML = `
    <h3>Start Growing Your Plant</h3>
    <div class="start-growing-grid">
      <article class="grow-tip">
        <div class="label">Recommended pot size</div>
        <p>${potSize}</p>
      </article>
      <article class="grow-tip">
        <div class="label">Watering schedule</div>
        <p>${watering}</p>
      </article>
      <article class="grow-tip">
        <div class="label">Sunlight placement</div>
        <p>${sunlight}</p>
      </article>
    </div>
  `;
}

function renderResults(topPlants, answers) {
  const [winner, ...alternatives] = topPlants;
  renderBestMatch(winner);
  renderAlternatives(alternatives);
  renderStartGrowing(winner, answers);
  renderCarePanel(topPlants);
  lastTopPlants = topPlants;
  lastAnswers = answers;

  soilMixBtn.dataset.plantName = winner.name;
  soilMixBtn.dataset.plantType = winner.type;
  soilMixBtn.disabled = false;
  downloadPlanBtn.disabled = false;
  emailSubmitBtn.disabled = false;
  emailStatus.textContent = "";

  loadingScreen.classList.add("hidden");
  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openSoilMixCalculator() {
  const plantName = soilMixBtn.dataset.plantName;
  if (!plantName) return;

  const soilToolUrl = `/soil-tool/?plant=${encodeURIComponent(plantName)}`;
  window.location.href = soilToolUrl;
}


function downloadCarePlan() {
  if (!lastTopPlants.length) return;
  const lines = [
    "Plant Match Studio - Care Plan",
    "",
    ...lastTopPlants.map((p, i) => `${i + 1}. ${p.name} (Score: ${p.score})\nCare: ${p.care}\n`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plant-care-plan.txt";
  a.click();
  URL.revokeObjectURL(url);
}

async function submitEmailCapture(event) {
  event.preventDefault();
  if (!lastTopPlants.length) {
    emailStatus.textContent = "Please generate recommendations before saving your plan.";
    return;
  }

  const emailInput = emailForm.querySelector('input[name="email"]');
  const email = emailInput.value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    emailStatus.textContent = "Please enter a valid email address.";
    emailInput.focus();
    return;
  }

  emailSubmitBtn.disabled = true;
  emailStatus.textContent = "Saving your plant plan...";

  setTimeout(() => {
    const bestPlant = lastTopPlants[0]?.name || "your recommended plant";
    emailStatus.textContent = `Success! Your ${bestPlant} care guide has been sent to ${email}.`;
    emailForm.reset();
    emailSubmitBtn.disabled = false;
  }, 500);
}


quizForm.addEventListener("change", (event) => {
  if (event.target.matches('input[type="radio"]')) {
    stepFeedback.textContent = microFeedbackByStep[currentStep];
  }
});

nextBtn.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  if (currentStep < totalSteps) {
    currentStep += 1;
    updateStepUI();
    return;
  }

  const answers = Object.fromEntries(new FormData(quizForm).entries());
  const topPlants = calculateTopPlants(answers);

  resultsSection.classList.add("hidden");
  loadingScreen.classList.remove("hidden");
  loadingScreen.scrollIntoView({ behavior: "smooth", block: "start" });

  setTimeout(() => {
    renderResults(topPlants, answers);
  }, 1500);
});

prevBtn.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep -= 1;
    updateStepUI();
  }
});

restartBtn.addEventListener("click", () => {
  quizForm.reset();
  emailForm.reset();
  currentStep = 1;
  lastTopPlants = [];
  lastAnswers = {};
  soilMixBtn.dataset.plantName = "";
  soilMixBtn.dataset.plantType = "";
  soilMixBtn.disabled = true;
  downloadPlanBtn.disabled = true;
  emailSubmitBtn.disabled = true;
  emailStatus.textContent = "";
  startGrowingCard.innerHTML = "";
  resultsSection.classList.add("hidden");
  loadingScreen.classList.add("hidden");
  updateStepUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

soilMixBtn.addEventListener("click", openSoilMixCalculator);
downloadPlanBtn.addEventListener("click", downloadCarePlan);
emailForm.addEventListener("submit", submitEmailCapture);

loadPlants().then(updateStepUI).catch(() => {
  validationMessage.textContent = "Unable to load plant database. Refresh and try again.";
  nextBtn.disabled = true;
});
