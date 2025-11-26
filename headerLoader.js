// headerLoader.js
// Fetches `header.html` and inserts it into an element with id "siteHeader".
// Usage: include <div id="siteHeader" data-src="header.html"></div> and
// <script src="headerLoader.js"></script> on the page.

(function () {
  function insertFallback(target) {
    const h1 = document.createElement("h1");
    h1.textContent = "K.K. Slider Songs Checklist (ACNH)";
    h1.style.margin = "0 0 10px 0";
    target.appendChild(h1);
  }

  async function loadHeaderOnce() {
    const target = document.getElementById("siteHeader");
    if (!target) return;

    const headerPath = target.dataset.src || "header.html";

    try {
      const res = await fetch(headerPath);
      if (!res.ok) throw new Error("Network response not ok: " + res.status);
      const html = await res.text();
      target.innerHTML = html;
    } catch (err) {
      // Some browsers block fetch() on file:// origins — fallback so page still works.
      console.warn("headerLoader: could not load", headerPath, err);
      insertFallback(target);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadHeaderOnce);
  } else {
    loadHeaderOnce();
  }
})();
