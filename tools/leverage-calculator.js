// tools/leverage-calculator.js
document.addEventListener("DOMContentLoaded", () => {
  // Tabs
  const tabLev = document.getElementById("tabLeverage");
  const tabMar = document.getElementById("tabMargin");
  const panelLev = document.getElementById("modeLeverage");
  const panelMar = document.getElementById("modeMargin");

  function showLeverageTab() {
    tabLev.classList.add("active");
    tabLev.setAttribute("aria-selected", "true");
    tabMar.classList.remove("active");
    tabMar.setAttribute("aria-selected", "false");
    panelLev.classList.add("active");
    panelLev.removeAttribute("hidden");
    panelMar.classList.remove("active");
    panelMar.setAttribute("hidden", "true");
  }
  function showMarginTab() {
    tabMar.classList.add("active");
    tabMar.setAttribute("aria-selected", "true");
    tabLev.classList.remove("active");
    tabLev.setAttribute("aria-selected", "false");
    panelMar.classList.add("active");
    panelMar.removeAttribute("hidden");
    panelLev.classList.remove("active");
    panelLev.setAttribute("hidden", "true");
  }

  tabLev.addEventListener("click", showLeverageTab);
  tabMar.addEventListener("click", showMarginTab);

  // Shared inputs
  const walletEl = document.getElementById("wallet");
  const riskSlider = document.getElementById("riskSlider");
  const riskValue = document.getElementById("riskValue");
  const stopLossEl = document.getElementById("stopLoss");

  const walletError = document.getElementById("walletError");
  const slError = document.getElementById("slError");
  const riskError = document.getElementById("riskError");

  // Panel fields
  const levInput = document.getElementById("lev1");
  const marginInput = document.getElementById("margin2");

  // Results
  const result1 = document.getElementById("result1");
  const result2 = document.getElementById("result2");

  // Buttons
  const calcLevBtn = document.getElementById("calcLev");
  const calcMarBtn = document.getElementById("calcMargin");
  const resetLev = document.getElementById("resetLev");
  const resetMargin = document.getElementById("resetMargin");

  // Helpers: clear errors
  function clearErrors() {
    walletError.textContent = "";
    slError.textContent = "";
    riskError.textContent = "";
  }

  // Risk slider change -> update label
  riskSlider.addEventListener("input", () => {
    riskValue.textContent = `${riskSlider.value}%`;
  });

  // Prevent wallet decimals (user wanted whole numbers only)
  walletEl.addEventListener("input", () => {
    clearErrors();
    const v = walletEl.value;
    if (!v) return;
    if (v.includes(".")) {
      // show small error and truncate to integer (do not silently round)
      walletError.textContent = "Please enter whole dollars only (no decimals).";
    } else {
      walletError.textContent = "";
    }
  });

  // Validate stop loss input on blur
  stopLossEl.addEventListener("blur", () => {
    slError.textContent = "";
    const v = parseFloat(stopLossEl.value);
    if (!stopLossEl.value || isNaN(v) || v <= 0) {
      slError.textContent = "Enter a positive stop loss percent (e.g. 2).";
    }
  });

  // Utility formatting
  function usd(x) {
    return `$${Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  // Compute risk-per-trade from shared inputs
  function computeRiskPerTrade() {
    clearErrors();
    // validations
    const walletRaw = walletEl.value;
    if (!walletRaw) {
      walletError.textContent = "Enter wallet balance (whole dollars).";
      return { ok: false };
    }
    if (walletRaw.includes(".")) {
      walletError.textContent = "Wallet must be whole dollars (no decimals).";
      return { ok: false };
    }
    const wallet = Number(walletRaw);
    if (!Number.isFinite(wallet) || wallet <= 0) {
      walletError.textContent = "Enter a valid whole number greater than 0.";
      return { ok: false };
    }

    const riskPct = Number(riskSlider.value);
    if (!Number.isFinite(riskPct) || riskPct <= 0) {
      riskError.textContent = "Risk percent must be > 0.";
      return { ok: false };
    }
    const sl = parseFloat(stopLossEl.value);
    if (!Number.isFinite(sl) || sl <= 0) {
      slError.textContent = "Enter a positive stop loss percent.";
      return { ok: false };
    }

    const riskPerTrade = (wallet * (riskPct / 100));
    return { ok: true, wallet, riskPct, sl, riskPerTrade };
  }

  /* -----------------------
     Fixed Leverage Mode
     Margin = (Risk / (Leverage × StopLoss%)) × 100
     (equivalently margin = risk / (L * (sl/100)))
     ------------------------*/
  calcLevBtn.addEventListener("click", () => {
    result1.innerHTML = "";
    const shared = computeRiskPerTrade();
    if (!shared.ok) return;

    const L = parseFloat(levInput.value);
    if (!Number.isFinite(L) || L <= 0) {
      result1.innerHTML = `<p class="muted">Enter a valid leverage (whole number &gt;= 1).</p>`;
      return;
    }

    // Formula: margin = risk / (L * (sl/100))
    // Note: to avoid tiny numbers when sl is in %, use sl/100
    const margin = shared.riskPerTrade / (L * (shared.sl / 100));
    // Also show calculated position size (margin * leverage)
    const positionSize = margin * L;

    result1.innerHTML = `
      <div class="result-card">
        <h4>Result</h4>
        <div class="result-row"><div>Wallet</div><div>${usd(shared.wallet)}</div></div>
        <div class="result-row"><div>Risk %</div><div>${shared.riskPct}%</div></div>
        <div class="result-row"><div>Risk per trade</div><div>${usd(shared.riskPerTrade)}</div></div>
        <hr />
        <div class="result-row"><div>Leverage</div><div>${L}×</div></div>
        <div class="result-row"><div>Stop Loss</div><div>${shared.sl}%</div></div>
        <div class="result-row highlight"><div>Required Margin</div><div><strong>${usd(margin.toFixed(2))}</strong></div></div>
        <div class="result-row"><div>Position Size (approx)</div><div>${usd(positionSize.toFixed(2))}</div></div>
        <div class="muted small" style="margin-top:8px;">
          Formula: <code>Margin = Risk / (Leverage × StopLoss%)</code>.<br/>
          Explanation: With ${L}× leverage, using ${usd(margin.toFixed(2))} margin produces a position of ${usd(positionSize.toFixed(2))}. If stop-loss (${shared.sl}%) is hit, loss ≈ ${usd(shared.riskPerTrade.toFixed(2))}.
        </div>
      </div>
    `;
  });

  resetLev.addEventListener("click", () => {
    levInput.value = "";
    result1.innerHTML = "";
  });

  /* -----------------------
     Fixed Margin Mode
     ROI = (Risk / Margin) × 100
     Leverage = ROI / StopLoss%
     ------------------------*/
  calcMarBtn.addEventListener("click", () => {
    result2.innerHTML = "";
    const shared = computeRiskPerTrade();
    if (!shared.ok) return;

    const marginVal = marginInput.value;
    if (!marginVal) {
      result2.innerHTML = `<p class="muted">Enter margin in USD.</p>`;
      return;
    }
    if (String(marginVal).includes(".")) {
      // user wanted margin whole dollars? earlier requirement was wallet only; margin can be integer but accept decimals if provided.
      // We'll allow decimals for margin but ensure >0.
    }
    const margin = parseFloat(marginVal);
    if (!Number.isFinite(margin) || margin <= 0) {
      result2.innerHTML = `<p class="muted">Enter a valid margin amount greater than 0.</p>`;
      return;
    }

    const ROI = (shared.riskPerTrade / margin) * 100; // percent
    const leverage = ROI / shared.sl; // since sl is in percent

    result2.innerHTML = `
      <div class="result-card">
        <h4>Result</h4>
        <div class="result-row"><div>Wallet</div><div>${usd(shared.wallet)}</div></div>
        <div class="result-row"><div>Risk %</div><div>${shared.riskPct}%</div></div>
        <div class="result-row"><div>Risk per trade</div><div>${usd(shared.riskPerTrade)}</div></div>
        <hr />
        <div class="result-row"><div>Provided Margin</div><div>${usd(margin)}</div></div>
        <div class="result-row"><div>Stop Loss</div><div>${shared.sl}%</div></div>
        <div class="result-row highlight"><div>Required Leverage</div><div><strong>${leverage.toFixed(2)}×</strong></div></div>
        <div class="muted small" style="margin-top:8px;">
          Steps: ROI = (Risk ÷ Margin) × 100 → ${ROI.toFixed(2)}%.<br/>
          Leverage = ROI ÷ StopLoss% → ${leverage.toFixed(2)}×.<br/>
          Explanation: With ${usd(margin)} margin and ${leverage.toFixed(2)}×, if stop-loss (${shared.sl}%) is hit, your loss ≈ ${usd(shared.riskPerTrade.toFixed(2))}.
        </div>
      </div>
    `;
  });

  resetMargin.addEventListener("click", () => {
    marginInput.value = "";
    result2.innerHTML = "";
  });

  // Keyboard accessibility: Enter triggers calculation in currently visible panel
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (!panelLev.hasAttribute("hidden")) {
        calcLevBtn.click();
      } else {
        calcMarBtn.click();
      }
    }
  });
});
