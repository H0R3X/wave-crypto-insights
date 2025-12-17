// /wave-analysis/js/load-coin.js
(async function () {
  const params = new URLSearchParams(window.location.search);
  const coin = params.get('coin');

  if (!coin) return;

  try {
    const res = await fetch(`./data/${coin}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Missing coin data');

    const data = await res.json();

    document.title = `${data.name} Wave Analysis — Wave Crypto Insights`;

    document.getElementById('coin-logo').src = data.logo;
    document.getElementById('coin-title').textContent = data.name;
    document.getElementById('coin-sub').textContent = data.symbol.toUpperCase() + ' • ' + data.market;

    // Latest
    const latest = data.analyses[0];
    document.getElementById('analysis-content').innerHTML = `
      <p class="muted">${latest.date}</p>
      <p>${latest.text}</p>
      ${latest.image ? `<img src="${latest.image}" class="viewable-img">` : ''}
    `;

    // History
    const list = document.getElementById('analysis-list');
    data.analyses.slice(1).forEach(a => {
      const el = document.createElement('div');
      el.className = 'timeline-item';
      el.innerHTML = `
        <h4>${a.title}</h4>
        <p class="muted">${a.date}</p>
      `;
      list.appendChild(el);
    });

  } catch (err) {
    console.error(err);
  }
})();
