// app.js — live tickers for BTC, ETH, XRP

(function () {
  function fmt(n) {
    if (n == null) return '--';
    return Math.abs(n) >= 1000
      ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : n.toFixed(2);
  }

  const prev = { btc: null, eth: null, xrp: null };

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function flashTicker(sym, direction) {
    const span = document.getElementById(`${sym}-price`);
    if (!span) return;
    const ticker = span.closest('.ticker');
    if (!ticker) return;
    ticker.classList.remove('flash-up', 'flash-down');
    if (direction === 'up') ticker.classList.add('flash-up');
    if (direction === 'down') ticker.classList.add('flash-down');
    setTimeout(() => ticker.classList.remove('flash-up', 'flash-down'), 520);
  }

  function updateTicker(sym, price, change) {
    if (prev[sym] && typeof prev[sym].price === 'number') {
      if (price > prev[sym].price) flashTicker(sym, 'up');
      else if (price < prev[sym].price) flashTicker(sym, 'down');
    }
    setText(`${sym}-price`, fmt(price));
    setText(`${sym}-change`, (change >= 0 ? '+' : '') + change.toFixed(2) + '%');
    const chEl = document.getElementById(`${sym}-change`);
    if (chEl) chEl.className = change >= 0 ? 'muted up' : 'muted down';
    prev[sym] = { price, change };
  }

  async function fetchAndUpdate() {
    const url = 'https://api.coingecko.com/api/v3/simple/price'
      + '?ids=bitcoin,ethereum,ripple'
      + '&vs_currencies=usd'
      + '&include_24hr_change=true';
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      updateTicker('btc', data.bitcoin.usd, data.bitcoin.usd_24h_change);
      updateTicker('eth', data.ethereum.usd, data.ethereum.usd_24h_change);
      updateTicker('xrp', data.ripple.usd, data.ripple.usd_24h_change);
      setText('updated-time', new Date().toLocaleString());
    } catch (err) {
      console.error('Failed fetch:', err);
    }
  }

  function init() {
    fetchAndUpdate();
    setInterval(fetchAndUpdate, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// ✅ Mobile Menu Toggle
document.addEventListener("DOMContentLoaded", () => {
  const burger = document.getElementById("burgerBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  if (!burger || !mobileMenu) return;

  burger.addEventListener("click", () => {
    mobileMenu.classList.toggle("active");
  });

  // Close menu when clicking a link
  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("active");
    });
  });
});
