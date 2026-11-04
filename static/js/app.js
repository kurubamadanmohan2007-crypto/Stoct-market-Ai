/* ═══════════════════════════════════════════════════════════════════════════
   AI Stock Market – Frontend Application Logic
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

/* ── Chart.js global defaults ──────────────────────────────────────────────── */
Chart.defaults.color           = "#8b949e";
Chart.defaults.borderColor     = "rgba(255,255,255,0.06)";
Chart.defaults.font.family     = "'Inter', system-ui, sans-serif";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding       = 16;
Chart.defaults.plugins.tooltip.backgroundColor     = "#1c2128";
Chart.defaults.plugins.tooltip.borderColor         = "rgba(255,255,255,0.1)";
Chart.defaults.plugins.tooltip.borderWidth         = 1;
Chart.defaults.plugins.tooltip.padding             = 10;

/* ── State ─────────────────────────────────────────────────────────────────── */
const state = {
  currentSymbol:  null,
  currentPeriod:  "1mo",
  charts: {
    price:       null,
    volume:      null,
    prediction:  null,
    ma:          null,
  },
};

/* ── Utility helpers ───────────────────────────────────────────────────────── */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const API = async (endpoint) => {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

function formatNumber(n, decimals = 2) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatVolume(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

function changeClass(val) {
  if (val > 0)  return "positive";
  if (val < 0)  return "negative";
  return "neutral";
}

function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

function showLoading(show) {
  $("#loading-overlay").classList.toggle("hidden", !show);
}

/* ── Live Clock ─────────────────────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  $("#live-clock").textContent = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}
setInterval(updateClock, 1000);
updateClock();

/* ── Navigation ─────────────────────────────────────────────────────────────── */
function activateSection(sectionId) {
  $$(".section").forEach(s => s.classList.remove("active"));
  $$(".nav-link").forEach(a => a.classList.remove("active"));
  const sec = $(`#${sectionId}`);
  if (sec) sec.classList.add("active");
  const link = $(`.nav-link[data-section="${sectionId}"]`);
  if (link) link.classList.add("active");
}

$$(".nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    activateSection(link.dataset.section);
  });
});

/* ── Popular Tickers ─────────────────────────────────────────────────────────── */
async function loadPopularTickers() {
  try {
    const tickers = await API("/api/popular");
    const row     = $("#ticker-row");
    row.innerHTML = "";
    tickers.forEach(t => {
      const sign   = t.change_pct >= 0 ? "+" : "";
      const cls    = changeClass(t.change_pct);
      const card   = document.createElement("div");
      card.className = "ticker-card";
      card.innerHTML = `
        <div class="tc-symbol">${t.symbol}</div>
        <div class="tc-price">${formatNumber(t.price)}</div>
        <div class="tc-change ${cls}">${sign}${formatNumber(t.change_pct)}%</div>`;
      card.addEventListener("click", () => runAnalysis(t.symbol));
      row.appendChild(card);
    });
  } catch (err) {
    console.warn("Could not load popular tickers:", err);
    $("#ticker-row").innerHTML =
      '<p style="color:var(--text-muted);font-size:.85rem">Market data unavailable — search for a symbol above.</p>';
  }
}

/* ── Stock Summary ───────────────────────────────────────────────────────────── */
async function loadStockInfo(symbol) {
  const data = await API(`/api/stock/${symbol}`);
  const sign = data.change >= 0 ? "+" : "";
  const cls  = changeClass(data.change_pct);

  $("#summary-symbol").textContent = data.symbol;
  $("#m-price").textContent  = formatNumber(data.current_price);
  $("#m-open").textContent   = formatNumber(data.open);
  $("#m-high").textContent   = formatNumber(data.high);
  $("#m-low").textContent    = formatNumber(data.low);
  $("#m-volume").textContent = formatVolume(data.volume);
  $("#m-change").textContent = `${sign}${formatNumber(data.change)} (${sign}${formatNumber(data.change_pct)}%)`;
  $("#m-change").className   = `metric-value ${cls}`;

  $("#live-badge").title = data.is_live ? "Live data from Yahoo Finance" : "Sample / offline data";
  $("#live-badge").innerHTML = data.is_live
    ? '<i class="fas fa-circle pulse"></i> LIVE'
    : '<i class="fas fa-database"></i> SAMPLE';

  $("#stock-summary").classList.remove("hidden");
}

