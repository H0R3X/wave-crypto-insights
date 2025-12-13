// economic-calendar.js
// Manual JSON-powered Crypto Economic Calendar
// Timezone selectable + Weekend-safe sessions + Session countdown timers

(() => {
  const EVENTS_JSON = "./events.json";
  const TZ_KEY = "wci_calendar_timezone";

  /* -------------------- DOM -------------------- */
  const nextTitle = document.getElementById("nextTitle");
  const nextMeta = document.getElementById("nextMeta");
  const nextForecast = document.getElementById("nextForecast");
  const nextPrevious = document.getElementById("nextPrevious");
  const nextDesc = document.getElementById("nextDesc");

  const cdDays = document.getElementById("cdDays");
  const cdHours = document.getElementById("cdHours");
  const cdMins = document.getElementById("cdMins");
  const cdSecs = document.getElementById("cdSecs");

  const eventsContainer = document.getElementById("eventsContainer");
  const listCount = document.getElementById("listCount");
  const jumpToFull = document.getElementById("jumpToFull");
  const filterBtns = Array.from(document.querySelectorAll(".filter-btn"));
  const sessionsList = document.getElementById("sessionsList");
  const timezoneSelect = document.getElementById("timezoneSelect");

  /* -------------------- STATE -------------------- */
  let allEvents = [];
  let highEvents = [];
  let currentRange = "this-week";
  let countdownTimer = null;
  let selectedTZ = localStorage.getItem(TZ_KEY) || "local";

  /* -------------------- TIME HELPERS -------------------- */

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isWeekend(date) {
    const d = date.getDay();
    return d === 0 || d === 6;
  }

  function fmtTime(date) {
    return date.toLocaleString(undefined, {
      timeZone: selectedTZ === "local" ? undefined : selectedTZ,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function getEventDate(e) {
    return new Date(`${e.date}T${e.time || "00:00"}`);
  }

  /* -------------------- MARKET SESSIONS -------------------- */

  const SESSIONS = [
    { label: "Sydney", tz: "Australia/Sydney", open: 9, close: 17 },
    { label: "Tokyo", tz: "Asia/Tokyo", open: 9, close: 17 },
    { label: "London", tz: "Europe/London", open: 8, close: 16 },
    { label: "New York", tz: "America/New_York", open: 9, close: 17 }
  ];

  function getSessionTimes(session) {
    const now = new Date();

    if (isWeekend(now)) {
      return { status: "Weekend Closed" };
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: session.tz
    });

    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find(p => p.type === "hour").value);
    const minute = Number(parts.find(p => p.type === "minute").value);

    const currentMinutes = hour * 60 + minute;
    const openMinutes = session.open * 60;
    const closeMinutes = session.close * 60;

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      const remaining = closeMinutes - currentMinutes;
      return {
        status: "Open",
        countdown: `Closes in ${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`
      };
    } else {
      let untilOpen = openMinutes - currentMinutes;
      if (untilOpen < 0) untilOpen += 1440;
      return {
        status: "Closed",
        countdown: `Opens in ${pad(Math.floor(untilOpen / 60))}:${pad(untilOpen % 60)}`
      };
    }
  }

  function renderSessions() {
    sessionsList.innerHTML = "";

    SESSIONS.forEach(s => {
      const info = getSessionTimes(s);

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="session-left">
          <div class="session-name">${s.label}</div>
          <div class="session-sub muted">${info.countdown || ""}</div>
        </div>
        <div class="session-status ${info.status === "Open" ? "open" : "closed"}">
          ${info.status}
        </div>
      `;

      sessionsList.appendChild(li);
    });
  }

  /* -------------------- LOAD EVENTS -------------------- */

  async function loadEventsJSON() {
    const res = await fetch(EVENTS_JSON, { cache: "no-cache" });
    const json = await res.json();

    allEvents = json.events
      .map(e => ({ ...e, _date: getEventDate(e) }))
      .filter(e => !isNaN(e._date));

    highEvents = allEvents
      .filter(e => e.impact.toLowerCase() === "high")
      .sort((a, b) => a._date - b._date);
  }

  /* -------------------- DATE RANGES -------------------- */

  function rangeBounds(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (range === "today") return [today, new Date(today.getTime() + 86400000)];
    if (range === "tomorrow") {
      const t = new Date(today.getTime() + 86400000);
      return [t, new Date(t.getTime() + 86400000)];
    }

    const day = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + 1);

    if (range === "this-week") return [monday, new Date(monday.getTime() + 7 * 86400000)];
    if (range === "next-week") {
      const s = new Date(monday.getTime() + 7 * 86400000);
      return [s, new Date(s.getTime() + 7 * 86400000)];
    }

    return [new Date(0), new Date(8640000000000000)];
  }

  /* -------------------- RENDER LIST -------------------- */

  function renderList(range) {
    currentRange = range;
    const [start, end] = rangeBounds(range);

    const filtered = highEvents.filter(e => e._date >= start && e._date < end);

    eventsContainer.innerHTML = "";
    listCount.textContent = `${filtered.length} high-impact event(s)`;

    if (!filtered.length) {
      eventsContainer.innerHTML = `<div class="muted">No high-impact events.</div>`;
    }

    filtered.forEach(e => {
      const card = document.createElement("div");
      card.className = "event-card";
      card.innerHTML = `
        <div class="impact">HIGH</div>
        <h4>${e.title}</h4>
        <div class="event-meta">
          <div class="country">${e.country}</div>
          <div class="muted">${fmtTime(e._date)}</div>
        </div>
        <div class="desc">${e.description || ""}</div>
        <div class="vals">
          <div class="val-box">Forecast: ${e.forecast || "—"}</div>
          <div class="val-box">Previous: ${e.previous || "—"}</div>
          <div class="val-box">${e.calendarCategory || ""}</div>
        </div>
      `;
      eventsContainer.appendChild(card);
    });

    updateNextEvent();
  }

  /* -------------------- NEXT EVENT -------------------- */

  function updateNextEvent() {
    const now = new Date();
    const next = highEvents.find(e => e._date > now);
    if (!next) return;

    nextTitle.textContent = `${next.title} (${next.country})`;
    nextMeta.textContent = fmtTime(next._date);
    nextForecast.textContent = next.forecast || "—";
    nextPrevious.textContent = next.previous || "—";
    nextDesc.textContent = next.description || "";

    startCountdown(next._date.getTime());
  }

  function startCountdown(target) {
    clearInterval(countdownTimer);

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) return renderList(currentRange);

      const s = Math.floor(diff / 1000);
      cdDays.textContent = pad(Math.floor(s / 86400));
      cdHours.textContent = pad(Math.floor((s % 86400) / 3600));
      cdMins.textContent = pad(Math.floor((s % 3600) / 60));
      cdSecs.textContent = pad(s % 60);
    }

    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  /* -------------------- EVENTS -------------------- */

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderList(btn.dataset.range);
    });
  });

  jumpToFull.addEventListener("click", () => {
    document.getElementById("listTitle").scrollIntoView({ behavior: "smooth" });
  });

  timezoneSelect.value = selectedTZ;
  timezoneSelect.addEventListener("change", () => {
    selectedTZ = timezoneSelect.value;
    localStorage.setItem(TZ_KEY, selectedTZ);
    renderList(currentRange);
    renderSessions();
  });

  /* -------------------- INIT -------------------- */

  (async function init() {
    await loadEventsJSON();
    renderSessions();
    renderList("this-week");
    setInterval(renderSessions, 60000);
  })();
})();
