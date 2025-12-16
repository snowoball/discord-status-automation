import { fetchConfig, updateConfig, generateNewId } from "./api.js";

const listContainer = document.getElementById("status-list");
const form = document.getElementById("status-form");
const newButton = document.getElementById("new-status");

let config = null;

async function loadData() {
  config = await fetchConfig();
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

newButton.addEventListener("click", (e) => {
  e.preventDefault();
  resetForm();
});

form.addEventListener("reset", (e) => {
  e.preventDefault();
  resetForm();
});

function renderList() {
  listContainer.innerHTML = "";
  config.statuses.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "status-item";

    const tagsHTML =
      s.tags && s.tags.length
        ? `<div class="status-tags">${
            s.tags.map((t) => `<span class="tag">${t}</span>`).join(" ")
          }</div>`
        : "";

    item.innerHTML = `
      <div class="status-info">
        <div class="status-emoji">${s.emoji}</div>
        <div class="status-text">${s.text}</div>
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

  const tags = form.tags.value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const editIdx = form.dataset.editing;

  if (editIdx) {
    config.statuses[editIdx].emoji = emoji;
    config.statuses[editIdx].text = text;
    config.statuses[editIdx].tags = tags;
  } else {
    const newId = generateNewId(config.statuses, "id");
    config.statuses.push({
      id: newId,
      emoji: emoji,
      text: text,
      tags,
    });
  }

  await updateConfig(config);
  form.reset();
  delete form.dataset.editing;
  form.querySelector("#form-title").textContent = "Add Status";
  loadData();
});

listContainer.addEventListener("click", async (e) => {
  const idx = e.target.dataset.idx;
  if (!idx && idx !== "0") return;

  if (e.target.classList.contains("edit")) {
    const s = config.statuses[idx];
    form.emoji.value = s.emoji;
    form.text.value = s.text;
    form.tags.value = s.tags ? s.tags.join(", ") : "";
    form.dataset.editing = idx;
    form.querySelector("#form-title").textContent = `Editing Status #${s.id}`;
  }

  if (e.target.classList.contains("delete")) {
    const s = config.statuses[idx];
    if (confirm(`Delete status #${s.id}?`)) {
      config.statuses.splice(idx, 1);
      await updateConfig(config);
      loadData();
    }
  }
});

loadData();
