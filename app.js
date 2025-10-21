// app.js
// Live tickers (CoinGecko) + global UI helpers (mobile menu toggle, header interactions)
// - Keeps your HTML structure and updates span values only.
// - Also provides the mobile overlay toggle used on all pages.
//
// Note: subpages are one level deep and include this as "../app.js" (you confirmed that).

(function () {
  /* -------------------------
     Helper utilities
     ------------------------- */

  // Safe DOM text setter
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Format numbers for display
  function fmt(n) {
    if (n == null || isNaN(n)) return '--';
    return Math.abs(n) >= 1000
      ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : Number(n).toFixed(2);
  }

  /* -------------------------
     Live tickers (CoinGecko)
     ------------------------- */

  const prev = { btc: null, eth: null, xrp: null };

  // Flash animation helper - applies class to nearest .ticker element
  function flashTicker(sym, direction) {
    const span = document.getElementById(`${sym}-price`);
    if (!span) return;
    const ticker = span.closest('.ticker');
    if (!ticker) return;
    ticker.classList.remove('flash-up', 'flash-down');
    if (direction === 'up') ticker.classList.add('flash-up');
    if (direction === 'down') ticker.classList.add('flash-down');
    // remove after animation (match CSS 500ms)
    setTimeout(() => ticker.classList.remove('flash-up', 'flash-down'), 520);
  }

  // Update a single ticker block
  function updateTicker(sym, price, change) {
    // detect direction vs prev
    if (prev[sym] && typeof prev[sym].price === 'number') {
      if (price > prev[sym].price) flashTicker(sym, 'up');
      else if (price < prev[sym].price) flashTicker(sym, 'down');
    }

    setText(`${sym}-price`, fmt(price));

    // handle change element
    const changeEl = document.getElementById(`${sym}-change`);
    const chText = (typeof change === 'number') ? ((change >= 0 ? '+' : '') + change.toFixed(2) + '%') : '--';
    setText(`${sym}-change`, chText);
    if (changeEl) changeEl.className = (typeof change === 'number' && change >= 0) ? 'muted up' : 'muted down';

    prev[sym] = { price: price, change: change };
  }

  // Fetch prices from CoinGecko and update tickers
  async function fetchAndUpdatePrices() {
    // coins: bitcoin, ethereum, ripple
    const url = 'https://api.coingecko.com/api/v3/simple/price'
      + '?ids=bitcoin,ethereum,ripple'
      + '&vs_currencies=usd'
      + '&include_24hr_change=true';

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Status ' + res.status);
      const data = await res.json();

      if (data.bitcoin && typeof data.bitcoin.usd === 'number') {
        updateTicker('btc', data.bitcoin.usd, data.bitcoin.usd_24h_change);
      }
      if (data.ethereum && typeof data.ethereum.usd === 'number') {
        updateTicker('eth', data.ethereum.usd, data.ethereum.usd_24h_change);
      }
      if (data.ripple && typeof data.ripple.usd === 'number') {
        updateTicker('xrp', data.ripple.usd, data.ripple.usd_24h_change);
      }

      // updated time (if present)
      setText('updated-time', new Date().toLocaleString());
    } catch (err) {
      // Fail gracefully (console log for debugging)
      // eslint-disable-next-line no-console
      console.error('CoinGecko fetch error:', err);
    }
  }

  /* -------------------------
     Mobile menu / overlay toggle
     ------------------------- */

  // Opens the overlay element (if present)
  function openMobileMenu(menuEl) {
    if (!menuEl) return;
    menuEl.classList.add('active');
    // prevent background scrolling while menu open
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    // focus first link for accessibility
    const firstLink = menuEl.querySelector('a');
    if (firstLink) firstLink.focus();
  }

  function closeMobileMenu(menuEl) {
    if (!menuEl) return;
    menuEl.classList.remove('active');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  function setupMobileMenuToggle() {
    // There may be many burger buttons across pages (but only one actual page loaded)
    const burgers = document.querySelectorAll('.burger');
    const mobileMenu = document.getElementById('mobileMenu');

    if (!burgers || burgers.length === 0 || !mobileMenu) {
      // nothing to wire
      return;
    }

    burgers.forEach(b => {
      b.addEventListener('click', (e) => {
        // toggle
        if (mobileMenu.classList.contains('active')) closeMobileMenu(mobileMenu);
        else openMobileMenu(mobileMenu);
      });
    });

    // close when clicking a link inside overlay
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => closeMobileMenu(mobileMenu));
    });

    // close when clicking outside the central nav links (overlay background)
    mobileMenu.addEventListener('click', (ev) => {
      if (ev.target === mobileMenu) closeMobileMenu(mobileMenu);
    });

    // close on ESC
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && mobileMenu.classList.contains('active')) {
        closeMobileMenu(mobileMenu);
      }
    });
  }

  /* -------------------------
     Read latest button (smooth scroll)
     ------------------------- */

  function setupReadLatest() {
    const readBtn = document.getElementById('read-latest');
    if (!readBtn) return;
    readBtn.addEventListener('click', () => {
      // scroll to first article card
      const first = document.querySelector('#post-grid article, #wave-grid article, .post-grid article');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* -------------------------
     Init when DOM ready
     ------------------------- */

  function init() {
    // init live prices
    fetchAndUpdatePrices();
    // refresh every 60s
    setInterval(fetchAndUpdatePrices, 60000);

    // UI wiring
    setupMobileMenuToggle();
    setupReadLatest();

    // share button wiring (if present)
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (navigator.share) {
          navigator.share({ title: document.title, text: 'Latest from Wave Crypto Insights', url: location.href }).catch(() => {});
        } else {
          // fallback copy URL
          try {
            navigator.clipboard.writeText(location.href);
            alert('Link copied to clipboard.');
          } catch (e) {
            // ignore
          }
        }
      });
    }

        // ✅ Image viewer setup
    const viewer = document.getElementById('imageViewer');
    if (viewer) {
      const viewerImg = viewer.querySelector('img');
      document.querySelectorAll('.viewable-img').forEach(img => {
        img.addEventListener('click', () => {
          viewerImg.src = img.src;
          viewer.classList.add('active');
        });
      });
      viewer.addEventListener('click', () => {
        viewer.classList.remove('active');
        setTimeout(() => viewerImg.src = '', 250);
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') viewer.classList.remove('active');
      });
    }

  }

  // DOM ready safe init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
