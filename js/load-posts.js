// load-posts.js — dynamically load articles onto homepage
document.addEventListener('DOMContentLoaded', async () => {
  const postGrid = document.getElementById('post-grid');
  if (!postGrid) return;

  async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return await res.json();
  }

  try {
    // Load data from all three JSON files
    const [wave, projects, news] = await Promise.all([
      loadJSON('./data/wave-analysis.json'),
      loadJSON('./data/projects.json'),
      loadJSON('./data/news.json')
    ]);

    const allPosts = [...wave, ...projects, ...news];
    // sort by newest date
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // take latest 8
    const latest = allPosts.slice(0, 8);

    // clear placeholder cards
    postGrid.innerHTML = '';

    // render
    latest.forEach(post => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="kicker">Crypto • ${post.category}</div>
        <h3>${post.title}</h3>
        <p>${post.excerpt}</p>
        <div class="meta">
          <div class="muted">${new Date(post.date).toLocaleDateString()}</div>
          <div class="muted">•</div>
          <div class="muted">By ${post.author}</div>
        </div>
      `;
      card.addEventListener('click', () => window.location.href = post.link);
      postGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Post loading failed:', err);
    postGrid.innerHTML = '<p class="muted">Failed to load latest posts.</p>';
  }
});