/* ── Historical Analysis ─────────────────────────────────────────────────────── */
async function loadHistorical(symbol, period) {
  const data = await API(`/api/historical/${symbol}?period=${period}`);

  // Fill OHLCV table (last 10 rows)
  const tbody = $("#ohlcv-body");
  tbody.innerHTML = "";
  const rows = data.dates.slice(-10);
  rows.forEach((date, i) => {
    const idx = data.dates.length - rows.length + i;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${date}</td>
      <td>${formatNumber(data.open[idx])}</td>
      <td style="color:var(--accent-green)">${formatNumber(data.high[idx])}</td>
      <td style="color:var(--accent-red)">${formatNumber(data.low[idx])}</td>
      <td><strong>${formatNumber(data.close[idx])}</strong></td>
      <td>${formatVolume(data.volume[idx])}</td>`;
    tbody.appendChild(row);
  });

  // Price chart
  destroyChart("price");
  const priceCtx = $("#price-chart").getContext("2d");
  state.charts.price = new Chart(priceCtx, {
    type: "line",
    data: {
      labels: data.dates,
      datasets: [
        {
          label: "Close",
          data:  data.close,
          borderColor:     "#58a6ff",
          backgroundColor: "rgba(88,166,255,0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: "Open",
          data:  data.open,
          borderColor:     "#bc8cff",
          borderWidth: 1.5,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderDash: [4, 4],
        },
        {
          label: "High",
          data:  data.high,
          borderColor:     "#3fb950",
          borderWidth: 1,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderDash: [2, 4],
        },
        {
          label: "Low",
          data:  data.low,
          borderColor:     "#f85149",
          borderWidth: 1,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderDash: [2, 4],
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 }, grid: { display: false } },
        y: { ticks: { maxTicksLimit: 8 } },
      },
    },
  });

  // Volume chart
  destroyChart("volume");
  const volCtx = $("#volume-chart").getContext("2d");
  state.charts.volume = new Chart(volCtx, {
    type: "bar",
    data: {
      labels: data.dates,
      datasets: [{
        label: "Volume",
        data:   data.volume,
        backgroundColor: "rgba(88,166,255,0.5)",
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 }, grid: { display: false } },
        y: {
          ticks: {
            maxTicksLimit: 6,
            callback: (v) => formatVolume(v),
          },
        },
      },
    },
  });

  $("#analysis-content").classList.remove("hidden");
  $("#analysis-placeholder").classList.add("hidden");
}

/* ── AI Prediction ───────────────────────────────────────────────────────────── */
async function loadPrediction(symbol) {
  const data = await API(`/api/predict/${symbol}`);

  $("#p-accuracy").textContent = `${data.model_accuracy}%`;
  $("#p-trend").textContent    = data.trend_direction;

  // Prediction chart
  destroyChart("prediction");
  const ctx = $("#prediction-chart").getContext("2d");
  state.charts.prediction = new Chart(ctx, {
    type: "line",
    data: {
      labels: [...data.historical_dates, ...data.predicted_dates],
      datasets: [
        {
          label: "Actual Price",
          data:  [...data.historical_prices, ...Array(data.predicted_prices.length).fill(null)],
          borderColor:     "#58a6ff",
          backgroundColor: "rgba(88,166,255,0.1)",
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: "AI Predicted",
          data: [...Array(data.historical_prices.length - 1).fill(null),
                 data.historical_prices[data.historical_prices.length - 1],
                 ...data.predicted_prices],
          borderColor:     "#bc8cff",
          backgroundColor: "rgba(188,140,255,0.1)",
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          borderDash: [6, 3],
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { ticks: { maxTicksLimit: 8 } },
      },
    },
  });

  // 7-day forecast table
  const tbody = $("#pred-table-body");
  tbody.innerHTML = "";
  const lastActual = data.historical_prices[data.historical_prices.length - 1];
  data.predicted_dates.forEach((date, i) => {
    const price  = data.predicted_prices[i];
    const diff   = price - lastActual;
    const signal = diff > 0
      ? '<span class="positive">▲ Bullish</span>'
      : '<span class="negative">▼ Bearish</span>';
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${date}</td><td><strong>${formatNumber(price)}</strong></td><td>${signal}</td>`;
    tbody.appendChild(tr);
  });

  $("#prediction-content").classList.remove("hidden");
  $("#prediction-placeholder").classList.add("hidden");
}

