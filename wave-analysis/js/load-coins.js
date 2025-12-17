// wave-analysis/js/load-coins.js
(async function () {
  const grid = document.getElementById('wave-grid');
  if (!grid) return;

  async function loadCoins() {
    const res = await fetch('./data/coins.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load coins.json');
    return res.json();
  }

  function createCoinCard(coin) {
    const card = document.createElement('article');
    card.className = 'card clickable-card analysis-card';

    // blurred background
    card.style.setProperty('--bg-image', `url(${coin.thumb})`);

    card.innerHTML = `
      <img class="coin-logo" src="${coin.logo}" alt="${coin.name} logo">
      <div class="kicker">${coin.market}</div>
      <h3>${coin.name} <span class="muted">(${coin.symbol})</span></h3>
      <p>${coin.description}</p>
    `;

    card.addEventListener('click', () => {
      window.location.href = `./coin.html?coin=${coin.id}`;
    });

    return card;
  }

  try {
    const coins = await loadCoins();

    coins
      .sort((a, b) => (a.priority || 99) - (b.priority || 99))
      .forEach(c => grid.appendChild(createCoinCard(c)));

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="muted">Failed to load analysis.</p>`;
  }
})();
