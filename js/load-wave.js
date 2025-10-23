// /js/load-wave.js
(async function () {
  const POSTS_PER_PAGE = 10;
  let currentPage = 1;
  let posts = [];

  async function loadJSON() {
    const res = await fetch('../data/wave-analysis.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load JSON');
    return res.json();
  }

  function detectCoinSymbol(title) {
    const t = title.toLowerCase();
    if (t.includes('bitcoin') || t.includes('btc')) return 'btc';
    if (t.includes('ethereum') || t.includes('eth')) return 'eth';
    if (t.includes('xrp')) return 'xrp';
    if (t.includes('solana') || t.includes('sol')) return 'sol';
    if (t.includes('cardano') || t.includes('ada')) return 'ada';
    return null;
  }

  function createCard(post) {
    const card = document.createElement('article');
    card.className = 'card clickable-card';
    const coin = detectCoinSymbol(post.title);
    const logoSrc = coin ? `../assets/coins/${coin}.svg` : '../assets/coins/generic.png';

    card.innerHTML = `
      <img class="coin-logo" src="${logoSrc}" alt="${coin || 'coin'} logo">
      <div class="kicker">${post.category || 'Analysis'}</div>
      <h3>${post.title}</h3>
      <p>${post.excerpt}</p>
      <div class="meta">
        <div class="muted">${post.date}</div>
        <div class="muted">•</div>
        <div class="muted">${post.author}</div>
      </div>
    `;
    card.addEventListener('click', () => window.location.href = post.url);
    return card;
  }

  function renderPage(page) {
    const grid = document.getElementById('wave-grid');
    grid.innerHTML = '';
    const start = (page - 1) * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const pagePosts = posts.slice(start, end);
    pagePosts.forEach(p => grid.appendChild(createCard(p)));
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPagination() {
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    const container = document.getElementById('pagination');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className = i === currentPage ? 'active' : '';
      btn.addEventListener('click', () => {
        currentPage = i;
        renderPage(currentPage);
      });
      container.appendChild(btn);
    }
  }

  try {
    posts = await loadJSON();
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderPage(currentPage);
  } catch (err) {
    console.error('Error loading posts:', err);
    document.getElementById('wave-grid').innerHTML = `<p class="muted">Failed to load analysis data.</p>`;
  }
})();
