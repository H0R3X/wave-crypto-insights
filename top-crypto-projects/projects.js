// projects.js — Load JSON + Search + Filter + Sort + Pagination
document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchProject");
  const categorySelect = document.getElementById("categoryFilter");
  const grid = document.getElementById("projects-grid");
  const pagination = document.getElementById("pagination");
  const FILTER_BAR = document.querySelector(".search-filter-bar");

  let projects = [];
  let filtered = [];
  let currentPage = 1;
  const ITEMS_PER_PAGE = 12;

  /* --------------------------
     SORT DROPDOWN
  ---------------------------*/
  function createSortDropdown() {
    const select = document.createElement("select");
    select.id = "sortProjects";
    select.className = "sort-dropdown";

    select.innerHTML = `
      <option value="">Sort: Default</option>
      <option value="alphabetical">A → Z</option>
      <option value="marketcap">Market Cap (desc)</option>
    `;

    // styling
    select.style.padding = "10px 14px";
    select.style.borderRadius = "10px";
    select.style.border = "1px solid rgba(255,255,255,0.1)";
    select.style.background = "rgba(255,255,255,0.06)";
    select.style.color = "rgb(102,100,100)";

    FILTER_BAR.appendChild(select);
    return select;
  }
  const sortSelect = createSortDropdown();


  /* --------------------------
     UTILS
  ---------------------------*/
  function escapeHTML(s) {
    if (!s && s !== 0) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssClass(name) {
    return (name || "").toLowerCase().replace(/\s+/g, "");
  }

  function formatShort(n) {
    if (n === undefined || n === null || isNaN(n)) return "--";
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return Number(n).toString();
  }


  /* --------------------------
     LOAD PROJECTS JSON
  ---------------------------*/
  async function loadProjects() {
    try {
      const res = await fetch("../data/projects.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Status ${res.status}`);

      projects = await res.json();

      projects = projects.map(p => {
        const slug = p.slug || (p.name ? p.name.toLowerCase().replace(/\s+/g, "-") : "");

        return {
          ...p,
          categories: Array.isArray(p.categories) ? p.categories : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
          tokenomics: p.tokenomics || {},
          page: p.page || `./${slug}.html`,
          logo: p.logo || "../assets/default-logo.png"
        };
      });

      filtered = [...projects];
      render();
    } catch (err) {
      console.error("Failed to load projects.json", err);
      grid.innerHTML = `<article class="card"><p class="muted">Failed to load projects list.</p></article>`;
    }
  }


  /* --------------------------
     CREATE CARD (UPDATED)
  ---------------------------*/
  function createCard(project) {
    const card = document.createElement("article");
    card.classList.add("project-card", "clickable-card");
    card.dataset.category = project.categories[0] || "";

    // tokenomics
    const circ = project.tokenomics?.circulating ?? null;
    const total = project.tokenomics?.total ?? null;
    const percent = (circ && total)
      ? Math.min(100, Math.round((circ / total) * 100))
      : null;

    card.innerHTML = `
      <div class="card-body" style="flex:1; display:flex; flex-direction:column;">

        <a href="${escapeHTML(project.page)}" class="project-link">
          <img src="${escapeHTML(project.logo)}" alt="${escapeHTML(project.name)} logo" class="coin-logo" />
        </a>

        <h3 style="margin-top:35px;">
          <a href="${escapeHTML(project.page)}">
            ${escapeHTML(project.name)}
            <span class="muted">(${escapeHTML(project.symbol)})</span>
          </a>
        </h3>

        <p class="muted project-desc">${escapeHTML(project.description)}</p>

        <div class="meta-row" style="display:flex; gap:10px; align-items:center; margin-top:8px;">
          <div class="muted small">Status: <strong>${escapeHTML(project.status || "—")}</strong></div>
          <div class="muted small">Updated: ${escapeHTML(project.updated || "—")}</div>
        </div>

        <div class="tags" style="margin-top:8px;">
          ${project.categories
            .map(cat => `<span class="tag tag-${cssClass(cat)}">${escapeHTML(cat)}</span>`)
            .join("")}
        </div>

        <div class="tokenomics-preview" style="margin-top:10px;">
          ${
            circ && total
              ? `
                <div class="tok-row small muted">
                  Circulating / Total: ${formatShort(circ)} / ${formatShort(total)} (${percent}%)
                </div>
                <div class="tok-bar">
                  <div class="tok-fill" style="width:${percent}%"></div>
                </div>
            `
              : `<div class="small muted">Tokenomics: <em>details on project page</em></div>`
          }
        </div>

      </div>

      <div class="card-footer" style="margin-top:auto; display:flex; align-items:center; padding-top:10px;">
        <a href="${escapeHTML(project.page)}" class="btn-small">View Analysis</a>
      </div>
    `;

    return card;
  }


  /* --------------------------
     FILTER + SORT
  ---------------------------*/
  function applyFilters() {
    const query = (searchInput.value || "").toLowerCase();
    const category = categorySelect.value;
    const sort = sortSelect.value;

    filtered = projects.filter(p => {
      if (p.status && p.status !== "published") return false;

      const hay =
        (p.name || "") +
        " " +
        (p.symbol || "") +
        " " +
        (p.description || "") +
        " " +
        (p.tags || []).join(" ");

      const matchSearch = !query || hay.toLowerCase().includes(query);
      const matchCategory = !category || (p.categories || []).includes(category);

      return matchSearch && matchCategory;
    });

    if (sort === "alphabetical") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "marketcap") {
      filtered.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    }

    currentPage = 1;
    render();
  }


  /* --------------------------
     RENDER GRID
  ---------------------------*/
  function render() {
    grid.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    filtered.slice(start, end).forEach(project => {
      grid.appendChild(createCard(project));
    });

    renderPagination(totalPages);
  }


  /* --------------------------
     PAGINATION
  ---------------------------*/
  function renderPagination(totalPages) {
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    const prev = document.createElement("button");
    prev.innerText = "‹";
    prev.disabled = currentPage === 1;
    prev.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    pagination.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.innerText = i;
      if (i === currentPage) btn.classList.add("active");

      btn.onclick = () => {
        currentPage = i;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };

      pagination.appendChild(btn);
    }

    const next = document.createElement("button");
    next.innerText = "›";
    next.disabled = currentPage === totalPages;
    next.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    pagination.appendChild(next);
  }


  /* --------------------------
     LISTENERS
  ---------------------------*/
  searchInput.addEventListener("input", applyFilters);
  categorySelect.addEventListener("change", applyFilters);
  sortSelect.addEventListener("change", applyFilters);

  await loadProjects();
});
