import { fetchConfig, updateConfig, generateNewId } from "./api.js";
import { showNotification, confirmDialog, createLoader, createEmptyState, showEmojiPicker } from "./components.js";

const listContainer = document.getElementById("status-list");
const form = document.getElementById("status-form");
const newButton = document.getElementById("new-status");

let config = null;
const loader = createLoader("Loading statuses...");

async function loadData() {
  try {
    loader.show();
    config = await fetchConfig();
    renderList();
  } catch (err) {
    showNotification(`Failed to load statuses: ${err.message}`, 'error');
  } finally {
    loader.hide();
  }
}

function resetForm() {
  form.text.value = "";
  form.emoji.value = "";
  form.tags.value = "";
  delete form.dataset.editing;
  form.querySelector("#form-title").textContent = "Add Status";
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
  if (config.statuses.length === 0) {
    const empty = createEmptyState(
      "📝",
      "No statuses yet",
      "Create your first status using the form on the right"
    );
    listContainer.innerHTML = "";
    listContainer.appendChild(empty);
    return;
  }

  listContainer.innerHTML = "";
  config.statuses.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "status-item fade-in";

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
        <button class="edit" data-idx="${i}" title="Edit status">✏️</button>
        <button class="delete" data-idx="${i}" title="Delete status">🗑️</button>
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

  try {
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

    loader.show();
    await updateConfig(config);
    form.reset();
    delete form.dataset.editing;
    form.querySelector("#form-title").textContent = "Add Status";
    await loadData();
    showNotification(editIdx ? "Status updated!" : "Status created!", 'success');
  } catch (err) {
    showNotification(`Failed to save status: ${err.message}`, 'error');
  } finally {
    loader.hide();
  }
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
    form.scrollIntoView({ behavior: "smooth" });
  }

  if (e.target.classList.contains("delete")) {
    const s = config.statuses[idx];
    const confirmed = await confirmDialog(`Are you sure you want to delete status #${s.id}?`);
    if (confirmed) {
      try {
        loader.show();
        config.statuses.splice(idx, 1);
        await updateConfig(config);
        await loadData();
        showNotification("Status deleted", 'success');
      } catch (err) {
        showNotification(`Failed to delete status: ${err.message}`, 'error');
      } finally {
        loader.hide();
      }
    }
  }
});

// Emoji picker button handler
const emojiPickerBtn = document.getElementById("emoji-picker-btn");
emojiPickerBtn.addEventListener("click", (e) => {
  e.preventDefault();
  showEmojiPicker((emoji) => {
    form.emoji.value = emoji;
  });
});

loadData();
