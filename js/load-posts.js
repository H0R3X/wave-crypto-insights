// js/load-posts.js
// Loads latest analysis cards on homepage from /data/latest-index.json
// + Injects Schema.org Article markup (JSON-LD)

(async function () {
  const grid = document.getElementById('post-grid');
  const emptyMsg = document.getElementById('no-posts-msg');

  if (!grid) return;

  function escapeHTML(str = '') {
    return str.replace(/[&<>"']/g, m =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])
    );
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  try {
    const res = await fetch('./data/latest-index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Index not found');

    const data = await res.json();
    const posts = Array.isArray(data.posts) ? data.posts : [];

    if (!posts.length) {
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    const latest = posts.slice(0, 8);

    /* =========================
       Render cards (UNCHANGED)
    ========================= */
    grid.innerHTML = latest.map(post => {
      const coinLogo = post.coinKey
        ? `/assets/coins/${post.coinKey}.svg`
        : '';

      return `
        <article class="card post-card clickable-card">
          <a href="${post.url}" class="post-link">

            ${coinLogo ? `
              <img
                src="${coinLogo}"
                alt="${escapeHTML(post.coin)} logo"
                class="coin-logo"
                loading="lazy"
                onerror="this.style.display='none'"
              >
            ` : ''}

            ${post.image ? `
              <img
                src="${post.image}"
                alt="${escapeHTML(post.title)}"
                class="post-thumb"
              >
            ` : ''}

            <div class="post-body">
              <div class="post-meta small muted">
                ${escapeHTML(post.coin)} • ${post.timeframe}
                ${statusBadge(post.status)}
              </div>

              <h3 class="post-title">
                ${escapeHTML(post.title)}
              </h3>

              <p class="post-excerpt muted">
                ${escapeHTML(post.summary || '')}
              </p>

              <div class="post-footer small muted">
                ${formatDate(post.date)}
              </div>
            </div>

          </a>
        </article>
      `;
    }).join('');

    /* =========================
       ✅ Schema.org JSON-LD
    ========================= */
    const schemaArticles = latest.map(post => ({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": post.summary || '',
      "image": post.image ? location.origin + post.image : undefined,
      "datePublished": post.date,
      "author": {
        "@type": "Organization",
        "name": "Wave Crypto Insights"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Wave Crypto Insights",
        "logo": {
          "@type": "ImageObject",
          "url": location.origin + "/assets/main-logo.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": location.origin + post.url
      }
    }));

    const schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.textContent = JSON.stringify(schemaArticles, null, 2);
    document.head.appendChild(schemaScript);

  } catch (err) {
    console.error('Failed to load latest-index.json', err);
    if (emptyMsg) emptyMsg.style.display = 'block';
  }

})();
