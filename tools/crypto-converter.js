// tools/crypto-converter.js
// Manual-search converter with autosuggest (alphabetical by SYMBOL), SOL ensured,
// 1s live price for selected coin, and a 24h sparkline under the Converted Value.

document.addEventListener("DOMContentLoaded", () => {
  const API_MARKETS = "https://api.coingecko.com/api/v3/coins/markets";
  const API_SIMPLE_PRICE = "https://api.coingecko.com/api/v3/simple/price";
  const API_MARKET_CHART = "https://api.coingecko.com/api/v3/coins"; // append /{id}/market_chart
  const DEBOUNCE_MS = 120;
  const MAX_SUGGESTIONS = 12;
  const SPARKLINE_REFRESH_MS = 60 * 1000; // refresh sparkline every 60s
  const PRICE_POLL_MS = 1000; // live price every 1s

  // DOM references
  const amountInput = document.getElementById("amountInput");
  const coinSearch = document.getElementById("coinSearch");
  const suggestionsEl = document.getElementById("suggestions");
  const swapBtn = document.getElementById("swapBtn");
  const modeCoinToUsdBtn = document.getElementById("modeCoinToUsd");
  const modeUsdToCoinBtn = document.getElementById("modeUsdToCoin");

  const resultLeft = document.getElementById("resultLeft");
  const resultRight = document.getElementById("resultRight");
  const highlightRow = document.getElementById("highlightRow");
  const usdResult = document.getElementById("usdResult");
  const calcSteps = document.getElementById("calcSteps");
  const sparklineWrap = document.getElementById("sparklineWrap");

  // app state
  let coins = []; // {id, symbol, name, image, current_price}
  let selectedCoin = null;
  let direction = "coinToUsd"; // or "usdToCoin"
  let suggestionsVisible = false;
  let keyboardIndex = -1;
  let perSecondTimer = null;
  let sparklineTimer = null;

  // utility: debounce
  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  // format USD nicely
  function formatUSD(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    const abs = Math.abs(n);
    if (abs === 0) return "$0.00";
    if (abs < 0.01) return "$" + n.toFixed(6);
    return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function showEmpty() {
    resultLeft.textContent = "—";
    resultRight.textContent = "—";
    highlightRow.style.display = "none";
    usdResult.textContent = "—";
    calcSteps.innerHTML = "";
    clearSparkline();
  }

  function showError(msg) {
    resultLeft.textContent = "—";
    resultRight.textContent = msg;
    highlightRow.style.display = "none";
    calcSteps.innerHTML = "";
    clearSparkline();
  }

  // Render result using selectedCoin and current direction
  function renderResultFor(amtStr) {
    const amt = Number(amtStr);
    if (!selectedCoin) {
      showError("Choose a coin from suggestions.");
      return;
    }
    if (isNaN(amt)) {
      showError("Enter a valid number.");
      return;
    }
    if (amt < 0) {
      showError("Amount must be 0 or greater.");
      return;
    }

    const price = selectedCoin.current_price;
    if (price === null || price === undefined) {
      showError("Price unavailable.");
      return;
    }

    if (direction === "coinToUsd") {
      const usd = amt * price;
      resultLeft.textContent = `${amt} ${selectedCoin.symbol.toUpperCase()}`;
      resultRight.textContent = `${selectedCoin.name} @ ${formatUSD(price)} / 1`;
      highlightRow.style.display = "flex";
      usdResult.textContent = formatUSD(usd);
      calcSteps.innerHTML = `
        <div>1 ${selectedCoin.symbol.toUpperCase()} = <strong>${formatUSD(price)}</strong></div>
        <div>Amount = <strong>${amt} ${selectedCoin.symbol.toUpperCase()}</strong></div>
        <div style="margin-top:8px;"><strong>USD Value = Amount × Price = ${amt} × ${formatUSD(price)} = ${formatUSD(usd)}</strong></div>
      `;
    } else {
      if (price === 0) {
        showError("Invalid price (0).");
        return;
      }
      const coinAmt = amt / price;
      resultLeft.textContent = `${formatUSD(amt)} (USD)`;
      resultRight.textContent = `${selectedCoin.name} @ ${formatUSD(price)} / 1`;
      highlightRow.style.display = "flex";
      usdResult.textContent = `${coinAmt.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${selectedCoin.symbol.toUpperCase()}`;
      calcSteps.innerHTML = `
        <div>1 ${selectedCoin.symbol.toUpperCase()} = <strong>${formatUSD(price)}</strong></div>
        <div>USD Amount = <strong>${formatUSD(amt)}</strong></div>
        <div style="margin-top:8px;"><strong>Coin Amount = USD ÷ Price = ${formatUSD(amt)} ÷ ${formatUSD(price)} = ${usdResult.textContent}</strong></div>
      `;
    }
  }

  // Suggestions helpers
  function clearSuggestions() {
    suggestionsEl.innerHTML = "";
    suggestionsEl.hidden = true;
    coinSearch.setAttribute("aria-expanded", "false");
    suggestionsVisible = false;
    keyboardIndex = -1;
  }

  function showSuggestions(list) {
    suggestionsEl.innerHTML = "";
    if (!list || list.length === 0) {
      suggestionsEl.innerHTML = `<div class="suggestion-empty">No matches</div>`;
      suggestionsEl.hidden = false;
      coinSearch.setAttribute("aria-expanded", "true");
      suggestionsVisible = true;
      return;
    }

    // sort alphabetically by SYMBOL (pure alphabetical by symbol)
    list.sort((a, b) => {
      const A = (a.symbol || "").toUpperCase();
      const B = (b.symbol || "").toUpperCase();
      return A.localeCompare(B, undefined, { numeric: false, sensitivity: "base" });
    });

    list.slice(0, MAX_SUGGESTIONS).forEach((c, idx) => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-coin-id", c.id);
      item.setAttribute("data-idx", idx);
      item.tabIndex = -1;

      item.innerHTML = `
        <div class="s-left">
          <img src="${c.image}" alt="${c.symbol} logo" loading="lazy" width="28" height="28"/>
        </div>
        <div class="s-mid">
          <div class="s-symbol">${c.symbol.toUpperCase()}</div>
          <div class="s-name">${c.name}</div>
        </div>
        <div class="s-right">${formatUSD(c.current_price)}</div>
      `;

      // use mousedown to ensure click selects before input blur; then close menu
      item.addEventListener("mousedown", (e) => {
        // prevent default so the input doesn't re-insert text, and we close immediately
        e.preventDefault();
        selectCoinById(c.id, { reflectInput: true });
        clearSuggestions();
        // blur to remove focus from input (avoids some mobile keyboard quirks)
        try { coinSearch.blur(); } catch (err) {}
      });

      suggestionsEl.appendChild(item);
    });

    suggestionsEl.hidden = false;
    coinSearch.setAttribute("aria-expanded", "true");
    suggestionsVisible = true;
    keyboardIndex = -1;
  }

  // Selection — Option A: symbol only shown in input
  function selectCoinById(id, opts = { reflectInput: true }) {
    const coin = coins.find(c => c.id === id);
    if (!coin) return;
    selectedCoin = coin;

    // reflect into input: symbol only as requested
    if (opts.reflectInput) {
      coinSearch.value = coin.symbol.toUpperCase();
    }

    // fetch fresh price immediately and draw sparkline
    fetchSelectedPriceNow();
    fetchAndRenderSparkline(coin.id);

    // compute with current amount
    renderResultFor(amountInput.value || "0");
  }

  // Search/filter logic — startsWith first then includes (predictable)
  function searchCoins(query) {
    if (!query) return [];
    const q = query.trim().toLowerCase();
    // startsWith matches symbol or name
    const starts = coins.filter(c =>
      (c.symbol || "").toLowerCase().startsWith(q) ||
      (c.name || "").toLowerCase().startsWith(q)
    );
    if (starts.length) return starts;
    // fallback to includes
    const includes = coins.filter(c =>
      (c.symbol || "").toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q)
    );
    return includes;
  }

  // Keyboard nav in suggestions
  function handleKeyNav(e) {
    if (!suggestionsVisible) return;
    const items = Array.from(suggestionsEl.querySelectorAll(".suggestion-item"));
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      keyboardIndex = Math.min(items.length - 1, keyboardIndex + 1);
      items.forEach(it => it.classList.remove("highlight"));
      items[keyboardIndex].classList.add("highlight");
      items[keyboardIndex].scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      keyboardIndex = Math.max(0, keyboardIndex - 1);
      items.forEach(it => it.classList.remove("highlight"));
      items[keyboardIndex].classList.add("highlight");
      items[keyboardIndex].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (keyboardIndex >= 0 && keyboardIndex < items.length) {
        const id = items[keyboardIndex].getAttribute("data-coin-id");
        selectCoinById(id, { reflectInput: true });
        clearSuggestions();
        keyboardIndex = -1;
      } else {
        // No highlighted suggestion: try exact symbol match
        const q = (coinSearch.value || "").trim().toLowerCase();
        if (q) {
          const exact = coins.find(c => c.symbol.toLowerCase() === q);
          if (exact) {
            selectCoinById(exact.id, { reflectInput: true });
            clearSuggestions();
          } else {
            // keep suggestions visible — helpful hint
            // (If user typed full name or partial, suggestions will already be shown)
          }
        }
      }
    } else if (e.key === "Escape") {
      clearSuggestions();
      keyboardIndex = -1;
    }
  }

  // Fetch top coins (markets) to populate list including image + price
  async function fetchTopCoins() {
    try {
      const params = new URLSearchParams({
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: "250",
        page: "1",
        sparkline: "false"
      });
      const url = `${API_MARKETS}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch coins");
      const data = await res.json();

      coins = data.map(c => ({
        id: c.id,
        symbol: c.symbol || "",
        name: c.name || c.id,
        image: c.image || "",
        current_price: (typeof c.current_price === "number") ? c.current_price : null
      }));

      // Ensure SOL (Solana) exists (common symbol SOL with id 'solana')
      if (!coins.find(x => x.symbol && x.symbol.toLowerCase() === "sol")) {
        coins.push({
          id: "solana",
          symbol: "SOL",
          name: "Solana",
          image: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
          current_price: null
        });
      }

      // dedupe by id (defensive)
      const seen = new Set();
      coins = coins.filter(c => {
        if (!c || !c.id) return false;
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      // do not autoset selectedCoin — user must choose
    } catch (err) {
      console.error(err);
      showError("Unable to load coin list. Check network.");
    }
  }

  // Fetch selected coin price via simple/price (fast)
  let lastSelectedId = null;
  async function fetchSelectedPriceNow() {
    if (!selectedCoin) return;
    const coinId = selectedCoin.id;
    lastSelectedId = coinId;
    try {
      const params = new URLSearchParams({
        ids: coinId,
        vs_currencies: "usd"
      });
      const url = `${API_SIMPLE_PRICE}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const price = data && data[coinId] && data[coinId].usd;
      if (price !== undefined && price !== null) {
        // update coins array & selectedCoin reference
        const idx = coins.findIndex(c => c.id === coinId);
        if (idx >= 0) coins[idx].current_price = price;
        if (selectedCoin && selectedCoin.id === coinId) selectedCoin.current_price = price;
        // re-render result quickly
        renderResultFor(amountInput.value || "0");
      }
    } catch (e) {
      // ignore transient network errors
    }
  }

  // Poll selected price every second
  function startPerSecondPolling() {
    stopPerSecondPolling();
    perSecondTimer = setInterval(() => {
      if (selectedCoin) fetchSelectedPriceNow();
    }, PRICE_POLL_MS);
  }
  function stopPerSecondPolling() {
    if (perSecondTimer) {
      clearInterval(perSecondTimer);
      perSecondTimer = null;
    }
  }

  // Sparkline drawing utilities (inline SVG)
  function clearSparkline() {
    sparklineWrap.innerHTML = "";
  }

  // Draw sparkline. prices: array of [timestamp, price] pairs (CoinGecko market_chart format)
  function drawSparkline(prices) {
    clearSparkline();
    if (!prices || prices.length < 2) return;

    // Map to numeric price values
    const vals = prices.map(p => p[1]);
    const width = Math.min(720, Math.max(220, Math.floor(window.innerWidth * 0.5))); // responsive width
    const height = 64;
    const padding = 6;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = (max - min) || 1;

    // Build path
    const points = vals.map((v, i) => {
      const x = padding + (i / (vals.length - 1)) * innerW;
      const y = padding + ((max - v) / range) * innerH;
      return [x, y];
    });

    // Make path string (simple linear)
    const d = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");

    // Build filled path (close to bottom)
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const dFill = `${d} L ${lastPoint[0]} ${height - padding} L ${firstPoint[0]} ${height - padding} Z`;

    // create SVG
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", height.toString());
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.classList.add("sparkline-svg");

    // defs: gradient
    const defs = document.createElementNS(ns, "defs");
    const grad = document.createElementNS(ns, "linearGradient");
    grad.setAttribute("id", "g1");
    grad.setAttribute("x1", "0");
    grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "0");
    grad.setAttribute("y2", "1");
    const stopTop = document.createElementNS(ns, "stop");
    stopTop.setAttribute("offset", "0%");
    stopTop.setAttribute("stop-color", "#e6c86d");
    stopTop.setAttribute("stop-opacity", "0.9");
    const stopBottom = document.createElementNS(ns, "stop");
    stopBottom.setAttribute("offset", "100%");
    stopBottom.setAttribute("stop-color", "#e6c86d");
    stopBottom.setAttribute("stop-opacity", "0.06");
    grad.appendChild(stopTop);
    grad.appendChild(stopBottom);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // filled area
    const pathFill = document.createElementNS(ns, "path");
    pathFill.setAttribute("d", dFill);
    pathFill.setAttribute("fill", "url(#g1)");
    pathFill.setAttribute("opacity", "0.95");
    svg.appendChild(pathFill);

    // line path
    const pathLine = document.createElementNS(ns, "path");
    pathLine.setAttribute("d", d);
    pathLine.setAttribute("fill", "none");
    pathLine.setAttribute("stroke", "#e6c86d");
    pathLine.setAttribute("stroke-width", "2");
    pathLine.setAttribute("stroke-linecap", "round");
    pathLine.setAttribute("stroke-linejoin", "round");
    pathLine.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(pathLine);

    // last price dot
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", lastPoint[0]);
    dot.setAttribute("cy", lastPoint[1]);
    dot.setAttribute("r", "3.5");
    dot.setAttribute("fill", "#111");
    dot.setAttribute("stroke", "#e6c86d");
    dot.setAttribute("stroke-width", "1.4");
    svg.appendChild(dot);

    // append to DOM
    const wrapper = document.createElement("div");
    wrapper.className = "sparkline-wrapper";
    wrapper.appendChild(svg);
    sparklineWrap.appendChild(wrapper);
  }

  // fetch 24h sparkline from /coins/{id}/market_chart?vs_currency=usd&days=1
  let lastSparkId = null;
  async function fetchAndRenderSparkline(coinId) {
    if (!coinId) return;
    lastSparkId = coinId;
    try {
      const url = `${API_MARKET_CHART}/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=1&interval=hourly`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("market_chart fetch failed");
      const data = await res.json();
      // coinGecko returns data.prices = [[timestamp, price], ...]
      if (data && Array.isArray(data.prices) && data.prices.length > 0) {
        // only render if coin still selected
        if (lastSparkId === coinId) drawSparkline(data.prices);
      } else {
        clearSparkline();
      }
    } catch (err) {
      // don't spam UI; just clear sparkline or keep old
      console.warn("Sparkline fetch failed:", err);
      // keep existing sparkline if any
    }
  }

  // debounce triggers
  const debouncedSuggest = debounce(() => {
    const q = (coinSearch.value || "").trim();
    if (!q) {
      clearSuggestions();
      return;
    }
    const list = searchCoins(q);
    showSuggestions(list);
  }, DEBOUNCE_MS);

  const debouncedCompute = debounce(() => {
    if (selectedCoin) {
      renderResultFor(amountInput.value || "0");
    } else {
      showError("Choose a coin from suggestions.");
    }
  }, 80);

  // wire events
  coinSearch.addEventListener("input", (e) => {
    // keep typed text intact; do NOT auto-insert
    selectedCoin = null;
    debouncedSuggest();
    debouncedCompute();
  });

  coinSearch.addEventListener("keydown", handleKeyNav);

  document.addEventListener("click", (e) => {
    if (!suggestionsEl.contains(e.target) && e.target !== coinSearch) {
      clearSuggestions();
    }
  });

  amountInput.addEventListener("input", () => {
    if (selectedCoin) {
      debouncedCompute();
    } else {
      showError("Choose a coin from suggestions.");
    }
  });

  // swap direction button
  swapBtn.addEventListener("click", () => {
    direction = (direction === "coinToUsd") ? "usdToCoin" : "coinToUsd";
    updateModeButtons();
    if (selectedCoin) renderResultFor(amountInput.value || "0");
  });

  // mode toggle
  modeCoinToUsdBtn.addEventListener("click", () => {
    direction = "coinToUsd";
    updateModeButtons();
    if (selectedCoin) renderResultFor(amountInput.value || "0");
  });
  modeUsdToCoinBtn.addEventListener("click", () => {
    direction = "usdToCoin";
    updateModeButtons();
    if (selectedCoin) renderResultFor(amountInput.value || "0");
  });

  function updateModeButtons() {
    if (direction === "coinToUsd") {
      modeCoinToUsdBtn.classList.add("active");
      modeCoinToUsdBtn.setAttribute("aria-pressed", "true");
      modeUsdToCoinBtn.classList.remove("active");
      modeUsdToCoinBtn.setAttribute("aria-pressed", "false");
      amountInput.placeholder = "e.g. 0.25";
    } else {
      modeUsdToCoinBtn.classList.add("active");
      modeUsdToCoinBtn.setAttribute("aria-pressed", "true");
      modeCoinToUsdBtn.classList.remove("active");
      modeCoinToUsdBtn.setAttribute("aria-pressed", "false");
      amountInput.placeholder = "e.g. 100 (USD)";
    }
  }

  // periodic sparkline refresh (only active when a coin is selected)
  function startSparklineRefresh() {
    stopSparklineRefresh();
    sparklineTimer = setInterval(() => {
      if (selectedCoin) fetchAndRenderSparkline(selectedCoin.id);
    }, SPARKLINE_REFRESH_MS);
  }
  function stopSparklineRefresh() {
    if (sparklineTimer) {
      clearInterval(sparklineTimer);
      sparklineTimer = null;
    }
  }

  // initialisation
  (async function init() {
    showEmpty();
    updateModeButtons();
    await fetchTopCoins();
    // start polling prices per second (fetchSelectedPriceNow only fetches when selectedCoin exists)
    startPerSecondPolling();

    // start sparkline refresh loop
    startSparklineRefresh();

    // accessible quick compute on paste
    amountInput.addEventListener("paste", () => setTimeout(() => {
      if (selectedCoin) renderResultFor(amountInput.value || "0");
    }, 40));

    // show suggestions when focusing and text exists
    coinSearch.addEventListener("focus", () => {
      if ((coinSearch.value || "").trim()) debouncedSuggest();
    });
  })();

});
