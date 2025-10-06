// app.js — live tickers (CoinGecko) with subtle flash effect
// Keeps your HTML structure, updates span values only.
// Uses 'bitcoin', 'ethereum', 'pax-gold' from CoinGecko and displays them as BTC / ETH / XAU labels in the UI.

(function () {
  // Helper: format numbers nicely
  function fmt(n) {
    if (n === null || n === undefined) return '--';
    // large numbers with commas, else 2 decimals
    return Math.abs(n) >= 1000
      ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : n.toFixed(2);
  }

  // Store previous prices to detect up / down
  const prev = { btc: null, eth: null, gold: null };

  // Safely update DOM pieces if they exist
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Add and remove flash classes on the ticker container (not the small span)
  function flashTicker(sym, direction) {
    const span = document.getElementById(`${sym}-price`);
    if (!span) return;
    const ticker = span.closest('.ticker');
    if (!ticker) return;
    // Clear existing classes first
    ticker.classList.remove('flash-up', 'flash-down');
    if (direction === 'up') ticker.classList.add('flash-up');
    if (direction === 'down') ticker.classList.add('flash-down');
    // remove after animation time (match CSS 500ms)
    setTimeout(() => ticker.classList.remove('flash-up', 'flash-down'), 520);
  }

  // Update a single ticker (span contains numeric part only; outer HTML includes the "$")
  function updateTicker(sym, price, change) {
    // sym: 'btc'|'eth'|'gold'
    // price: number, change: percent (e.g., 1.23)
    const priceId = `${sym}-price`; // e.g., 'btc-price' -> span in your HTML
    const changeId = `${sym}-change`;

    // decide flash direction
    if (prev[sym] != null && typeof prev[sym].price === 'number') {
      if (price > prev[sym].price) flashTicker(sym, 'up');
      else if (price < prev[sym].price) flashTicker(sym, 'down');
    }

    // set numeric text (no $ here — your HTML already contains the $)
    setText(priceId, fmt(price));

    // set change text with 2 decimals and sign
    const chText = (change >= 0 ? '+' : '') + (typeof change === 'number' ? change.toFixed(2) : '--') + '%';
    setText(changeId, chText);

    // color class for change element: 'muted up' or 'muted down'
    const chEl = document.getElementById(changeId);
    if (chEl) {
      chEl.className = (change >= 0) ? 'muted up' : 'muted down';
    }

    // update prev
    prev[sym] = { price: price, change: change };
  }

  // Fetch prices from CoinGecko and update tickers
  async function fetchAndUpdate() {
    // coins: bitcoin, ethereum, pax-gold (we display as XAU)
    const url = 'https://api.coingecko.com/api/v3/simple/price'
      + '?ids=bitcoin,ethereum,pax-gold'
      + '&vs_currencies=usd'
      + '&include_24hr_change=true';

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Network response was not ok: ' + res.status);
      const data = await res.json();

      // Defensive checks
      const btc = data.bitcoin && data.bitcoin.usd;
      const btcCh = data.bitcoin && data.bitcoin.usd_24h_change;
      const eth = data.ethereum && data.ethereum.usd;
      const ethCh = data.ethereum && data.ethereum.usd_24h_change;
      const pax = data['pax-gold'] && data['pax-gold'].usd;
      const paxCh = data['pax-gold'] && data['pax-gold'].usd_24h_change;

      if (btc != null) updateTicker('btc', btc, btcCh ?? 0);
      if (eth != null) updateTicker('eth', eth, ethCh ?? 0);
      if (pax != null) updateTicker('gold', pax, paxCh ?? 0);

      // update time string (keeps the same <span id="updated-time">)
      const updatedEl = document.getElementById('updated-time');
      if (updatedEl) updatedEl.textContent = new Date().toLocaleString();

    } catch (err) {
      // Fail gracefully — log error and leave existing numbers
      // You can also show a small message to user if desired.
      // console.error for debugging
      // eslint-disable-next-line no-console
      console.error('Failed to fetch CoinGecko prices:', err);
    }
  }

  // DOM safe: run when DOM ready
  function init() {
    // initial populate with existing values if demo exists (keeps fallback)
    // call fetch once and then set interval
    fetchAndUpdate();
    // refresh every 60 seconds
    setInterval(fetchAndUpdate, 60000);

    // wire up buttons only if present
    const readBtn = document.getElementById('read-latest');
    if (readBtn) {
      readBtn.addEventListener('click', () => {
        const first = document.querySelector('#post-grid article');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (navigator.share) {
          navigator.share({ title: document.title, text: 'Latest from Wave Crypto Insights', url: location.href }).catch(() => {});
        } else {
          // fallback
          // eslint-disable-next-line no-alert
          alert('Use your browser share or copy the URL.');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
