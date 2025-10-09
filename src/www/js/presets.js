import { fetchJSON, generateNewId, postJSON } from "./api.js";

const listContainer = document.getElementById("preset-list");
const form = document.getElementById("preset-form");
const newButton = document.getElementById("new-preset");

const statusListContainer = document.getElementById("status-list");
const addStatusButton = document.getElementById("add-status");

let presets = [];
let statuses = []; // Loaded from API

function getAllTags() {
  const all = statuses.flatMap((s) => s.tags || []);
  return [...new Set(all)].sort();
}

// ================= Load =================
async function loadPresets() {
  presets = await fetchJSON("/api/config/presets");
  renderList();
}

async function loadStatuses() {
  statuses = await fetchJSON("/api/config/statuses");
}

loadStatuses().then(loadPresets);

function resetForm() {
  form.name.value = ""; // <-- explicitly clear the name input
  delete form.dataset.editing; // Clear editing state
  form.querySelector("#form-title").textContent = "Add Preset";
  renderPresets([]); // Clear statuses section
}

// New preset button
newButton.addEventListener("click", (e) => {
  e.preventDefault();
  resetForm();
  form.scrollIntoView({ behavior: "smooth" });
});

// Reset/Cancel button inside the form
form.addEventListener("reset", (e) => {
  e.preventDefault();
  resetForm();
});

// ================= List =================
function renderList() {
  listContainer.innerHTML = "";
  presets.forEach((s, i) => {
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

function renderPresets(presetStatuses = []) {
  statusListContainer.innerHTML = "";
  const allTags = getAllTags();

  presetStatuses.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "status-item";
    div.dataset.idx = idx;

    let optionsHtml = "";

    if (s.type === "random" || s.type === "static") {
      // Determine currently selected tag filter
      const tagFilter = s.tagFilter || "";

      // Filter statuses by selected tag
      const filteredStatuses = tagFilter
        ? statuses.filter((x) => (x.tags || []).includes(tagFilter))
        : statuses;

      // Build tag filter dropdown
      const tagFilterHtml = `
        <label>Tag Filter:</label>
        <select class="tag-filter">
          <option value="">All</option>
          ${
        allTags.map((t) =>
          `<option value="${t}" ${
            t === tagFilter ? "selected" : ""
          }>${t}</option>`
        ).join("")
      }
        </select>
      `;

      if (s.type === "random") {
        const currentIds = s.status || [];

        optionsHtml = `
          <div class="random-status-list">
            ${
          currentIds.map((id) => {
            const st = statuses.find((x) => x.status_id == id);
            return `<div class="random-status-item" data-id="${id}">
                ${
              st
                ? `${st.status_emoji} ${st.status_text.replace(/\n/g, " ")}`
                : ""
            }
                <button type="button" class="remove-random btn-secondary">🗑️</button>
              </div>`;
          }).join("")
        }
          </div>
          ${tagFilterHtml}
          <select class="add-random-status">
            <option value="">-- Add Status --</option>
            ${
          filteredStatuses
            .filter((x) => !currentIds.includes(parseInt(x.status_id)))
            .map((x) =>
              `<option value="${x.status_id}">${x.status_emoji} ${
                x.status_text.replace(/\n/g, " ")
              }</option>`
            ).join("")
        }
          </select>
        `;
      } else if (s.type === "static") {
        optionsHtml = `
          ${tagFilterHtml}
          <select class="static-status">
            <option value="">-- select status --</option>
            ${
          filteredStatuses.map((x) => `
              <option value="${x.status_id}" ${
            s.status == x.status_id ? "selected" : ""
          }>
                ${x.status_emoji} ${x.status_text.replace(/\n/g, " ")}
              </option>`).join("")
        }
          </select>
        `;
      }
    }

    div.innerHTML = `
      <div class="status-controls">
        <label>Type:</label>
        <select class="status-type">
          <option value="none" ${
      s.type === "none" ? "selected" : ""
    }>None</option>
          <option value="random" ${
      s.type === "random" ? "selected" : ""
    }>Random</option>
          <option value="static" ${
      s.type === "static" ? "selected" : ""
    }>Static</option>
        </select>
        <button type="button" class="remove-status btn-secondary">🗑️</button>
      </div>
      <div class="status-options">${optionsHtml}</div>
    `;
    statusListContainer.appendChild(div);
  });

  enableDragAndDrop();
}

function getCurrentStatuses() {
  return [...statusListContainer.children].map((item, idx) => {
    const typeSelect = item.querySelector(".status-type");
    const type = typeSelect.value;

    const tagFilter = item.querySelector(".tag-filter")?.value || "";

    let status;
    if (type === "random") {
      status = [...item.querySelectorAll(".random-status-item")].map((x) =>
        parseInt(x.dataset.id)
      );
    } else if (type === "static") {
      const select = item.querySelector(".static-status");
      status = select && select.value ? parseInt(select.value) : null;
    }

    return { sequence: idx, type, tagFilter, status };
  });
}

// ================= Add/Remove =================
addStatusButton.addEventListener("click", () => {
  const current = getCurrentStatuses();
  renderPresets([...current, { type: "none", sequence: current.length }]);
});

statusListContainer.addEventListener("change", (e) => {
  const item = e.target.closest(".status-item");
  const idx = item.dataset.idx;

  if (e.target.classList.contains("tag-filter")) {
    const tagFilter = e.target.value;
    const current = getCurrentStatuses();
    current[idx].tagFilter = tagFilter;
    renderPresets(current);
    return;
  }

  if (e.target.classList.contains("status-type")) {
    const type = e.target.value;
    const current = getCurrentStatuses();
    current[idx] = {
      ...current[idx],
      type,
      status: type === "none" ? undefined : current[idx].status,
    };
    renderPresets(current);
  } else if (e.target.classList.contains("add-random-status")) {
    const val = parseInt(e.target.value);
    if (!val) return;
    const current = getCurrentStatuses();
    const existing = current[idx].status || [];
    if (!existing.includes(val)) existing.push(val);
    current[idx].status = existing;
    renderPresets(current);
  }
});

statusListContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-status")) {
    const idx = e.target.closest(".status-item").dataset.idx;
    const current = getCurrentStatuses();
    current.splice(idx, 1);
    renderPresets(current);
  }
  if (e.target.classList.contains("remove-random")) {
    const item = e.target.closest(".status-item");
    const rid = parseInt(e.target.closest(".random-status-item").dataset.id);
    const idx = item.dataset.idx;
    const current = getCurrentStatuses();
    current[idx].status = current[idx].status.filter((x) => x !== rid);
    renderPresets(current);
  }
});

