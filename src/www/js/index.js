import { fetchConfig, updateConfig } from "./api.js";

const display = document.getElementById("settings-display");
const form = document.getElementById("settings-form");
const presetSelect = document.getElementById("presetId");
const timezoneSelect = document.getElementById("timezone");
const toggle = document.getElementById("activeToggle");

let config = null;

// Common timezones list
const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Zurich",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

async function loadData() {
  try {
    config = await fetchConfig();
    populateTimezones();
    renderPresetOptions();
    renderSettings();
  } catch (err) {
    display.innerHTML = `<p class="error">Failed to load settings: ${err}</p>`;
  }
}

function populateTimezones() {
  timezoneSelect.innerHTML = '<option value="">Select timezone...</option>';
  timezones.forEach((tz) => {
    const option = document.createElement("option");
    option.value = tz;
    option.textContent = tz;
    timezoneSelect.appendChild(option);
  });
}

function renderPresetOptions() {
  presetSelect.innerHTML = "";
  config.presets.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.name} (#${p.id})`;
    presetSelect.appendChild(option);
  });
}

function renderSettings() {
  const s = config.settings;
  const preset = config.presets.find((p) => p.id === s.activePresetId);
  const presetName = preset ? preset.name : `Unknown (#${s.activePresetId})`;

  if (s.active) {
    display.innerHTML = `
      <div class="settings-card">
        <p><strong>Active:</strong> ✅ Yes</p>
        <p><strong>Preset:</strong> ${presetName}</p>
        <p><strong>Interval:</strong> ${s.intervalSeconds}s</p>
        <p><strong>Timezone:</strong> ${s.timezone || "UTC"}</p>
        <p><strong>Location:</strong> ${s.location.latitude || "not set"}, ${s.location.longitude || "not set"}</p>
      </div>
    `;
  } else {
    display.innerHTML = `
      <div class="settings-card" style="text-align: center; padding: 2rem;">
        <p style="font-size: 1.2rem; color: var(--text-muted);">❌ Service is currently inactive</p>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem;">Enable the toggle below to start the status rotation</p>
      </div>
    `;
  }

  // Prefill form
  presetSelect.value = s.activePresetId;
  form.interval.value = s.intervalSeconds;
  timezoneSelect.value = s.timezone || "UTC";
  toggle.checked = s.active;
  form.latitude.value = s.location.latitude || "";
  form.longitude.value = s.location.longitude || "";

  updateFormState();
}

function updateFormState() {
  const disabled = !toggle.checked;
  [...form.elements].forEach((el) => {
    // Don't disable the toggle itself or the submit button
    if (el !== toggle && el.type !== "submit") {
      el.disabled = disabled;
    }
  });
  form.classList.toggle("form-disabled", disabled);
}

toggle.addEventListener("change", updateFormState);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  config.settings = {
    active: toggle.checked,
    activePresetId: Number(form.presetId.value),
    intervalSeconds: Number(form.interval.value),
    timezone: form.timezone.value || "UTC",
    location: {
      latitude: Number(form.latitude.value) || 0,
      longitude: Number(form.longitude.value) || 0,
    },
  };

  try {
    await updateConfig(config);
    renderSettings();
    alert("Settings updated successfully!");
  } catch (err) {
    alert("Failed to update settings: " + err);
  }
});

loadData();
