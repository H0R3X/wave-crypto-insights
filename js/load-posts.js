// load-posts.js — dynamically load only analysis articles (homepage)
document.addEventListener('DOMContentLoaded', async () => {
  const postGrid = document.getElementById('post-grid');
  if (!postGrid) return;

  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return await res.json();
  }

  // 🔍 Helper to detect coin symbol from title
  function detectCoinSymbol(title) {
    title = title.toLowerCase();
    if (title.includes('bitcoin') || title.includes('btc')) return 'btc';
    if (title.includes('ethereum') || title.includes('eth')) return 'eth';
    if (title.includes('solana') || title.includes('sol')) return 'sol';
    if (title.includes('xrp') || title.includes('ripple')) return 'xrp';
    return null;
  }

  try {
    // ✅ Load only wave analysis posts
    const wave = await loadJSON('./data/wave-analysis.json');

    // sort by newest date
    wave.sort((a, b) => new Date(b.date) - new Date(a.date));

    // take latest 8
    const latest = wave.slice(0, 8);

    // clear placeholder cards
    postGrid.innerHTML = '';

    // render
    latest.forEach(post => {
      const coinSymbol = detectCoinSymbol(post.title);
      const logoPath = coinSymbol ? `./assets/coins/${coinSymbol}.svg` : null;

      const card = document.createElement('article');
      card.className = 'card clickable-card';
      card.innerHTML = `
        ${logoPath ? `<img src="${logoPath}" alt="${coinSymbol}" class="coin-logo" loading="lazy">` : ''}
        <div class="kicker">${post.category}</div>
        <h3>${post.title}</h3>
        <p>${post.excerpt}</p>
        <div class="meta">
          <div class="muted">${new Date(post.date).toLocaleDateString()}</div>
          <div class="muted">•</div>
          <div class="muted">By ${post.author}</div>
        </div>
      `;

      // Make entire card clickable
      card.addEventListener('click', () => {
        window.location.href = `./wave-analysis/${post.url}`;
      });

      postGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Post loading failed:', err);
    postGrid.innerHTML = '<p class="muted">Failed to load latest analyses.</p>';
  }
});
