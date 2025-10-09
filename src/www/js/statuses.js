import { fetchJSON, generateNewId, postJSON } from "./api.js";

const listContainer = document.getElementById("status-list");
const form = document.getElementById("status-form");
const newButton = document.getElementById("new-status");

let statuses = [];

async function loadStatuses() {
  statuses = await fetchJSON("/api/config/statuses");
  renderList();
}

function resetForm() {
  form.text.value = "";
  form.emoji.value = "";
  form.tags.value = "";
  delete form.dataset.editing;
  form.querySelector("#form-title").textContent = "Add Status";
  renderList();
}

// New status button
newButton.addEventListener("click", (e) => {
  e.preventDefault();
  resetForm();
});

// Reset/Cancel button inside the form
form.addEventListener("reset", (e) => {
  e.preventDefault();
  resetForm();
});

function renderList() {
  listContainer.innerHTML = "";
  statuses.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "status-item";

    // Build tags HTML (if any)
    const tagsHTML = s.tags && s.tags.length
      ? `<div class="status-tags">${
        s.tags.map((t) => `<span class="tag">${t}</span>`).join(" ")
      }</div>`
      : "";

    item.innerHTML = `
      <div class="status-info">
        <div class="status-emoji">${s.status_emoji}</div>
        <div class="status-text">${s.status_text}</div>
        ${tagsHTML}
      </div>
      <div class="status-actions">
        <button class="edit" data-idx="${i}">✏️</button>
        <button class="delete" data-idx="${i}">🗑️</button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const emoji = form.emoji.value.trim();
  const text = form.text.value.trim();

  // Parse tags input
  const tags = form.tags.value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const editIdx = form.dataset.editing;

  if (editIdx) {
    statuses[editIdx].status_emoji = emoji;
    statuses[editIdx].status_text = text;
    statuses[editIdx].tags = tags;
  } else {
    const newId = generateNewId(statuses, "status_id");
    statuses.push({
      status_id: newId.toString(),
      status_emoji: emoji,
      status_text: text,
      tags,
    });
  }

  await postJSON("/api/config/statuses", statuses);
  form.reset();
  delete form.dataset.editing;
  form.querySelector("#form-title").textContent = "Add Status";
  loadStatuses();
});

listContainer.addEventListener("click", async (e) => {
  const idx = e.target.dataset.idx;
  if (!idx && idx !== "0") return;

  if (e.target.classList.contains("edit")) {
    const s = statuses[idx];
    form.emoji.value = s.status_emoji;
    form.text.value = s.status_text;
    form.tags.value = s.tags ? s.tags.join(", ") : ""; // ← populate tags field
    form.dataset.editing = idx;
    form.querySelector("#form-title").textContent =
      `Editing Status #${s.status_id}`;
  }

  if (e.target.classList.contains("delete")) {
    const s = statuses[idx];
    if (confirm(`Delete status #${s.status_id}?`)) {
      statuses.splice(idx, 1);
      await postJSON("/api/config/statuses", statuses);
      loadStatuses();
    }
  }
});

loadStatuses();