// ================= Drag and Drop =================
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

    item.addEventListener(
      "dragleave",
      () => item.classList.remove("drag-over"),
    );

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      if (dragged && dragged !== item) {
        const current = getCurrentStatuses();
        const from = dragged.dataset.idx;
        const to = item.dataset.idx;
        const moved = current.splice(from, 1)[0];
        current.splice(to, 0, moved);
        renderPresets(current);
      }
    });

    item.addEventListener("dragend", () => item.classList.remove("drag-over"));
  });
}

// ================= Form Submit =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const currentStatuses = getCurrentStatuses();
  const editIdx = form.dataset.editing;

  if (editIdx) {
    presets[editIdx].name = name;
    presets[editIdx].statuses = currentStatuses;
  } else {
    const newId = generateNewId(presets, "id");
    presets.push({ id: newId, name, statuses: currentStatuses });
  }

  await postJSON("/api/config/presets", presets);
  form.reset();
  delete form.dataset.editing;
  form.querySelector("#form-title").textContent = "Add Preset";
  renderPresets([]);
  loadPresets();
});

// ================= List Actions =================
listContainer.addEventListener("click", (e) => {
  const idx = e.target.dataset.idx;
  if (!idx && idx !== "0") return;

  if (e.target.classList.contains("edit")) {
    const s = presets[idx];
    form.name.value = s.name;
    form.dataset.editing = idx;
    form.querySelector("#form-title").textContent = `Editing Preset #${s.id}`;
    renderPresets(s.statuses || []);
  }

  if (e.target.classList.contains("delete")) {
    const s = presets[idx];
    if (confirm(`Delete preset #${s.id}?`)) {
      presets.splice(idx, 1);
      postJSON("/api/config/presets", presets);
      loadPresets();
    }
  }
});
