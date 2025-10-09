import { fetchJSON, postJSON } from "./api.js";

const display = document.getElementById("settings-display");
const form = document.getElementById("settings-form");
const presetSelect = document.getElementById("presetId");
const toggle = document.getElementById("activeToggle");

let settings = null;
let presets = [];

async function loadSettings() {
    try {
        settings = await fetchJSON("/api/config/settings");
        presets = await fetchJSON("/api/config/presets");
        renderPresetOptions();
        renderSettings();
    } catch (err) {
        display.innerHTML =
            `<p class="error">Failed to load settings: ${err}</p>`;
    }
}

function renderPresetOptions() {
    presetSelect.innerHTML = "";
    presets.forEach((p) => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${p.name} (#${p.id})`;
        presetSelect.appendChild(option);
    });
}

function renderSettings() {
    if (!settings || !settings.length) {
        display.innerHTML = "<p>No settings found.</p>";
        return;
    }

    const s = settings[0];
    const preset = presets.find((p) => p.id === s.preset_id);
    const presetName = preset ? preset.name : `Unknown (#${s.preset_id})`;

    display.innerHTML = `
    <div class="settings-card">
      <p><strong>Active:</strong> ${s.active ? "✅ Yes" : "❌ No"}</p>
      <p><strong>Preset:</strong> ${presetName}</p>
      <p><strong>Interval:</strong> ${s.interval_seconds}s</p>
      ${
        s.location && s.location[0]
            ? `<p><strong>Location:</strong> ${s.location[0].latitude}, ${
                s.location[0].longitude
            }</p>`
            : `<p><strong>Location:</strong> none</p>`
    }
    </div>
  `;

    // Prefill form
    presetSelect.value = s.preset_id;
    form.interval.value = s.interval_seconds;
    toggle.checked = s.active;
    if (s.location && s.location[0]) {
        form.latitude.value = s.location[0].latitude;
        form.longitude.value = s.location[0].longitude;
    } else {
        form.latitude.value = "";
        form.longitude.value = "";
    }

    updateFormState();
}

function updateFormState() {
    const disabled = !toggle.checked;
    // Disable all form inputs except the active toggle itself
    [...form.elements].forEach((el) => {
        if (el !== toggle) el.disabled = disabled;
    });

    // Optional styling feedback
    form.classList.toggle("form-disabled", disabled);
}

toggle.addEventListener("change", updateFormState);

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newSettings = [
        {
            active: toggle.checked,
            preset_id: Number(form.presetId.value),
            interval_seconds: Number(form.interval.value),
            location: [
                {
                    latitude: Number(form.latitude.value) || 0,
                    longitude: Number(form.longitude.value) || 0,
                },
            ],
        },
    ];

    try {
        await postJSON("/api/config/settings", newSettings);
        settings = newSettings;
        renderSettings();
        alert("Settings updated successfully!");
    } catch (err) {
        alert("Failed to update settings: " + err);
    }
});

loadSettings();
