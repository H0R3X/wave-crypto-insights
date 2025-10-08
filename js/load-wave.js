// /js/load-wave.js
(async function () {
  async function loadJSON() {
    const res = await fetch('../data/wave-analysis.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load JSON');
    return res.json();
  }

  function createCard(post) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="kicker">${post.category}</div>
      <h3>${post.title}</h3>
      <p>${post.excerpt}</p>
      <div class="meta">
        <div class="muted">${post.date}</div>
        <div class="muted">•</div>
        <div class="muted">${post.author}</div>
      </div>
      <a href="${post.url}" class="pill" style="width:max-content;margin-top:4px;">Read More →</a>
    `;
    return card;
  }

  try {
    const posts = await loadJSON();
    const grid = document.getElementById('wave-grid');
    posts.forEach(p => grid.appendChild(createCard(p)));
  } catch (err) {
    console.error('Error loading posts:', err);
  }
})();