/* ── Trend Analysis ──────────────────────────────────────────────────────────── */
async function loadTrend(symbol) {
  const [trendData, histData] = await Promise.all([
    API(`/api/trend/${symbol}`),
    API(`/api/historical/${symbol}?period=6mo`),
  ]);

  // Hero card
  const heroCard = $("#trend-hero");
  if (trendData.trend.includes("Upward")) {
    heroCard.style.borderColor = "rgba(63,185,80,0.4)";
    heroCard.style.background  = "rgba(63,185,80,0.05)";
  } else if (trendData.trend.includes("Downward")) {
    heroCard.style.borderColor = "rgba(248,81,73,0.4)";
    heroCard.style.background  = "rgba(248,81,73,0.05)";
  } else {
    heroCard.style.borderColor = "rgba(88,166,255,0.4)";
    heroCard.style.background  = "rgba(88,166,255,0.05)";
  }
  $("#trend-direction").textContent = trendData.trend;
  $("#trend-insight").textContent   = trendData.insight;

  // Metric values
  const fmt = (v) => v !== null ? formatNumber(v) : "—";
  $("#t-ma7").textContent  = fmt(trendData.ma7);
  $("#t-ma20").textContent = fmt(trendData.ma20);
  $("#t-ma50").textContent = fmt(trendData.ma50);
  $("#t-rsi").textContent  = fmt(trendData.rsi);

  const rsiSig = trendData.rsi_signal;
  const rsiEl  = $("#t-rsi-signal");
  rsiEl.textContent  = rsiSig;
  rsiEl.className    = "tm-value " +
    (rsiSig === "Overbought" ? "negative" : rsiSig === "Oversold" ? "positive" : "neutral");

  const ch7El  = $("#t-ch7");
  const ch30El = $("#t-ch30");
  ch7El.textContent  = `${trendData.price_change_7d >= 0 ? "+" : ""}${formatNumber(trendData.price_change_7d)}%`;
  ch7El.className    = "tm-value " + changeClass(trendData.price_change_7d);
  ch30El.textContent = `${trendData.price_change_30d >= 0 ? "+" : ""}${formatNumber(trendData.price_change_30d)}%`;
  ch30El.className   = "tm-value " + changeClass(trendData.price_change_30d);

  // MA Chart
  const closes = histData.close;
  const labels = histData.dates;

  const calcMA = (arr, n) =>
    arr.map((_, i) => i >= n - 1
      ? arr.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0) / n
      : null);

  const ma7arr  = calcMA(closes, 7);
  const ma20arr = calcMA(closes, 20);
  const ma50arr = calcMA(closes, 50);

  destroyChart("ma");
  const ctx = $("#ma-chart").getContext("2d");
  state.charts.ma = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Close",
          data:  closes,
          borderColor:     "#58a6ff",
          borderWidth: 1.5,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: "MA 7",
          data:  ma7arr,
          borderColor:     "#3fb950",
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: "MA 20",
          data:  ma20arr,
          borderColor:     "#d29922",
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: "MA 50",
          data:  ma50arr,
          borderColor:     "#bc8cff",
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 }, grid: { display: false } },
        y: { ticks: { maxTicksLimit: 8 } },
      },
    },
  });

  // Insights
  const insights = [
    `Current RSI is ${formatNumber(trendData.rsi)} — ${trendData.rsi_signal}.`,
    `7-day moving average: ${fmt(trendData.ma7)}.`,
    `20-day moving average: ${fmt(trendData.ma20)}.`,
    `50-day moving average: ${fmt(trendData.ma50)}.`,
    `Price change over 7 days: ${trendData.price_change_7d >= 0 ? "+" : ""}${formatNumber(trendData.price_change_7d)}%.`,
    `Price change over 30 days: ${trendData.price_change_30d >= 0 ? "+" : ""}${formatNumber(trendData.price_change_30d)}%.`,
    trendData.insight,
  ];
  const ul = $("#insights-list");
  ul.innerHTML = "";
  insights.forEach(ins => {
    const li = document.createElement("li");
    li.textContent = ins;
    ul.appendChild(li);
  });

  $("#trend-content").classList.remove("hidden");
  $("#trend-placeholder").classList.add("hidden");
}

/* ── Main Analysis Runner ─────────────────────────────────────────────────────── */
async function runAnalysis(symbol) {
  if (!symbol || symbol.trim() === "") return;
  symbol = symbol.trim().toUpperCase();
  state.currentSymbol = symbol;

  $("#stock-input").value = symbol;
  showLoading(true);

  try {
    await Promise.all([
      loadStockInfo(symbol),
      loadHistorical(symbol, state.currentPeriod),
      loadPrediction(symbol),
      loadTrend(symbol),
    ]);
  } catch (err) {
    console.error("Analysis error:", err);
    alert(`⚠️ Could not load data for "${symbol}". Please check the symbol and try again.`);
  } finally {
    showLoading(false);
  }
}

/* ── Event Listeners ──────────────────────────────────────────────────────────── */

// Search button
$("#search-btn").addEventListener("click", () => {
  runAnalysis($("#stock-input").value);
});

// Enter key in search box
$("#stock-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") runAnalysis($("#stock-input").value);
});

// Quick pick buttons
$$(".qp-btn").forEach(btn => {
  btn.addEventListener("click", () => runAnalysis(btn.dataset.symbol));
});

// Period buttons
$$(".period-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".period-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.currentPeriod = btn.dataset.period;
    if (state.currentSymbol) {
      showLoading(true);
      loadHistorical(state.currentSymbol, state.currentPeriod).finally(() => showLoading(false));
    }
  });
});

/* ── Boot ─────────────────────────────────────────────────────────────────────── */
(async () => {
  loadPopularTickers();
  // Auto-load AAPL as default after a short delay
  setTimeout(() => runAnalysis("AAPL"), 600);
})();
