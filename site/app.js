"use strict";

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- Kieli ------------------------------------------------------------------

const trayToggle = document.getElementById("lang-toggle");
const langToggles = document.querySelectorAll("[data-lang-toggle]");
let status = null;

function savedLang() {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
}

function setLang(lang, remember) {
  root.dataset.lang = lang;
  root.lang = lang;
  trayToggle.setAttribute("aria-label", lang === "fi" ? "In English" : "Suomeksi");
  if (remember) {
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* ei tallennusta, ei haittaa */
    }
  }
  renderStatus();
  renderClock();
}

langToggles.forEach((button) => {
  button.addEventListener("click", () => {
    setLang(root.dataset.lang === "fi" ? "en" : "fi", true);
  });
});

// --- Kello ------------------------------------------------------------------

const clock = document.getElementById("clock");

function renderClock() {
  if (!clock) return;
  const now = new Date();
  const locale = root.dataset.lang === "fi" ? "fi-FI" : "en-GB";
  clock.textContent = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  clock.dateTime = now.toISOString();
  clock.title = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// --- Palvelimen tila (status.json päivittyy serverillä viiden minuutin välein) ---

function formatUptime(seconds, lang) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (lang === "fi") {
    return days > 0 ? `${days} vrk ${hours} h` : `${hours} h`;
  }
  const d = days === 1 ? "day" : "days";
  return days > 0 ? `${days} ${d} ${hours} h` : `${hours} h`;
}

function formatBackup(iso, lang) {
  const when = new Date(iso);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(when)) / 86400000);
  const time = when.toLocaleTimeString(lang === "fi" ? "fi-FI" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  if (lang === "fi") {
    if (dayDiff === 0) return `tänään klo ${time}`;
    if (dayDiff === 1) return `eilen klo ${time}`;
    return when.toLocaleDateString("fi-FI");
  }
  if (dayDiff === 0) return `today at ${time}`;
  if (dayDiff === 1) return `yesterday at ${time}`;
  return when.toLocaleDateString("en-GB");
}

function renderStatus() {
  const box = document.getElementById("server-status");
  if (!box || !status) return;
  const lang = root.dataset.lang;
  box.querySelectorAll("[data-uptime]").forEach((el) => {
    el.textContent = formatUptime(status.uptime_seconds, lang);
  });
  const backupLine = box.querySelector(".backup-line");
  if (status.backup_ok_at) {
    box.querySelectorAll("[data-backup]").forEach((el) => {
      el.textContent = formatBackup(status.backup_ok_at, lang);
    });
    backupLine.hidden = false;
  }
  box.hidden = false;
}

async function loadStatus() {
  try {
    const response = await fetch("status.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    // Näytetään vain tuore ja täydellinen tieto
    const age = Date.now() - new Date(data.generated_at).getTime();
    if (!Number.isFinite(data.uptime_seconds) || !(age < 30 * 60 * 1000)) return;
    status = data;
    renderStatus();
  } catch {
    /* tila on lisätieto, sivu toimii ilman sitä */
  }
}

// --- Ikkunat ----------------------------------------------------------------

const windows = [...document.querySelectorAll("[data-window]")];
const tasks = new Map([...document.querySelectorAll("[data-task]")].map((t) => [t.dataset.task, t]));
let activeId = null;

function setActive(id) {
  if (id === activeId) return;
  activeId = id;
  windows.forEach((win) => win.classList.toggle("is-active", win.id === id));
  tasks.forEach((task, taskId) => task.classList.toggle("is-active", taskId === id));
}

function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.hidden = false;
  win.classList.remove("is-min");
  const minButton = win.querySelector('[data-action="min"]');
  if (minButton) minButton.setAttribute("aria-expanded", "true");
  const task = tasks.get(id);
  if (task) task.hidden = false;
  setActive(id);
}

