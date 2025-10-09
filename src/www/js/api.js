// js/api.js
export async function fetchJSON(endpoint) {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
  return await res.json();
}

export async function postJSON(endpoint, data) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2),
  });
  if (!res.ok) throw new Error(`Failed to post to ${endpoint}`);
  return await res.json();
}

export function generateNewId(data, key = "id") {
  if (!data || data.length === 0) return 1;
  const maxId = Math.max(...data.map((d) => parseInt(d[key] || 0)));
  return maxId + 1;
}
