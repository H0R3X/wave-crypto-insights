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

  function renderAnalysis(container, analysis, coinName) {
  container.innerHTML = `
    <article class="analysis-block">

      <!-- Title -->
      <h3>${escapeHTML(analysis.title)}</h3>

      <!-- Meta -->
      <div class="muted small">
        ${formatDate(analysis.date)} • ${analysis.timeframe}
        ${analysis.bias ? `• ${escapeHTML(analysis.bias)}` : ''}
        ${statusBadge(analysis.status)}
      </div>

      <!-- Summary -->
      ${analysis.summary
        ? `<p class="analysis-summary">${escapeHTML(analysis.summary)}</p>`
        : ''}

      <!-- Detailed explanation -->
      ${Array.isArray(analysis.body) && analysis.body.length
        ? `
          <div class="analysis-body">
            ${analysis.body.map(p => `<p>${escapeHTML(p)}</p>`).join('')}
          </div>
        `
        : ''}

      <!-- Legacy single image support -->
      ${analysis.images?.before
        ? `
          <img
            src="../assets/analysis/${analysis.images.before}"
            alt="${coinName} wave analysis"
            class="viewable-img"
          >
        `
        : ''}

      <!-- Scenarios -->
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
                  ? `
                    <img
                      src="../assets/analysis/${s.image}"
                      alt="${coinName} ${escapeHTML(s.label)} scenario"
                      class="viewable-img"
                    >
                  `
                  : ''}
              </div>
            `).join('')}
          </div>
        `
        : ''}

      <!-- Footer -->
      ${(analysis.confidence || analysis.status)
        ? `
          <div class="analysis-status muted small">
            ${analysis.confidence
              ? `Confidence: <strong>${escapeHTML(analysis.confidence)}</strong>`
              : ''}
          </div>
        `
        : ''}

    </article>
  `;

  if (window.setupImageViewer) window.setupImageViewer();
}


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

  renderAnalysis(latest, updates[0], data.coin);

  history.innerHTML = updates.slice(1).map((u, i) => `
    <div class="history-item" data-index="${i + 1}">
      <div class="history-header">
        <div class="small muted">
          ${formatDate(u.date)} • ${u.timeframe}
          ${statusBadge(u.status)}
        </div>
        <div class="history-title">${escapeHTML(u.title)}</div>
      </div>

      <div class="history-preview" hidden>
        ${u.summary ? `<p class="muted small">${escapeHTML(u.summary)}</p>` : ''}
        ${u.images?.before ? `
          <img
            src="../assets/analysis/${u.images.before}"
            class="viewable-img"
            alt="Preview chart"
          >
        ` : ''}
      </div>
    </div>
  `).join('');

let activeHistoryIndex = null;

history.addEventListener('click', e => {
  const item = e.target.closest('.history-item');
  if (!item) return;

  const index = Number(item.dataset.index);
  const analysis = updates[index];
  if (!analysis) return;

  const preview = item.querySelector('.history-preview');
  const isOpen = !preview.hasAttribute('hidden');
  const isSameItem = activeHistoryIndex === index;

  // Reset all
  document.querySelectorAll('.history-preview')
    .forEach(p => p.setAttribute('hidden', ''));

  document.querySelectorAll('.history-item')
    .forEach(i => i.classList.remove('active'));

  // Collapse same item → clear active
  if (isOpen && isSameItem) {
    activeHistoryIndex = null;
    return;
  }

  // Activate new item
  item.classList.add('active');
  preview.removeAttribute('hidden');
  activeHistoryIndex = index;

});



})();