windows.forEach((win) => {
  const minButton = win.querySelector('[data-action="min"]');
  const maxButton = win.querySelector('[data-action="max"]');
  const closeButton = win.querySelector('[data-action="close"]');

  minButton.setAttribute("aria-expanded", "true");
  maxButton.setAttribute("aria-pressed", "false");

  // Pienennä: ikkuna rullautuu otsikkopalkiksi
  minButton.addEventListener("click", () => {
    const minimised = win.classList.toggle("is-min");
    minButton.setAttribute("aria-expanded", String(!minimised));
  });

  // Suurenna: koko työpöydän levyiseksi
  maxButton.addEventListener("click", () => {
    const maximised = win.classList.toggle("is-max");
    maxButton.setAttribute("aria-pressed", String(maximised));
    maxButton.querySelector("use").setAttribute("href", maximised ? "#g-restore" : "#g-max");
  });

  // Sulje: ikkuna ja sen tehtäväpainike piiloon, Käynnistä-valikosta saa takaisin
  closeButton.addEventListener("click", () => {
    win.hidden = true;
    const task = tasks.get(win.id);
    if (task) task.hidden = true;
    startButton.focus();
  });

  win.addEventListener("pointerdown", () => setActive(win.id));
  win.addEventListener("focusin", () => setActive(win.id));
});

document.querySelectorAll("[data-open], [data-task]").forEach((link) => {
  link.addEventListener("click", () => {
    openWindow(link.dataset.open || link.dataset.task);
    closeStartMenu(false);
  });
});

// Aktiivinen ikkuna seuraa vieritystä: se, joka on näytön yläkolmanneksen kohdalla
let scrollQueued = false;
function syncActiveToScroll() {
  scrollQueued = false;
  const line = window.innerHeight * 0.33;
  let best = null;
  let bestDistance = Infinity;
  for (const win of windows) {
    if (win.hidden) continue;
    const rect = win.getBoundingClientRect();
    if (rect.top <= line && rect.bottom >= line) {
      best = win;
      break;
    }
    const distance = Math.min(Math.abs(rect.top - line), Math.abs(rect.bottom - line));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = win;
    }
  }
  if (best) setActive(best.id);
}
window.addEventListener("scroll", () => {
  if (!scrollQueued) {
    scrollQueued = true;
    requestAnimationFrame(syncActiveToScroll);
  }
}, { passive: true });

// --- Käynnistä-valikko --------------------------------------------------------

const startButton = document.getElementById("start");
const startMenu = document.getElementById("startmenu");
const menuLinks = [...startMenu.querySelectorAll("a")];

function openStartMenu() {
  startMenu.hidden = false;
  startButton.setAttribute("aria-expanded", "true");
  menuLinks[0].focus();
}

function closeStartMenu(returnFocus) {
  if (startMenu.hidden) return;
  startMenu.hidden = true;
  startButton.setAttribute("aria-expanded", "false");
  if (returnFocus) startButton.focus();
}

startButton.addEventListener("click", () => {
  if (startMenu.hidden) openStartMenu();
  else closeStartMenu(false);
});

startMenu.addEventListener("keydown", (event) => {
  const index = menuLinks.indexOf(document.activeElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    menuLinks[(index + step + menuLinks.length) % menuLinks.length].focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    menuLinks[0].focus();
  } else if (event.key === "End") {
    event.preventDefault();
    menuLinks[menuLinks.length - 1].focus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeStartMenu(true);
});

document.addEventListener("pointerdown", (event) => {
  if (!startMenu.hidden && !startMenu.contains(event.target) && !startButton.contains(event.target)) {
    closeStartMenu(false);
  }
});

startMenu.addEventListener("focusout", (event) => {
  if (event.relatedTarget && !startMenu.contains(event.relatedTarget) && event.relatedTarget !== startButton) {
    closeStartMenu(false);
  }
});

// --- Komentokehote: tracert-rivit ilmestyvät kerran, kun ikkuna tulee näkyviin ---

const term = document.getElementById("term");
if (term && !reduceMotion && "IntersectionObserver" in window) {
  term.classList.add("is-pending");
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    const lines = [...term.querySelectorAll(".term-line")];
    let delay = 0;
    lines.forEach((line, i) => {
      // Hypyt tulevat hitaammin, kuten oikeassa reitinjäljityksessä
      delay += line.classList.contains("hop") ? 420 : i === 0 ? 0 : 160;
      setTimeout(() => line.classList.add("is-shown"), delay);
    });
    setTimeout(() => term.classList.remove("is-pending"), delay + 50);
  }, { threshold: 0.35 });
  observer.observe(term);
}

// --- Käynnistys -----------------------------------------------------------------

const initial = savedLang() || ((navigator.language || "fi").toLowerCase().startsWith("fi") ? "fi" : "en");
setLang(initial, false);
setInterval(renderClock, 15000);
loadStatus();

const hashTarget = location.hash.slice(1);
setActive(windows.some((w) => w.id === hashTarget) ? hashTarget : windows[0].id);
