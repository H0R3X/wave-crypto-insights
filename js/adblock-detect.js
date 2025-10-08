// =========================
// Ad Blocker Soft Notice
// =========================
window.addEventListener('load', () => {
  // create bait div
  const bait = document.createElement('div');
  bait.className = 'adsbygoogle';
  bait.style.display = 'none';
  bait.id = 'ad-check';
  document.body.appendChild(bait);

  // delay check slightly to allow adblock to act
  setTimeout(() => {
    const blocked = !bait || bait.offsetParent === null || bait.clientHeight === 0;
    if (blocked) {
      const notice = document.createElement('div');
      notice.innerHTML = `
        <div id="adblock-notice" style="
          position:fixed;
          bottom:0;
          left:0;
          right:0;
          background:rgba(12,12,12,0.96);
          color:#d6b24a;
          padding:14px 18px;
          text-align:center;
          font-size:36px;
          font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto;
          border-top:1px solid rgba(255,255,255,0.06);
          z-index:1000;
          backdrop-filter: blur(4px);
          display:flex;
          flex-wrap:wrap;
          justify-content:center;
          align-items:center;
          gap:8px;
        ">
          <span>💡 We noticed you're using an ad blocker.</span>
          <span style="color:#e6eef3">
            Ads help keep <b>Wave Crypto Insights</b> free and independent.
          </span>
          <button id="close-adblock-notice" style="
            background:linear-gradient(90deg,#d6b24a,#caa441);
            color:#071014;
            font-weight:700;
            border:none;
            border-radius:20px;
            padding:6px 12px;
            margin: 10px 0 0 30px;
            cursor:pointer;
            font-size:13px;
          ">
            Got it
          </button>
        </div>
      `;
      document.body.appendChild(notice);

      // dismiss button
      document.getElementById('close-adblock-notice').addEventListener('click', () => {
        const el = document.getElementById('adblock-notice');
        if (el) el.remove();
      });
    }
  }, 1200);
});

