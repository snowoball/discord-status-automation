import { fetchConfig, updateConfig, generateNewId } from "./api.js";
import {
  fetchTypeSchemas,
  getTypeRenderer,
  renderTypeFields,
} from "./typeRegistry.js";

const listContainer = document.getElementById("preset-list");
const form = document.getElementById("preset-form");
const newButton = document.getElementById("new-preset");

const statusListContainer = document.getElementById("status-list");
const addStatusButton = document.getElementById("add-status");

let config = null;
let typeSchemas = [];

async function loadData() {
  config = await fetchConfig();
  typeSchemas = await fetchTypeSchemas();
  renderList();
}

loadData();

function resetForm() {
  form.name.value = "";
  delete form.dataset.editing;
  form.querySelector("#form-title").textContent = "Add Preset";
  renderPresetSequence([]);
}

newButton.addEventListener("click", (e) => {
  e.preventDefault();
  resetForm();
  form.scrollIntoView({ behavior: "smooth" });
});

form.addEventListener("reset", (e) => {
  e.preventDefault();
  resetForm();
});

function renderList() {
  listContainer.innerHTML = "";
  config.presets.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "preset-item";
    item.innerHTML = `
      <div class="preset-info">
        <div class="preset-name">${s.name}</div>
      </div>
      <div class="preset-actions">
        <button class="edit" data-idx="${i}">✏️</button>
        <button class="delete" data-idx="${i}">🗑️</button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

function renderPresetSequence(sequence = []) {
  statusListContainer.innerHTML = "";

  sequence.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "status-item";
    div.dataset.idx = idx;

    // Type selector
    const typeSelect = document.createElement("select");
    typeSelect.className = "status-type";
    
    typeSchemas.forEach((schema) => {
      const option = document.createElement("option");
      option.value = schema.name;
      option.textContent = `${schema.name} - ${schema.description}`;
      if (item.type === schema.name) option.selected = true;
      typeSelect.appendChild(option);
    });

    // Controls section
    const controls = document.createElement("div");
    controls.className = "status-controls";
    
    const controlsLabel = document.createElement("label");
    controlsLabel.textContent = "Type:";
    controls.appendChild(controlsLabel);
    controls.appendChild(typeSelect);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-status btn-secondary";
    removeBtn.textContent = "🗑️";
    controls.appendChild(removeBtn);

    div.appendChild(controls);

    // Options section (rendered by type-specific renderer)
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "status-options";

    const renderer = getTypeRenderer(item.type);
    if (renderer) {
      const rendered = renderer(
        item,
        config.statuses,
        (newParams) => {
          const current = getCurrentSequence();
          current[idx].params = newParams;
          renderPresetSequence(current);
        },
        typeSchemas
      );
      optionsContainer.appendChild(rendered);
    }

    div.appendChild(optionsContainer);
    statusListContainer.appendChild(div);
  });

  enableDragAndDrop();
}

function getCurrentSequence() {
  return [...statusListContainer.children].map((item) => {
    const typeSelect = item.querySelector(".status-type");
    const type = typeSelect.value;

    // Get params from the item's data (set by type renderers)
    const existingIdx = item.dataset.idx;
    const currentSeq = getCurrentSequenceRaw();
    const params = currentSeq[existingIdx]?.params || {};

    return { type, params };
  });
}

// Helper to get raw current sequence before re-render
function getCurrentSequenceRaw() {
  const formData = form.dataset.currentSequence;
  return formData ? JSON.parse(formData) : [];
}

// Store sequence data before re-render
function storeSequenceData(sequence) {
  form.dataset.currentSequence = JSON.stringify(sequence);
}

addStatusButton.addEventListener("click", () => {
  const current = getCurrentSequence();
  const newSequence = [...current, { type: "none", params: {} }];
  storeSequenceData(newSequence);
  renderPresetSequence(newSequence);
});

statusListContainer.addEventListener("change", (e) => {
  if (e.target.classList.contains("status-type")) {
    const item = e.target.closest(".status-item");
    const idx = item.dataset.idx;
    const type = e.target.value;
    const current = getCurrentSequence();
    current[idx] = { type, params: {} };
    storeSequenceData(current);
    renderPresetSequence(current);
  }
});

statusListContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-status")) {
    const idx = e.target.closest(".status-item").dataset.idx;
    const current = getCurrentSequence();
    current.splice(idx, 1);
    storeSequenceData(current);
    renderPresetSequence(current);
  }
});

function enableDragAndDrop() {
  let dragged = null;

  [...statusListContainer.children].forEach((item) => {
    item.draggable = true;

    item.addEventListener("dragstart", (e) => {
      dragged = item;
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      item.classList.add("drag-over");
    });

    item.addEventListener("dragleave", () =>
      item.classList.remove("drag-over")
    );

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      if (dragged && dragged !== item) {
        const current = getCurrentSequence();
        const from = dragged.dataset.idx;
        const to = item.dataset.idx;
        const moved = current.splice(from, 1)[0];
        current.splice(to, 0, moved);
        storeSequenceData(current);
        renderPresetSequence(current);
      }
    });

    item.addEventListener("dragend", () => item.classList.remove("drag-over"));
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const sequence = getCurrentSequence();
  const editIdx = form.dataset.editing;

  if (editIdx) {
    config.presets[editIdx].name = name;
    config.presets[editIdx].sequence = sequence;
  } else {
    const newId = generateNewId(config.presets, "id");
    config.presets.push({ id: newId, name, sequence });
  }

  await updateConfig(config);
  form.reset();
  delete form.dataset.editing;
  delete form.dataset.currentSequence;
  form.querySelector("#form-title").textContent = "Add Preset";
  renderPresetSequence([]);
  loadData();
});

listContainer.addEventListener("click", (e) => {
  const idx = e.target.dataset.idx;
  if (!idx && idx !== "0") return;

  if (e.target.classList.contains("edit")) {
    const s = config.presets[idx];
    form.name.value = s.name;
    form.dataset.editing = idx;
    form.querySelector("#form-title").textContent = `Editing Preset #${s.id}`;
    storeSequenceData(s.sequence || []);
    renderPresetSequence(s.sequence || []);
  }

  if (e.target.classList.contains("delete")) {
    const s = config.presets[idx];
    if (confirm(`Delete preset #${s.id}?`)) {
      config.presets.splice(idx, 1);
      updateConfig(config);
      loadData();
    }
  }
});
