// headerLoader.js
// Fetches `header.html` and inserts it into an element with id "siteHeader".
// Usage: include <div id="siteHeader" data-src="header.html"></div> and
// <script src="headerLoader.js"></script> on the page.

(function () {
  function insertFallback(target) {
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="container">
        <h1>K.K. Slider Songs Checklist</h1>
        <nav class="site-nav">
          <a href="index.html">Home</a>
          <a href="kkSongs.html">Songs</a>
          <a href="test.html">Test Page</a>
          <a href="#" onclick="window.location.reload(); return false;">Refresh</a>
        </nav>
      </div>`;
    target.appendChild(header);
    // Copy very small inline style to ensure header is visible in fallback
    const style = document.createElement("style");
    style.textContent = `.site-nav { display: flex; gap: 8px; align-items:center; } .site-nav a { color: white; }`;
    target.appendChild(style);
  }
  // Read file with XHR (used as fallback in some file:// scenarios)
  function loadViaXhr(path) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", path, true);
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
              // status 0 can indicate success for file:// in some browsers
              resolve(xhr.responseText);
            } else {
              reject(new Error("XHR status: " + xhr.status));
            }
          }
        };
        xhr.onerror = function (e) {
          reject(e || new Error("XHR error"));
        };
        xhr.send();
      } catch (e) {
        reject(e);
      }
    });
  }

  async function loadHeaderOnce() {
    // allow multiple header containers, if present, using data-src attr
    const targets = Array.from(document.querySelectorAll("[data-src], #siteHeader"));
    if (!targets.length) return;

    // iterate over targets and attempt to load provided path
    await Promise.all(
      targets.map(async (target) => {
        let html = null;
        const headerPath = target.dataset.src || "header.html";
        const basePath = (window.location.pathname || "").split("/").slice(0, -1).join("/") + "/";
        const candidatePaths = [
          headerPath,
          "./" + headerPath,
          basePath + headerPath,
          "/" + headerPath,
        ];
        async function tryFetchPaths(paths) {
          for (const p of paths) {
            try {
              console.debug("headerLoader: attempting fetch", p);
              const res = await fetch(p);
              if (!res.ok) throw new Error("Network response not ok: " + res.status);
              console.info("headerLoader: fetched header via fetch", p);
              return { success: true, html: await res.text(), path: p };
            } catch (e) {
              console.debug("headerLoader: fetch failed for", p, e.message || e);
              // continue to next path
            }
          }
          return { success: false };
        }

        try {
          // Try fetch first (works when served via http/https)
          const fetchResult = await tryFetchPaths(candidatePaths);
          if (fetchResult.success) {
            html = fetchResult.html;
            // Adjust body padding so fixed header doesn't overlap content.
            try {
              adjustBodyForFixedHeader();
            } catch (e) {
              /* ignore */
            }
            console.info("headerLoader: loaded via fetch, path:", fetchResult.path);
          } else {
            throw new Error("fetch candidates failed");
          }
        } catch (errFetch) {
          // fetch failed (often due to file://). Try XHR as a fallback.
          try {
            // try XHR over candidate paths
            let xrHtml = null;
            for (const p of candidatePaths) {
              try {
                console.debug("headerLoader: attempting XHR", p);
                xrHtml = await loadViaXhr(p);
                if (xrHtml) {
                  html = xrHtml;
                  console.info("headerLoader: loaded via XHR", p);
                  break;
                }
              } catch (ex) {
                console.debug("headerLoader: XHR failed for", p, ex.message || ex);
              }
            }
            if (!html) throw new Error("XHR candidates failed");
            console.info("headerLoader: loaded via XHR", headerPath);
          } catch (errXhr) {
            // Last resort: fall back to a simple header element
            console.warn("headerLoader: could not load", headerPath, errFetch, errXhr);
            insertFallback(target);
            // Log fallback insertion so devs can see why nav is missing
            console.warn("headerLoader: inserted fallback header into", target);
          }
        }

        // If we have HTML, parse it and insert the header & styles into the document cleanly
        if (html !== null) {
          parseAndInsertHeader(target, html);
        }
        // Styles were moved into head by parseAndInsertHeader, but keep this as a backup
        try {
          const styles = Array.from(target.querySelectorAll('style, link[rel="stylesheet"]'));
          styles.forEach((s) => {
            if (s.tagName.toLowerCase() === "style") {
              const newS = document.createElement("style");
              newS.textContent = s.textContent;
              document.head.appendChild(newS);
            } else {
              const newLink = document.createElement("link");
              newLink.rel = "stylesheet";
              newLink.href = s.href;
              document.head.appendChild(newLink);
            }
          });
        } catch (e) {
          /* ignore */
        }
        // Adjust body padding so fixed header doesn't overlap content.
        try {
          adjustBodyForFixedHeader();
        } catch (e) {
          /* ignore */
        }
        // After header is inserted, allow the nav to be updated: set active link
        // After header is inserted, ensure it's styled to be full-width and fixed,
        // then allow the nav to be updated: set active link
        function enforceHeaderFullWidth(target) {
          try {
            const headerEl =
              document.querySelector(".site-header") || target.querySelector(".site-header");
            if (!headerEl) return;
            // apply inline overrides to ensure fixed full-viewport width
            headerEl.style.position = "fixed";
            headerEl.style.top = "0";
            headerEl.style.left = "0";
            headerEl.style.right = "0";
            headerEl.style.width = "100%";
            headerEl.style.zIndex = "9999";
            headerEl.style.boxSizing = "border-box";
            // tiny debug log when header is inserted
            const cs = window.getComputedStyle(headerEl);
            console.debug("headerLoader: applied inline full-width style", headerEl, {
              position: cs.position,
              left: cs.left,
              right: cs.right,
              width: cs.width,
              transform: cs.transform,
            });
            // Fallback: if width doesn't match viewport width, apply transform-center trick.
            try {
              const computedWidth = parseFloat(cs.width) || 0;
              if (Math.abs(computedWidth - window.innerWidth) > 2) {
                headerEl.style.left = "50%";
                headerEl.style.transform = "translateX(-50%)";
                headerEl.style.width = "100vw";
                console.debug(
                  "headerLoader: applied fallback centering for header to reach full viewport width"
                );
              }
            } catch (e) {
              /* ignore */
            }
          } catch (e) {
            console.warn("headerLoader: could not enforce header full width", e);
          }
        }
        enforceHeaderFullWidth(target);
        // Move the header node into document.body if it's not already a body child.
        try {
          const headerEl = target.querySelector(".site-header");
          if (headerEl && headerEl.parentElement !== document.body) {
            document.body.prepend(headerEl);
            console.debug("headerLoader: moved header element to document.body");
            // Remove the original placeholder node to avoid accidental layout constraints
            try {
              target.parentElement && target.parentElement.removeChild(target);
            } catch (e) {
              /* ignore */
            }
          }
        } catch (e) {
          console.warn("headerLoader: error moving header element", e);
        }
        try {
          // Prefer the header element we moved, fallback to target
          const headerNode =
            target.querySelector(".site-header") ||
            document.querySelector(".site-header") ||
            target;
          const links = headerNode.querySelectorAll("a");
          const loc = window.location.pathname.split("/").pop();
          // Debug: log all found links and their hrefs/text so we can trace why some anchors might be missing
          const found = Array.from(links).map((a) => ({
            href: a.getAttribute("href"),
            text: a.textContent.trim(),
          }));
          console.debug("headerLoader: header links found", found);
          // Debug dump of header DOM to help find missing anchors
          try {
            console.debug("headerLoader: header outerHTML", headerNode.outerHTML);
          } catch (e) {
            /* ignore */
          }
          // If there are no links, insert a small fallback nav for reliability
          if (!links || links.length === 0) {
            try {
              const nav = document.createElement("nav");
              nav.className = "site-nav";
              nav.innerHTML = `<a href="index.html">Home</a><a href="kkSongs.html">Songs</a><a href="test.html">Test</a>`;
              if (headerNode.querySelector(".container")) {
                headerNode.querySelector(".container").appendChild(nav);
              } else {
                headerNode.appendChild(nav);
              }
              console.warn("headerLoader: inserted fallback nav because none were found in header");
            } catch (e) {
              /* ignore */
            }
          }
          const updatedLinks = headerNode.querySelectorAll("a");
          updatedLinks.forEach((a) => {
            const linkPath = new URL(a.href, window.location.href).pathname.split("/").pop();
            if (linkPath === loc || (loc === "" && linkPath === "index.html")) {
              a.classList.add("active");
              a.setAttribute("aria-current", "page");
            } else {
              a.classList.remove("active");
              a.removeAttribute("aria-current");
            }
          });
        } catch (e) {
          // ignore update errors
        }
      })
    );
  }

  // Parse the HTML content and insert the header element & styles safely.
  function parseAndInsertHeader(target, html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Move <style> and <link rel=stylesheet> into document.head
      const styles = Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]'));
      styles.forEach((s) => {
        if (s.tagName.toLowerCase() === "style") {
          const newS = document.createElement("style");
          newS.textContent = s.textContent;
          document.head.appendChild(newS);
        } else {
          const newLink = document.createElement("link");
          newLink.rel = "stylesheet";
          newLink.href = s.href;
          document.head.appendChild(newLink);
        }
      });

      // Prefer to get the header element; fallback to first header tag
      const headerEl = doc.querySelector(".site-header") || doc.querySelector("header");
      if (headerEl) {
        const clone = headerEl.cloneNode(true);
        // Remove any previous header inserted by this loader to avoid duplicates
        const existing = document.querySelector(".site-header");
        if (existing) existing.parentElement && existing.parentElement.removeChild(existing);
        document.body.prepend(clone);
        console.debug("headerLoader: parseAndInsertHeader inserted header (cloned)", clone);
      } else {
        // No header tag found; put HTML into the target as fallback
        target.innerHTML = html;
        console.debug("headerLoader: parseAndInsertHeader inserted raw HTML into target");
      }
    } catch (e) {
      console.warn("headerLoader: parseAndInsertHeader failed", e);
      // fallback to raw assignment
      try {
        target.innerHTML = html;
      } catch (ex) {
        /* ignore */
      }
    }
  }

  function adjustBodyForFixedHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const rect = header.getBoundingClientRect();
    const height = Math.ceil(rect.height);
    // Save original paddingTop once and use it as the base.
    if (!document.body.dataset.originalPaddingTop) {
      const computed = window.getComputedStyle(document.body).paddingTop;
      document.body.dataset.originalPaddingTop = computed || "0px";
    }
    const originalPadding = parseFloat(document.body.dataset.originalPaddingTop) || 0;
    document.body.style.paddingTop = `${originalPadding + height}px`;
    // also set a CSS variable so CSS can use it if needed
    document.documentElement.style.setProperty("--site-header-height", `${height}px`);
    document.body.classList.add("has-fixed-header");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadHeaderOnce);
  } else {
    loadHeaderOnce();
  }
  // ensure padding grows/shrinks with window resize
  window.addEventListener("resize", function () {
    adjustBodyForFixedHeader();
  });
})();
