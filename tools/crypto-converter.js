// tools/crypto-converter.js
// Manual-search converter with alphabetical-by-symbol suggestions,
// top ~120 coins, clean gold-line 30-day sparkline (with fallback), and 1s live price polling.

document.addEventListener("DOMContentLoaded", () => {
  const API_MARKETS = "https://api.coingecko.com/api/v3/coins/markets";
  const API_MARKET_CHART_BASE = "https://api.coingecko.com/api/v3/coins"; // /{id}/market_chart
  const DEBOUNCE_MS = 120;
  const MAX_SUGGESTIONS = 12;
  const PRICE_POLL_MS = 1000; // 1s live price (subject to API rate limits)
  const TOP_N = 120; // top ~120 coins

  // DOM
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

  // state
  let coins = []; // {id,symbol,name,image,current_price}
  let selectedCoin = null;
  let direction = "coinToUsd";
  let suggestionsVisible = false;
  let keyboardIndex = -1;
  let pricePollTimer = null;
  let sparklineTimer = null;
  let lastSparkId = null;

  // small utilities
  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

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

  // Rendering result (coinToUsd or usdToCoin)
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

    // sort alphabetically by SYMBOL (pure symbol alphabetical)
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

      // Use mousedown for proper selection-before-blur
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectCoinById(c.id, { reflectInput: true });
        clearSuggestions();
        try { coinSearch.blur(); } catch (err) {}
      });

      item.addEventListener("click", (e) => {
        e.preventDefault();
        selectCoinById(c.id, { reflectInput: true });
        clearSuggestions();
        try { coinSearch.blur(); } catch (err) {}
      });

      suggestionsEl.appendChild(item);
    });

    suggestionsEl.hidden = false;
    coinSearch.setAttribute("aria-expanded", "true");
    suggestionsVisible = true;
    keyboardIndex = -1;
  }

  // Option A: selection shows symbol only in input
  function selectCoinById(id, opts = { reflectInput: true }) {
    const coin = coins.find(c => c.id === id);
    if (!coin) return;
    selectedCoin = coin;

    if (opts.reflectInput) {
      coinSearch.value = (coin.symbol || "").toUpperCase();
    }

    fetchSelectedPriceNow();
    fetchAndRender30dSparkline(coin.id);
    renderResultFor(amountInput.value || "0");
  }

  // Search (startsWith first)
  function searchCoins(query) {
    if (!query) return [];
    const q = query.trim().toLowerCase();
    const starts = coins.filter(c =>
      (c.symbol || "").toLowerCase().startsWith(q) ||
      (c.name || "").toLowerCase().startsWith(q)
    );
    if (starts.length) return starts;

    // fallback
    return coins.filter(c =>
      (c.symbol || "").toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q)
    );
  }

  // Keyboard navigation
  function handleKeyNav(e) {
    if (!suggestionsVisible) return;
    const items = Array.from(suggestionsEl.querySelectorAll(".suggestion-item"));
    if (!items.length) return;

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
      if (keyboardIndex >= 0) {
        const id = items[keyboardIndex].getAttribute("data-coin-id");
        selectCoinById(id, { reflectInput: true });
        clearSuggestions();
      } else {
        const q = coinSearch.value.trim().toLowerCase();
        const exact = coins.find(c => c.symbol.toLowerCase() === q);
        if (exact) {
          selectCoinById(exact.id, { reflectInput: true });
          clearSuggestions();
        }
      }
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  }

  // Fetch top N coins
  async function fetchTopCoins() {
    try {
      const params = new URLSearchParams({
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: String(TOP_N),
        page: "1",
        sparkline: "false"
      });
      const url = `${API_MARKETS}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      coins = data.map(c => ({
        id: c.id,
        symbol: c.symbol || "",
        name: c.name || c.id,
        image: c.image || "",
        current_price: typeof c.current_price === "number" ? c.current_price : null
      }));

      // ensure SOL
      if (!coins.find(x => x.symbol.toLowerCase() === "sol")) {
        coins.push({
          id: "solana",
          symbol: "SOL",
          name: "Solana",
          image: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
          current_price: null
        });
      }

      // dedupe
      const seen = new Set();
      coins = coins.filter(c => {
        if (!c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

    } catch (err) {
      showError("Unable to load coin list. Check network.");
    }
  }

  // Fetch selected price
  async function fetchSelectedPriceNow() {
    if (!selectedCoin) return;
    const ids = encodeURIComponent(selectedCoin.id);
    try {
      const params = new URLSearchParams({
        vs_currency: "usd",
        ids,
        order: "market_cap_desc",
        per_page: "1",
        page: "1",
        sparkline: "false"
      });
      const url = `${API_MARKETS}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const p = data[0].current_price;
        if (typeof p === "number") {
          const idx = coins.findIndex(c => c.id === selectedCoin.id);
          if (idx >= 0) coins[idx].current_price = p;
          selectedCoin.current_price = p;
          renderResultFor(amountInput.value || "0");
        }
      }
    } catch (err) {}
  }

  // polling
  function startPricePolling() {
    stopPricePolling();
    pricePollTimer = setInterval(() => {
      if (selectedCoin) fetchSelectedPriceNow();
    }, PRICE_POLL_MS);
  }
  function stopPricePolling() {
    if (pricePollTimer) {
      clearInterval(pricePollTimer);
      pricePollTimer = null;
    }
  }

  // Clear sparkline
  function clearSparkline() {
    lastSparkId = null;
    if (sparklineWrap) sparklineWrap.innerHTML = "";
  }

  // 🟡 Updated — compact square sparkline
  function drawGoldSparklineFromPrices(prices) {
    clearSparkline();
    if (!prices || prices.length < 2) return;

    const vals = prices.map(p => p[1]);

    // FIXED SMALL DIMENSIONS (square-compact)
    const width = 400;
    const height = 160;
    const padding = 6;

    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = (max - min) || 1;

    const points = vals.map((v, i) => {
      const x = padding + (i / (vals.length - 1)) * innerW;
      const y = padding + ((max - v) / range) * innerH;
      return [x, y];
    });

    const d = points.map((p, i) =>
      i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`
    ).join(" ");

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "400px";
    svg.style.height = "160px";

    const pathLine = document.createElementNS(ns, "path");
    pathLine.setAttribute("d", d);
    pathLine.setAttribute("fill", "none");
    pathLine.setAttribute("stroke", "#e6c86d");
    pathLine.setAttribute("stroke-width", "2");
    pathLine.setAttribute("stroke-linecap", "round");
    pathLine.setAttribute("stroke-linejoin", "round");
    svg.appendChild(pathLine);

    const last = points[points.length - 1];
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", last[0]);
    dot.setAttribute("cy", last[1]);
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#e6c86d");
    svg.appendChild(dot);

    const wrap = document.createElement("div");
    wrap.className = "sparkline-wrapper";
    wrap.appendChild(svg);

    sparklineWrap.appendChild(wrap);
  }

  // Fetch 30d sparkline
  async function fetchAndRender30dSparkline(coinId) {
    if (!coinId) return;
    lastSparkId = coinId;

    try {
      const url =
        `${API_MARKET_CHART_BASE}/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=30&interval=daily`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("market_chart failed");
      const data = await res.json();
      if (data && Array.isArray(data.prices) && data.prices.length > 1) {
        if (lastSparkId === coinId) drawGoldSparklineFromPrices(data.prices);
        return;
      }
      throw new Error("market_chart empty");
    } catch (err) {
      console.warn("30d sparkline fetch failed, fallback:", err);
      try {
        const params = new URLSearchParams({
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: String(TOP_N),
          page: "1",
          sparkline: "true"
        });
        const url2 = `${API_MARKETS}?${params.toString()}`;
        const res2 = await fetch(url2);
        if (!res2.ok) throw new Error("fallback fail");
        const data2 = await res2.json();
        const hit = data2.find(d => d.id === coinId);
        if (hit && hit.sparkline_in_7d?.price?.length) {
          const p7 = hit.sparkline_in_7d.price.slice();
          const prices = p7.map((p, i) => [
            Date.now() - (p7.length - 1 - i) * 86400000,
            p
          ]);
          drawGoldSparklineFromPrices(prices);
          return;
        }
        throw new Error("no sparkline data");
      } catch (err2) {
        console.warn("Sparkline fallback also failed:", err2);
        clearSparkline();
        const msg = document.createElement("div");
        msg.className = "muted small";
        msg.textContent = "Chart unavailable (network or rate limit).";
        sparklineWrap.appendChild(msg);
      }
    }
  }

  // Debounced suggestion & compute
  const debouncedSuggest = debounce(() => {
    const q = coinSearch.value.trim();
    if (!q) {
      clearSuggestions();
      return;
    }
    showSuggestions(searchCoins(q));
  }, DEBOUNCE_MS);

  const debouncedCompute = debounce(() => {
    if (selectedCoin) {
      renderResultFor(amountInput.value || "0");
    } else {
      showError("Choose a coin from suggestions.");
    }
  }, 80);

  // Event wiring
  coinSearch.addEventListener("input", () => {
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
    if (selectedCoin) debouncedCompute();
  });

  // Swap
  swapBtn.addEventListener("click", () => {
    direction = direction === "coinToUsd" ? "usdToCoin" : "coinToUsd";
    updateModeButtons();
    if (selectedCoin) renderResultFor(amountInput.value || "0");
  });

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
      modeUsdToCoinBtn.classList.remove("active");
      amountInput.placeholder = "e.g. 0.25";
    } else {
      modeUsdToCoinBtn.classList.add("active");
      modeCoinToUsdBtn.classList.remove("active");
      amountInput.placeholder = "e.g. 100 (USD)";
    }
  }

  // init
  (async function init() {
    showEmpty();
    updateModeButtons();
    await fetchTopCoins();

    startPricePolling();

    // update sparkline every minute
    sparklineTimer = setInterval(() => {
      if (selectedCoin) fetchAndRender30dSparkline(selectedCoin.id);
    }, 60000);

    coinSearch.addEventListener("focus", () => {
      if (coinSearch.value.trim()) debouncedSuggest();
    });

    amountInput.addEventListener("paste", () =>
      setTimeout(() => {
        if (selectedCoin) renderResultFor(amountInput.value || "0");
      }, 50)
    );
  })();

});
// tools/crypto-converter.js
// Manual-search converter with alphabetical-by-symbol suggestions,
// top ~120 coins, clean gold-line 30-day sparkline (with fallback), and 1s live price polling.

document.addEventListener("DOMContentLoaded", () => {
  const API_MARKETS = "https://api.coingecko.com/api/v3/coins/markets";
  const API_MARKET_CHART_BASE = "https://api.coingecko.com/api/v3/coins"; // /{id}/market_chart
  const DEBOUNCE_MS = 120;
  const MAX_SUGGESTIONS = 12;
  const PRICE_POLL_MS = 1000; // 1s live price (subject to API rate limits)
  const TOP_N = 120; // top ~120 coins

  // DOM
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

  // state
  let coins = []; // {id,symbol,name,image,current_price}
  let selectedCoin = null;
  let direction = "coinToUsd";
  let suggestionsVisible = false;
  let keyboardIndex = -1;
  let pricePollTimer = null;
  let sparklineTimer = null;
  let lastSparkId = null;

  // small utilities
  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

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

  // Rendering result (coinToUsd or usdToCoin)
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

    // sort alphabetically by SYMBOL (pure symbol alphabetical)
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

      // Use mousedown for proper selection-before-blur
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectCoinById(c.id, { reflectInput: true });
        clearSuggestions();
        try { coinSearch.blur(); } catch (err) {}
      });

      item.addEventListener("click", (e) => {
        e.preventDefault();
        selectCoinById(c.id, { reflectInput: true });
        clearSuggestions();
        try { coinSearch.blur(); } catch (err) {}
      });

      suggestionsEl.appendChild(item);
    });

    suggestionsEl.hidden = false;
    coinSearch.setAttribute("aria-expanded", "true");
    suggestionsVisible = true;
    keyboardIndex = -1;
  }

  // Option A: selection shows symbol only in input
  function selectCoinById(id, opts = { reflectInput: true }) {
    const coin = coins.find(c => c.id === id);
    if (!coin) return;
    selectedCoin = coin;

    if (opts.reflectInput) {
      coinSearch.value = (coin.symbol || "").toUpperCase();
    }

    fetchSelectedPriceNow();
    fetchAndRender30dSparkline(coin.id);
    renderResultFor(amountInput.value || "0");
  }

  // Search (startsWith first)
  function searchCoins(query) {
    if (!query) return [];
    const q = query.trim().toLowerCase();
    const starts = coins.filter(c =>
      (c.symbol || "").toLowerCase().startsWith(q) ||
      (c.name || "").toLowerCase().startsWith(q)
    );
    if (starts.length) return starts;

    // fallback
    return coins.filter(c =>
      (c.symbol || "").toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q)
    );
  }

  // Keyboard navigation
  function handleKeyNav(e) {
    if (!suggestionsVisible) return;
    const items = Array.from(suggestionsEl.querySelectorAll(".suggestion-item"));
    if (!items.length) return;

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
      if (keyboardIndex >= 0) {
        const id = items[keyboardIndex].getAttribute("data-coin-id");
        selectCoinById(id, { reflectInput: true });
        clearSuggestions();
      } else {
        const q = coinSearch.value.trim().toLowerCase();
        const exact = coins.find(c => c.symbol.toLowerCase() === q);
        if (exact) {
          selectCoinById(exact.id, { reflectInput: true });
          clearSuggestions();
        }
      }
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  }

  // Fetch top N coins
  async function fetchTopCoins() {
    try {
      const params = new URLSearchParams({
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: String(TOP_N),
        page: "1",
        sparkline: "false"
      });
      const url = `${API_MARKETS}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      coins = data.map(c => ({
        id: c.id,
        symbol: c.symbol || "",
        name: c.name || c.id,
        image: c.image || "",
        current_price: typeof c.current_price === "number" ? c.current_price : null
      }));

      // ensure SOL
      if (!coins.find(x => x.symbol.toLowerCase() === "sol")) {
        coins.push({
          id: "solana",
          symbol: "SOL",
          name: "Solana",
          image: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
          current_price: null
        });
      }

      // dedupe
      const seen = new Set();
      coins = coins.filter(c => {
        if (!c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

    } catch (err) {
      showError("Unable to load coin list. Check network.");
    }
  }

  // Fetch selected price
  async function fetchSelectedPriceNow() {
    if (!selectedCoin) return;
    const ids = encodeURIComponent(selectedCoin.id);
    try {
      const params = new URLSearchParams({
        vs_currency: "usd",
        ids,
        order: "market_cap_desc",
        per_page: "1",
        page: "1",
        sparkline: "false"
      });
      const url = `${API_MARKETS}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const p = data[0].current_price;
        if (typeof p === "number") {
          const idx = coins.findIndex(c => c.id === selectedCoin.id);
          if (idx >= 0) coins[idx].current_price = p;
          selectedCoin.current_price = p;
          renderResultFor(amountInput.value || "0");
        }
      }
    } catch (err) {}
  }

  // polling
  function startPricePolling() {
    stopPricePolling();
    pricePollTimer = setInterval(() => {
      if (selectedCoin) fetchSelectedPriceNow();
    }, PRICE_POLL_MS);
  }
  function stopPricePolling() {
    if (pricePollTimer) {
      clearInterval(pricePollTimer);
      pricePollTimer = null;
    }
  }

  // Clear sparkline
  function clearSparkline() {
    lastSparkId = null;
    if (sparklineWrap) sparklineWrap.innerHTML = "";
  }

  // 🟡 Updated — compact square sparkline
  function drawGoldSparklineFromPrices(prices) {
    clearSparkline();
    if (!prices || prices.length < 2) return;

    const vals = prices.map(p => p[1]);

    // FIXED SMALL DIMENSIONS (square-compact)
    const width = 200;
    const height = 80;
    const padding = 6;

    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = (max - min) || 1;

    const points = vals.map((v, i) => {
      const x = padding + (i / (vals.length - 1)) * innerW;
      const y = padding + ((max - v) / range) * innerH;
      return [x, y];
    });

    const d = points.map((p, i) =>
      i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`
    ).join(" ");

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "200px";
    svg.style.height = "80px";

    const pathLine = document.createElementNS(ns, "path");
    pathLine.setAttribute("d", d);
    pathLine.setAttribute("fill", "none");
    pathLine.setAttribute("stroke", "#e6c86d");
    pathLine.setAttribute("stroke-width", "2");
    pathLine.setAttribute("stroke-linecap", "round");
    pathLine.setAttribute("stroke-linejoin", "round");
    svg.appendChild(pathLine);

    const last = points[points.length - 1];
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", last[0]);
    dot.setAttribute("cy", last[1]);
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#e6c86d");
    svg.appendChild(dot);

    const wrap = document.createElement("div");
    wrap.className = "sparkline-wrapper";
    wrap.appendChild(svg);

    sparklineWrap.appendChild(wrap);
  }

  // Fetch 30d sparkline
  async function fetchAndRender30dSparkline(coinId) {
    if (!coinId) return;
    lastSparkId = coinId;

    try {
      const url =
        `${API_MARKET_CHART_BASE}/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=30&interval=daily`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("market_chart failed");
      const data = await res.json();
      if (data && Array.isArray(data.prices) && data.prices.length > 1) {
        if (lastSparkId === coinId) drawGoldSparklineFromPrices(data.prices);
        return;
      }
      throw new Error("market_chart empty");
    } catch (err) {
      console.warn("30d sparkline fetch failed, fallback:", err);
      try {
        const params = new URLSearchParams({
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: String(TOP_N),
          page: "1",
          sparkline: "true"
        });
        const url2 = `${API_MARKETS}?${params.toString()}`;
        const res2 = await fetch(url2);
        if (!res2.ok) throw new Error("fallback fail");
        const data2 = await res2.json();
        const hit = data2.find(d => d.id === coinId);
        if (hit && hit.sparkline_in_7d?.price?.length) {
          const p7 = hit.sparkline_in_7d.price.slice();
          const prices = p7.map((p, i) => [
            Date.now() - (p7.length - 1 - i) * 86400000,
            p
          ]);
          drawGoldSparklineFromPrices(prices);
          return;
        }
        throw new Error("no sparkline data");
      } catch (err2) {
        console.warn("Sparkline fallback also failed:", err2);
        clearSparkline();
        const msg = document.createElement("div");
        msg.className = "muted small";
        msg.textContent = "Chart unavailable (network or rate limit).";
        sparklineWrap.appendChild(msg);
      }
    }
  }

  // Debounced suggestion & compute
  const debouncedSuggest = debounce(() => {
    const q = coinSearch.value.trim();
    if (!q) {
      clearSuggestions();
      return;
    }
    showSuggestions(searchCoins(q));
  }, DEBOUNCE_MS);

  const debouncedCompute = debounce(() => {
    if (selectedCoin) {
      renderResultFor(amountInput.value || "0");
    } else {
      showError("Choose a coin from suggestions.");
    }
  }, 80);

  // Event wiring
  coinSearch.addEventListener("input", () => {
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
    if (selectedCoin) debouncedCompute();
  });

  // Swap
  swapBtn.addEventListener("click", () => {
    direction = direction === "coinToUsd" ? "usdToCoin" : "coinToUsd";
    updateModeButtons();
    if (selectedCoin) renderResultFor(amountInput.value || "0");
  });

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
      modeUsdToCoinBtn.classList.remove("active");
      amountInput.placeholder = "e.g. 0.25";
    } else {
      modeUsdToCoinBtn.classList.add("active");
      modeCoinToUsdBtn.classList.remove("active");
      amountInput.placeholder = "e.g. 100 (USD)";
    }
  }

  // init
  (async function init() {
    showEmpty();
    updateModeButtons();
    await fetchTopCoins();

    startPricePolling();

    // update sparkline every minute
    sparklineTimer = setInterval(() => {
      if (selectedCoin) fetchAndRender30dSparkline(selectedCoin.id);
    }, 60000);

    coinSearch.addEventListener("focus", () => {
      if (coinSearch.value.trim()) debouncedSuggest();
    });

    amountInput.addEventListener("paste", () =>
      setTimeout(() => {
        if (selectedCoin) renderResultFor(amountInput.value || "0");
      }, 50)
    );
  })();

});
