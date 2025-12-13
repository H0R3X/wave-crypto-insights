// tools/crypto-converter.js
// Manual-search converter with alphabetical-by-symbol suggestions,
// top ~120 coins (CoinGecko list used for icons/names), and CryptoCompare for live price polling.
// Chart removed — replaced with Symbol Pulse Animation (visual feedback on price updates).

document.addEventListener("DOMContentLoaded", () => {
  // ********** CONFIG **********
  // CryptoCompare simple price endpoint (used for live USD)
  const CRYPTOCOMPARE_SIMPLE = "https://min-api.cryptocompare.com/data/price";
  // Coin list (images, names) fetched from CoinGecko markets for convenience (icons + names)
  const COINGECKO_MARKETS = "https://api.coingecko.com/api/v3/coins/markets";

  const DEBOUNCE_MS = 120;
  const MAX_SUGGESTIONS = 12;
  const PRICE_POLL_MS = 1000; // 1s live (be mindful of rate limits)
  const TOP_N = 120;

  // *** Put your CryptoCompare API key here (you provided this earlier).
  // If you prefer to keep it out of the file, replace with "YOUR_KEY" and set it at runtime.
  const API_KEY = "7889dbfc45f08f684fad67d6a0b234d079fdcdfd6bc8341863d1b87bf94e3c53";

  // ********** DOM **********
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
  const pulseWrap = document.getElementById("pulseWrap");

  // ********** STATE **********
  let coins = []; // {id,symbol,name,image,current_price}
  let selectedCoin = null;
  let direction = "coinToUsd";
  let suggestionsVisible = false;
  let keyboardIndex = -1;
  let pricePollTimer = null;
  let lastPrice = null; // to detect up/down changes

  // ********** UTILITIES **********
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
    renderPulse(null, null, null);
  }

  function showError(msg) {
    resultLeft.textContent = "—";
    resultRight.textContent = msg;
    highlightRow.style.display = "none";
    calcSteps.innerHTML = "";
    renderPulse(null, null, null);
  }

  // ********** RENDER / CONVERTER **********
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

  // ********** SUGGESTIONS UI **********
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

    // sort alphabetically by symbol
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

      // mousedown ensures selection before blur
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectCoinById(c.id, { reflectInput: true });
        clearSuggestions();
        try { coinSearch.blur(); } catch (err) {}
      });

      // fallback click handler
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

  // ********** Selection (Symbol-only) **********
  function selectCoinById(id, opts = { reflectInput: true }) {
    const coin = coins.find(c => c.id === id);
    if (!coin) return;
    selectedCoin = coin;
    lastPrice = null;

    if (opts.reflectInput) {
      coinSearch.value = (coin.symbol || "").toUpperCase();
    }

    // Immediately fetch price and start polling
    fetchSelectedPriceNow().then(() => {
      renderResultFor(amountInput.value || "0");
      renderPulse(selectedCoin.symbol.toUpperCase(), selectedCoin.current_price, "neutral");
    }).catch(() => {
      renderPulse(selectedCoin.symbol.toUpperCase(), selectedCoin.current_price, "neutral");
    });
  }

  // ********** SEARCH logic (startsWith -> includes) **********
  function searchCoins(query) {
    if (!query) return [];
    const q = query.trim().toLowerCase();
    const starts = coins.filter(c =>
      (c.symbol || "").toLowerCase().startsWith(q) ||
      (c.name || "").toLowerCase().startsWith(q)
    );
    if (starts.length) return starts;
    return coins.filter(c =>
      (c.symbol || "").toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q)
    );
  }

  // ********** KEYBOARD NAV **********
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
      if (keyboardIndex >= 0 && keyboardIndex < items.length) {
        const id = items[keyboardIndex].getAttribute("data-coin-id");
        selectCoinById(id, { reflectInput: true });
        clearSuggestions();
        keyboardIndex = -1;
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

  // ********** FETCH COIN LIST (CoinGecko markets for icons/names) **********
  async function fetchTopCoins() {
    try {
      const params = new URLSearchParams({
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: String(TOP_N),
        page: "1",
        sparkline: "false"
      });
      const url = `${COINGECKO_MARKETS}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch coin list");
      const data = await res.json();

      coins = data.map(c => ({
        id: c.id,
        symbol: c.symbol || "",
        name: c.name || c.id,
        image: c.image || "",
        current_price: typeof c.current_price === "number" ? c.current_price : null
      }));

      // ensure SOL present
      if (!coins.find(x => x.symbol && x.symbol.toLowerCase() === "sol")) {
        coins.push({
          id: "solana",
          symbol: "SOL",
          name: "Solana",
          image: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
          current_price: null
        });
      }

      // dedupe by id
      const seen = new Set();
      coins = coins.filter(c => {
        if (!c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    } catch (err) {
      console.error("fetchTopCoins error", err);
      showError("Unable to load coin list. Check network.");
    }
  }

  // ********** FETCH LIVE PRICE (CryptoCompare) **********
  // CryptoCompare simple endpoint: ?fsym=BTC&tsyms=USD&api_key=KEY
  async function fetchSelectedPriceNow() {
    if (!selectedCoin) return;
    const sym = (selectedCoin.symbol || "").toUpperCase();
    if (!sym) return;

    try {
      const params = new URLSearchParams({
        fsym: sym,
        tsyms: "USD",
        api_key: API_KEY
      });
      const url = `${CRYPTOCOMPARE_SIMPLE}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        // don't throw; just return to avoid noisy UI
        return;
      }
      const data = await res.json();
      // CryptoCompare returns { USD: 12345.67 } or an error object
      if (data && typeof data.USD === "number") {
        const newPrice = data.USD;
        const prev = selectedCoin.current_price;
        // update
        const idx = coins.findIndex(c => c.id === selectedCoin.id);
        if (idx >= 0) coins[idx].current_price = newPrice;
        selectedCoin.current_price = newPrice;

        // determine movement direction for pulse animation
        let movement = "neutral";
        if (typeof prev === "number") {
          if (newPrice > prev) movement = "up";
          else if (newPrice < prev) movement = "down";
        }
        lastPrice = newPrice;
        renderResultFor(amountInput.value || "0");
        renderPulse(selectedCoin.symbol.toUpperCase(), newPrice, movement);
      }
    } catch (err) {
      // ignore transient network issues
      console.warn("fetchSelectedPriceNow error", err);
    }
  }

  // ********** POLLING **********
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

  // ********** SYMBOL PULSE ANIMATION (replaces chart) **********
  // Renders compact animated symbol badge into pulseWrap.
  // movement = 'up' | 'down' | 'neutral'
  function renderPulse(symbol, price, movement) {
    pulseWrap.innerHTML = "";
    if (!symbol) {
      // render subtle placeholder
      const ph = document.createElement("div");
      ph.className = "pulse-placeholder muted small";
      ph.textContent = "Select a coin to see live updates.";
      pulseWrap.appendChild(ph);
      return;
    }

    const container = document.createElement("div");
    container.className = "symbol-pulse-container";

    // pulse ring
    const ring = document.createElement("div");
    ring.className = "pulse-ring";
    if (movement === "up") ring.classList.add("up");
    else if (movement === "down") ring.classList.add("down");
    else ring.classList.add("neutral");

    // symbol label
    const label = document.createElement("div");
    label.className = "symbol-label";
    label.textContent = symbol;

    // price label
    const priceLabel = document.createElement("div");
    priceLabel.className = "symbol-price";
    priceLabel.textContent = price ? formatUSD(price) : "—";

    container.appendChild(ring);
    container.appendChild(label);
    container.appendChild(priceLabel);

    pulseWrap.appendChild(container);

    // subtle scale animation when new price arrives
    container.classList.remove("pulse-pop");
    // force reflow for retrigger
    void container.offsetWidth;
    container.classList.add("pulse-pop");
  }

  // ********** DEBOUNCED HANDLERS **********
  const debouncedSuggest = debounce(() => {
    const q = (coinSearch.value || "").trim();
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

  // ********** EVENTS **********
  coinSearch.addEventListener("input", () => {
    // user typing: do not auto-insert
    selectedCoin = null;
    debouncedSuggest();
    debouncedCompute();
  });

  coinSearch.addEventListener("keydown", handleKeyNav);

  // clicking outside closes suggestions
  document.addEventListener("click", (e) => {
    if (!suggestionsEl.contains(e.target) && e.target !== coinSearch) {
      clearSuggestions();
    }
  });

  amountInput.addEventListener("input", () => {
    if (selectedCoin) debouncedCompute();
  });

  swapBtn.addEventListener("click", () => {
    direction = (direction === "coinToUsd") ? "usdToCoin" : "coinToUsd";
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

  // ********** INIT **********
  (async function init() {
    showEmpty();
    updateModeButtons();
    await fetchTopCoins();
    startPricePolling();

    // show suggestions when focusing and text exists
    coinSearch.addEventListener("focus", () => {
      if ((coinSearch.value || "").trim()) debouncedSuggest();
    });

    // quick compute on paste
    amountInput.addEventListener("paste", () =>
      setTimeout(() => {
        if (selectedCoin) renderResultFor(amountInput.value || "0");
      }, 50)
    );
  })();
});
