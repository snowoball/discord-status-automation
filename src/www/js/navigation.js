document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  const links = {
    "index.html": "main-header-link-home",
    "/": "main-header-link-home",
    "statuses.html": "main-header-link-statuses",
    "presets.html": "main-header-link-presets",
  };

  for (const [file, id] of Object.entries(links)) {
    if (path.endsWith(file)) {
      document.getElementById(id)?.classList.add("active");
      break;
    }
  }
});
