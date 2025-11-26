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

      setText('updated-time', new Date().toLocaleString());
    } catch (err) {
      console.error('CoinGecko fetch error:', err);
    }
  }

  /* -------------------------
     Mobile menu / overlay toggle
     ------------------------- */

  function openMobileMenu(menuEl) {
    if (!menuEl) return;
    menuEl.classList.add('active');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
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
    const burgers = document.querySelectorAll('.burger');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!burgers || burgers.length === 0 || !mobileMenu) return;

    burgers.forEach(b => {
      b.addEventListener('click', () => {
        if (mobileMenu.classList.contains('active')) closeMobileMenu(mobileMenu);
        else openMobileMenu(mobileMenu);
      });
    });

    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => closeMobileMenu(mobileMenu));
    });

    mobileMenu.addEventListener('click', (ev) => {
      if (ev.target === mobileMenu) closeMobileMenu(mobileMenu);
    });

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
      const first = document.querySelector('#post-grid article, #wave-grid article, .post-grid article');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* -------------------------
     Lazy-load mid-feed ad (performance optimization)
     ------------------------- */

  function setupLazyAdLoad() {
    const lazyAd = document.querySelector('.ad-slot.lazy-ad');
    if (!lazyAd) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // ✅ Load AdSense or any other ad only when visible
          lazyAd.innerHTML = '<!-- Ad placeholder (lazy-loaded) -->';
          // Example (for future integration):
          // lazyAd.innerHTML = `<ins class="adsbygoogle"
          //      style="display:block"
          //      data-ad-client="ca-pub-XXXX"
          //      data-ad-slot="XXXX"
          //      data-ad-format="auto"
          //      data-full-width-responsive="true"></ins>`;
          // (adsbygoogle = window.adsbygoogle || []).push({});
          obs.unobserve(lazyAd);
        }
      });
    }, { rootMargin: '200px' }); // trigger slightly before visible

    observer.observe(lazyAd);
  }

 
//   /* -------------------------
//    Image viewer setup (zoomable + rotatable)
//    ------------------------- */
// function setupImageViewer() {
//   const viewer = document.getElementById('imageViewer');
//   if (!viewer) return;

//   const viewerImg = viewer.querySelector('img');
//   let scale = 1, rotation = 0, originX = 0, originY = 0, isDragging = false, startX, startY;

//   // Create toolbar
//   const toolbar = document.createElement('div');
//   toolbar.className = 'viewer-toolbar';
//   toolbar.innerHTML = `
//     <button class="viewer-btn" data-action="zoom-in">＋</button>
//     <button class="viewer-btn" data-action="zoom-out">－</button>
//     <button class="viewer-btn" data-action="rotate-left">⟲</button>
//     <button class="viewer-btn" data-action="rotate-right">⟳</button>
//     <button class="viewer-btn" data-action="reset">⤾</button>
//     <button class="viewer-btn" data-action="close">✕</button>
//   `;
//   viewer.appendChild(toolbar);

//   // Helper to update image transform
//   function updateTransform() {
//     viewerImg.style.transform = `translate(${originX}px, ${originY}px) scale(${scale}) rotate(${rotation}deg)`;
//   }

//   // Open viewer
//   document.querySelectorAll('.viewable-img').forEach(img => {
//     img.addEventListener('click', () => {
//       viewerImg.src = img.src;
//       scale = 1; rotation = 0; originX = 0; originY = 0;
//       updateTransform();
//       viewer.classList.add('active');
//     });
//   });

//   // Close viewer
//   toolbar.querySelector('[data-action="close"]').addEventListener('click', () => {
//     viewer.classList.remove('active');
//     setTimeout(() => (viewerImg.src = ''), 250);
//   });

//   // Button actions
//   toolbar.addEventListener('click', e => {
//     if (!e.target.dataset.action) return;
//     switch (e.target.dataset.action) {
//       case 'zoom-in': scale *= 1.25; break;
//       case 'zoom-out': scale = Math.max(1, scale / 1.25); break;
//       case 'rotate-left': rotation -= 90; break;
//       case 'rotate-right': rotation += 90; break;
//       case 'reset': scale = 1; rotation = 0; originX = 0; originY = 0; break;
//     }
//     updateTransform();
//   });

//   // Drag (pan) with mouse
//   viewerImg.addEventListener('mousedown', e => {
//     isDragging = true;
//     startX = e.clientX - originX;
//     startY = e.clientY - originY;
//     viewerImg.style.cursor = 'grabbing';
//   });
//   window.addEventListener('mouseup', () => {
//     isDragging = false;
//     viewerImg.style.cursor = 'grab';
//   });
//   window.addEventListener('mousemove', e => {
//     if (!isDragging) return;
//     originX = e.clientX - startX;
//     originY = e.clientY - startY;
//     updateTransform();
//   });

//   // Wheel zoom
//   viewer.addEventListener('wheel', e => {
//     e.preventDefault();
//     const delta = e.deltaY < 0 ? 1.1 : 0.9;
//     scale = Math.min(Math.max(0.5, scale * delta), 8);
//     updateTransform();
//   });

