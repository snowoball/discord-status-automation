// js/api.js

// Fetch the entire configuration
export async function fetchConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch configuration");
  return await res.json();
}

// Update the entire configuration
export async function updateConfig(config) {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config, null, 2),
  });
  if (!res.ok) throw new Error("Failed to update configuration");
  return await res.json();
}

// Helper to generate new ID
export function generateNewId(items, key = "id") {
  if (!items || items.length === 0) return 1;
  const maxId = Math.max(...items.map((item) => parseInt(item[key] || 0)));
  return maxId + 1;
}
