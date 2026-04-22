import { fetchConfig, updateConfig } from "./api.js";
import { showNotification, createLoader } from "./components.js";

const display = document.getElementById("settings-display");
const form = document.getElementById("settings-form");
const presetSelect = document.getElementById("presetId");
const timezoneSelect = document.getElementById("timezone");
const toggle = document.getElementById("activeToggle");

let config = null;
const loader = createLoader("Loading settings...");

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
    loader.show();
    config = await fetchConfig();
    populateTimezones();
    renderPresetOptions();
    renderSettings();
  } catch (err) {
    display.innerHTML = `<p class="error-message">Failed to load settings: ${err.message}</p>`;
    showNotification(`Failed to load settings: ${err.message}`, 'error');
  } finally {
    loader.hide();
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
        <p><strong>Active:</strong> <span class="badge badge-success">✓ Yes</span></p>
        <p><strong>Preset:</strong> ${presetName}</p>
        <p><strong>Interval:</strong> ${s.intervalSeconds}s</p>
        <p><strong>Timezone:</strong> ${s.timezone || "UTC"}</p>
        <p><strong>Location:</strong> ${s.location.latitude || "not set"}, ${s.location.longitude || "not set"}</p>
      </div>
    `;
  } else {
    display.innerHTML = `
      <div class="settings-card text-center" style="padding: 2rem;">
        <p style="font-size: 1.2rem; color: var(--text-muted);">❌ Service is currently inactive</p>
        <p class="text-dim mt-2">Enable the toggle below to start the status rotation</p>
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
    loader.show();
    await updateConfig(config);
    renderSettings();
    showNotification("Settings updated successfully!", 'success');
  } catch (err) {
    showNotification(`Failed to update settings: ${err.message}`, 'error');
  } finally {
    loader.hide();
  }
});

loadData();