//   // ESC to close
//   document.addEventListener('keydown', e => {
//     if (e.key === 'Escape' && viewer.classList.contains('active'))
//       viewer.classList.remove('active');
//   });

//   // Touch gestures (pinch zoom)
//   let pinchStartDist = null, pinchStartScale = 1;
//   viewer.addEventListener('touchstart', e => {
//     if (e.touches.length === 2) {
//       pinchStartDist = Math.hypot(
//         e.touches[0].clientX - e.touches[1].clientX,
//         e.touches[0].clientY - e.touches[1].clientY
//       );
//       pinchStartScale = scale;
//     }
//   }, { passive: false });

//   viewer.addEventListener('touchmove', e => {
//     if (e.touches.length === 2 && pinchStartDist) {
//       e.preventDefault();
//       const newDist = Math.hypot(
//         e.touches[0].clientX - e.touches[1].clientX,
//         e.touches[0].clientY - e.touches[1].clientY
//       );
//       scale = Math.min(Math.max(0.5, pinchStartScale * (newDist / pinchStartDist)), 8);
//       updateTransform();
//     }
//   }, { passive: false });

//   viewer.addEventListener('touchend', () => {
//     pinchStartDist = null;
//   });
// }

/* -------------------------
   Image viewer setup (zoomable + rotatable + mobile drag)
   ------------------------- */
function setupImageViewer() {
  const viewer = document.getElementById('imageViewer');
  if (!viewer) return;

  const viewerImg = viewer.querySelector('img');
  let scale = 1, rotation = 0, originX = 0, originY = 0;
  let isDragging = false, startX = 0, startY = 0;
  let pinchStartDist = null, pinchStartScale = 1;

  // Create toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'viewer-toolbar';
  toolbar.innerHTML = `
    <button class="viewer-btn" data-action="zoom-in">＋</button>
    <button class="viewer-btn" data-action="zoom-out">－</button>
    <button class="viewer-btn" data-action="rotate-left">⟲</button>
    <button class="viewer-btn" data-action="rotate-right">⟳</button>
    <button class="viewer-btn" data-action="reset">⤾</button>
    <button class="viewer-btn" data-action="close">✕</button>
  `;
  viewer.appendChild(toolbar);

  // Helper to update transform
  function updateTransform() {
    viewerImg.style.transform = `translate(${originX}px, ${originY}px) scale(${scale}) rotate(${rotation}deg)`;
  }

  // Open viewer
  document.querySelectorAll('.viewable-img').forEach(img => {
    img.addEventListener('click', () => {
      viewerImg.src = img.src;
      scale = 1; rotation = 0; originX = 0; originY = 0;
      updateTransform();
      viewer.classList.add('active');
    });
  });

  // Close viewer
  toolbar.querySelector('[data-action="close"]').addEventListener('click', () => {
    viewer.classList.remove('active');
    setTimeout(() => (viewerImg.src = ''), 250);
  });

  // Button actions
  toolbar.addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (!action) return;
    switch (action) {
      case 'zoom-in': scale *= 1.25; break;
      case 'zoom-out': scale = Math.max(1, scale / 1.25); break;
      case 'rotate-left': rotation -= 90; break;
      case 'rotate-right': rotation += 90; break;
      case 'reset': scale = 1; rotation = 0; originX = 0; originY = 0; break;
    }
    updateTransform();
  });

  // Mouse drag
  viewerImg.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.clientX - originX;
    startY = e.clientY - originY;
    viewerImg.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    viewerImg.style.cursor = 'grab';
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    originX = e.clientX - startX;
    originY = e.clientY - startY;
    updateTransform();
  });

  // Wheel zoom
  viewer.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    scale = Math.min(Math.max(0.5, scale * delta), 8);
    updateTransform();
  });

  // ESC close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && viewer.classList.contains('active')) {
      viewer.classList.remove('active');
    }
  });

  // --- Touch gestures ---
  let lastTouchX = 0, lastTouchY = 0;

  viewer.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      // pinch start
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      // single finger pan
      isDragging = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }, { passive: false });

  viewer.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchStartDist) {
      // pinch zoom
      e.preventDefault();
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.min(Math.max(0.5, pinchStartScale * (newDist / pinchStartDist)), 8);
      updateTransform();
    } else if (e.touches.length === 1 && isDragging) {
      // pan when zoomed
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchX;
      const dy = touch.clientY - lastTouchY;
      originX += dx;
      originY += dy;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      updateTransform();
    }
  }, { passive: false });

  viewer.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      isDragging = false;
      pinchStartDist = null;
    }
  });
}



  /* -------------------------
     Init when DOM ready
     ------------------------- */

  function init() {
    fetchAndUpdatePrices();
    setInterval(fetchAndUpdatePrices, 60000);
    setupMobileMenuToggle();
    setupReadLatest();
    setupLazyAdLoad();
    setupImageViewer();

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (navigator.share) {
          navigator.share({
            title: document.title,
            text: 'Latest from Wave Crypto Insights',
            url: location.href
          }).catch(() => {});
        } else {
          try {
            navigator.clipboard.writeText(location.href);
            alert('Link copied to clipboard.');
          } catch (e) {}
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
