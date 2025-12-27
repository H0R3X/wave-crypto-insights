// wave-analysis/js/load-coin.js
(async function () {

  const qs = id => document.getElementById(id);

  function getCoinFromURL() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('coin') || 'btc').toLowerCase();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function escapeHTML(str = '') {
    return str.replace(/[&<>"']/g, m =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])
    );
  }

  function statusBadge(status = '') {
    const s = status.toLowerCase();
    let cls = 'badge-neutral';
    if (s === 'active') cls = 'badge-active';
    if (s === 'completed') cls = 'badge-completed';
    if (s === 'invalidated') cls = 'badge-invalid';

    return status
      ? `<span class="status-badge ${cls}">${escapeHTML(status)}</span>`
      : '';
  }

  /* =========================
     SHARE HANDLER
  ========================= */
  function setupShareButtons() {
    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const title = btn.dataset.title;
        const url = btn.dataset.url;

        if (navigator.share) {
          try {
            await navigator.share({
              title,
              text: `${title} — Elliott Wave analysis`,
              url
            });
            return;
          } catch (_) {}
        }

        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(url);
            btn.textContent = 'Link copied';
            setTimeout(() => (btn.textContent = 'Share'), 1500);
            return;
          } catch (_) {}
        }

        try {
          const input = document.createElement('input');
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);

          btn.textContent = 'Link copied';
          setTimeout(() => (btn.textContent = 'Share'), 1500);
        } catch {
          alert('Unable to copy link');
        }
      });
    });
  }

  /* =========================
     SCHEMA.ORG ARTICLE (LATEST ONLY)
  ========================= */
  function injectArticleSchema(analysis, coinName) {
    if (!analysis || !analysis.title || !analysis.date) return;

    const existing = document.getElementById('analysis-schema');
    if (existing) existing.remove();

    const imageUrl = analysis.images?.before
      ? `${location.origin}/assets/analysis/${analysis.images.before}`
      : undefined;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": analysis.title,
      "description": analysis.summary || `${coinName} Elliott Wave analysis`,
      "datePublished": analysis.date,
      "dateModified": analysis.date,
      "author": {
        "@type": "Organization",
        "name": "Wave Crypto Insights"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Wave Crypto Insights",
        "logo": {
          "@type": "ImageObject",
          "url": `${location.origin}/assets/main-logo.png`
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${location.origin}${location.pathname}?coin=${getCoinFromURL()}`
      },
      "about": {
        "@type": "Thing",
        "name": coinName
      }
    };

    if (imageUrl) {
      schema.image = imageUrl;
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'analysis-schema';
    script.textContent = JSON.stringify(schema, null, 2);

    document.head.appendChild(script);
  }

  //--------------------------------------------------------------------------------------------------------
  /* =========================
   🧭 BREADCRUMB SCHEMA
========================= */
function injectBreadcrumbSchema(analysis, coinName) {
  if (!analysis || !analysis.title) return;

  const existing = document.getElementById('breadcrumb-schema');
  if (existing) existing.remove();

  const coinKey = getCoinFromURL();
  const pageUrl = `${location.origin}${location.pathname}?coin=${coinKey}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": `${location.origin}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Wave Analysis",
        "item": `${location.origin}/wave-analysis/wave-analysis.html`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": coinName,
        "item": pageUrl
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": analysis.title,
        "item": `${pageUrl}#${analysis.id}`
      }
    ]
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'breadcrumb-schema';
  script.textContent = JSON.stringify(schema, null, 2);

  document.head.appendChild(script);
}

  //-----------------------------------------------------------------------------------------------------------

  /* =========================
     RENDER ANALYSIS
  ========================= */
  function renderAnalysis(container, analysis, coinName, isLatest = false) {

    const shareUrl =
      `${location.origin}${location.pathname}?coin=${getCoinFromURL()}#${analysis.id}`;

    container.innerHTML = `
      <article class="analysis-block" id="${analysis.id}">

        <div class="analysis-header">
          <h3>${escapeHTML(analysis.title)}</h3>
          <button
            class="share-btn"
            data-title="${escapeHTML(analysis.title)}"
            data-url="${shareUrl}"
            aria-label="Share analysis">
            Share
          </button>
        </div>

        <div class="muted small">
          ${formatDate(analysis.date)} • ${analysis.timeframe}
          ${analysis.bias ? `• ${escapeHTML(analysis.bias)}` : ''}
          ${statusBadge(analysis.status)}
        </div>

        ${analysis.summary
          ? `<p class="analysis-summary">${escapeHTML(analysis.summary)}</p>`
          : ''}

        ${Array.isArray(analysis.body) && analysis.body.length
          ? `
            <div class="analysis-body">
              ${analysis.body.map(p => `<p>${escapeHTML(p)}</p>`).join('')}
            </div>
          `
          : ''}

        ${analysis.images?.before
          ? `
            <img
              src="../assets/analysis/${analysis.images.before}"
              alt="${coinName} wave analysis"
              class="viewable-img"
            >
          `
          : ''}

        ${Array.isArray(analysis.scenarios) && analysis.scenarios.length
          ? `
            <div class="scenario-section">
              <h4>Scenarios</h4>
              ${analysis.scenarios.map(s => `
                <div class="scenario-card">
                  <div class="scenario-header">
                    <strong>${escapeHTML(s.label)}</strong>
                    ${s.bias ? `<span class="muted small"> • ${escapeHTML(s.bias)}</span>` : ''}
                  </div>
                  <p>${escapeHTML(s.text)}</p>
                  ${s.image
                    ? `<img src="../assets/analysis/${s.image}" class="viewable-img" alt="">`
                    : ''}
                </div>
              `).join('')}
            </div>
          `
          : ''}

        ${(analysis.confidence || analysis.status)
          ? `<div class="analysis-status muted small">
              ${analysis.confidence ? `Confidence: <strong>${escapeHTML(analysis.confidence)}</strong>` : ''}
            </div>`
          : ''}
      </article>
    `;

    if (window.setupImageViewer) window.setupImageViewer();
    setTimeout(setupShareButtons, 0);

    if (isLatest) {
      injectArticleSchema(analysis, coinName);
      injectBreadcrumbSchema(analysis, coinName);
    }
  }

  /* =========================
     LOAD DATA
  ========================= */
  const coinKey = getCoinFromURL();
  const dataPath = `./data/${coinKey}.json`;

  let data;
  try {
    const res = await fetch(dataPath, { cache: 'no-store' });
    if (!res.ok) throw new Error('JSON not found');
    data = await res.json();
  } catch {
    qs('analysis-latest').innerHTML = `<p class="muted">Analysis data not available.</p>`;
    return;
  }

  qs('coin-title').textContent = `${data.coin} (${data.symbol})`;
  qs('coin-sub').textContent = data.description || 'Elliott Wave Analysis';
  qs('coin-logo').src = `../assets/coins/${coinKey}.svg`;

  const updates = Array.isArray(data.updates) ? data.updates : [];
  const latest = qs('analysis-latest');
  const history = qs('analysis-list');

  if (!updates.length) {
    latest.innerHTML = `<p class="muted">No analysis published yet.</p>`;
    history.innerHTML = '';
    return;
  }

  updates.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Render latest + schema
  renderAnalysis(latest, updates[0], data.coin, true);

  history.innerHTML = updates.slice(1).map((u, i) => `
    <div class="history-item" data-index="${i + 1}">
      <div class="history-header">
        <div class="small muted">
          ${formatDate(u.date)} • ${u.timeframe}
          ${statusBadge(u.status)}
        </div>
        <div class="history-title">${escapeHTML(u.title)}</div>
      </div>
      <div class="history-content" hidden></div>
    </div>
  `).join('');

  let activeHistoryIndex = null;

  history.addEventListener('click', e => {
    const item = e.target.closest('.history-item');
    if (!item) return;

    const index = Number(item.dataset.index);
    const analysis = updates[index];
    if (!analysis) return;

    const content = item.querySelector('.history-content');
    const isOpen = !content.hasAttribute('hidden');
    const isSame = activeHistoryIndex === index;

    document.querySelectorAll('.history-content').forEach(c => {
      c.setAttribute('hidden', '');
      c.innerHTML = '';
    });

    document.querySelectorAll('.history-item')
      .forEach(i => i.classList.remove('active'));

    if (isOpen && isSame) {
      activeHistoryIndex = null;
      return;
    }

    item.classList.add('active');
    content.removeAttribute('hidden');
    renderAnalysis(content, analysis, data.coin, false);
    activeHistoryIndex = index;
  });

})();
