const STORAGE_KEY = "onyx-state-v2";
const DB_NAME = "onyx-db";
const DB_STORE = "history";
const DEMO_SAMPLE = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";
const BUILTIN_KEYS = {
  // Built-in demo key; users can override in settings.
  soundCloudClientId: "iuspDvaXDbD3AnFwLWK56Fk69q56xsKu"
};

const demoTracks = [
  { id: "t1", title: "Basalt Bloom", artist: "Aurora Vein", duration: 214, source: "ONYX Demo", tags: ["HI-FI", "STONE"], liked: false, streamUrl: DEMO_SAMPLE, artwork: "" },
  { id: "t2", title: "Midnight Quarry", artist: "Granite Echo", duration: 188, source: "ONYX Demo", tags: ["RADIO", "NIGHT"], liked: true, streamUrl: DEMO_SAMPLE, artwork: "" },
  { id: "t3", title: "Glass Veins", artist: "Cinder Loop", duration: 241, source: "My Library", tags: ["LOCAL", "IDM"], liked: false, streamUrl: DEMO_SAMPLE, artwork: "" },
  { id: "t4", title: "Obsidian Relay", artist: "Riva Ctrl", duration: 199, source: "ONYX Demo", tags: ["WAVE", "BASS"], liked: false, streamUrl: DEMO_SAMPLE, artwork: "" },
  { id: "t5", title: "Noir Fragments", artist: "Drumline K", duration: 275, source: "ONYX Demo", tags: ["LIVE", "MIX"], liked: false, streamUrl: DEMO_SAMPLE, artwork: "" },
  { id: "t6", title: "Signal Through Stone", artist: "Modal M", duration: 228, source: "My Library", tags: ["LOCAL", "VOCAL"], liked: false, streamUrl: DEMO_SAMPLE, artwork: "" }
];

const activeUsers = [
  { name: "aurora.wav", uid: "#1204", session: "31 мин", status: "Сейчас онлайн" },
  { name: "riva.ctrl", uid: "#2856", session: "14 мин", status: "Сейчас онлайн" },
  { name: "drumline.k", uid: "#3901", session: "47 мин", status: "Сейчас онлайн" },
  { name: "modal.m", uid: "#4022", session: "8 мин", status: "Сейчас онлайн" }
];

const themes = [
  { id: "onyx", name: "ONYX Default", bg: "#080808", bg2: "#12101a", accent: "#9b87f5", accent2: "#64b5f6", cream: "#e8d5b7" },
  { id: "midnight", name: "Midnight Stone", bg: "#071019", bg2: "#0f2436", accent: "#89b7ff", accent2: "#b9d7ff", cream: "#dfe9f7" },
  { id: "crimson", name: "Crimson Vein", bg: "#120808", bg2: "#241111", accent: "#c85a73", accent2: "#d8a96b", cream: "#f0d9ba" },
  { id: "emerald", name: "Emerald Core", bg: "#07110d", bg2: "#0f261b", accent: "#4fd18c", accent2: "#d9fff0", cream: "#f2fffa" },
  { id: "obsidian", name: "Obsidian", bg: "#050505", bg2: "#0b0b0b", accent: "#ffffff", accent2: "#bababa", cream: "#ededed" }
];

const defaults = {
  user: { nickname: "obsidian.echo", email: "stone@onyx.app", uid: "#2856" },
  queue: [...demoTracks.slice(0, 3).map((track) => track.id)],
  currentTrackId: null,
  playing: false,
  currentSource: "all",
  stats: { plays: 0, artists: 0, minutes: 0 },
  historyEnabled: true,
  externalTracks: {},
  searchCache: [],
  settings: {
    theme: "onyx",
    quality: "balanced",
    reduceMotion: false,
    simpleGraphics: false,
    freezeBackground: true,
    disableVideo: true,
    retroWidgets: true,
    adhdMode: false,
    floatingMedia: false,
    stoneClick: true,
    serviceToken: "",
    soundCloudClientId: "",
    youtubeApiKey: "",
    giphyKey: "",
    searchMode: "direct",
    veinIntensity: 42,
    radius: 24,
    coverStyle: "rounded",
    rotateCover: false
  }
};

const sourceMap = {
  apple: "Apple Previews",
  jamendo: "Jamendo",
  soundcloud: "SoundCloud",
  youtube: "YouTube",
  all: "All Sources",
  library: "My Library"
};

const audio = new Audio();
audio.preload = "metadata";
audio.crossOrigin = "anonymous";
let soundCloudWidget = null;
let soundCloudWidgetReady = null;
let soundCloudDuration = 0;
let suppressAudioPauseSync = false;
let suppressWidgetPauseSync = false;
let soundCloudProgressSeen = false;

let state = loadState();
let dbPromise = null;
let progressTimer = null;
let currentSeconds = 0;
let searchTimer = null;
let searchController = null;
let lyricsController = null;
const lyricsCache = {};
let playerPageMode = "compact";
const supportedSources = new Set(["apple", "jamendo", "soundcloud", "youtube", "all", "library"]);
let mobileContentFilter = "all";

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaults));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const next = {
      ...defaults,
      ...saved,
      user: { ...defaults.user, ...(saved?.user || {}) },
      stats: { ...defaults.stats, ...(saved?.stats || {}) },
      settings: { ...defaults.settings, ...(saved?.settings || {}) },
      externalTracks: { ...(saved?.externalTracks || {}) }
    };
    if (!next.settings.soundCloudClientId) {
      next.settings.soundCloudClientId = BUILTIN_KEYS.soundCloudClientId;
    }
    next.queue = Array.isArray(next.queue)
      ? next.queue.filter((id) => demoTracks.some((track) => track.id === id) || next.externalTracks[id])
      : [...defaults.queue];
    next.currentTrackId = demoTracks.some((track) => track.id === next.currentTrackId) || next.externalTracks[next.currentTrackId]
      ? next.currentTrackId
      : null;
    next.searchCache = Array.isArray(next.searchCache) ? next.searchCache : [];
    return next;
  } catch {
    return cloneDefaults();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function rememberTrack(track) {
  if (!track?.id) return;
  if (!demoTracks.some((item) => item.id === track.id)) {
    state.externalTracks[track.id] = track;
  }
}

function toast(message) {
  let root = document.querySelector(".toast-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast-root";
    document.body.appendChild(root);
  }

  const item = document.createElement("div");
  item.className = "toast-item";
  item.textContent = message;
  root.appendChild(item);

  window.setTimeout(() => {
    item.classList.add("is-leaving");
    window.setTimeout(() => item.remove(), 220);
  }, 2200);
}

function getTrack(id) {
  return demoTracks.find((track) => track.id === id) || state.externalTracks[id] || demoTracks[0];
}

function getQueueTracks() {
  return state.queue.map(getTrack);
}

function trackLink(id) {
  return `/player.html?track=${encodeURIComponent(id)}`;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function parseLocalTrackMeta(fileName) {
  const clean = fileName.replace(/\.[^/.]+$/, "").trim();
  const parts = clean.split(/\s*-\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "Local file", title: clean || "Unknown track" };
}

function isSoundCloudTrack(track) {
  return track?.source === "SoundCloud" && !!track?.externalUrl;
}

function getActiveDuration(track) {
  if (isSoundCloudTrack(track) && soundCloudDuration > 0) return soundCloudDuration;
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (track?.duration || 0);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      if (existing.dataset.loaded === "true") resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensureSoundCloudWidget() {
  if (soundCloudWidgetReady) return soundCloudWidgetReady;
  soundCloudWidgetReady = (async () => {
    await loadScript("https://w.soundcloud.com/player/api.js");
    const iframe = document.createElement("iframe");
    iframe.id = "soundCloudWidgetFrame";
    iframe.allow = "autoplay";
    iframe.style.position = "fixed";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.left = "-9999px";
    iframe.style.bottom = "0";
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/forss/flickermood&auto_play=false&buying=false&liking=false&download=false&sharing=false&show_artwork=false&show_comments=false&show_playcount=false&show_teaser=false&visual=false";
    document.body.appendChild(iframe);

    soundCloudWidget = window.SC.Widget(iframe);
    soundCloudWidget.bind(window.SC.Widget.Events.READY, () => {
      soundCloudWidget.bind(window.SC.Widget.Events.PLAY, () => {
        suppressAudioPauseSync = true;
        audio.pause();
        suppressAudioPauseSync = false;
        state.playing = true;
        updatePlayerUI();
        saveState();
      });
      soundCloudWidget.bind(window.SC.Widget.Events.PAUSE, () => {
        if (suppressWidgetPauseSync) return;
        state.playing = false;
        updatePlayerUI();
        saveState();
      });
      soundCloudWidget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (event) => {
        soundCloudProgressSeen = true;
        currentSeconds = (event.currentPosition || 0) / 1000;
        soundCloudDuration = (event.relativePosition && currentSeconds > 0)
          ? currentSeconds / event.relativePosition
          : soundCloudDuration;
        updatePlayerUI();
      });
      soundCloudWidget.bind(window.SC.Widget.Events.FINISH, async () => {
        const track = state.currentTrackId ? getTrack(state.currentTrackId) : null;
        state.stats.plays += 1;
        state.stats.minutes += Math.ceil((soundCloudDuration || track?.duration || 0) / 60);
        await setTrackHistory(track);
        stepQueue(1);
      });
    });
    return soundCloudWidget;
  })();
  return soundCloudWidgetReady;
}

async function loadSoundCloudTrack(track, autoPlay = false) {
  if (!isSoundCloudTrack(track)) return false;
  const widget = await ensureSoundCloudWidget();
  return await new Promise((resolve) => {
    widget.load(track.externalUrl, {
      auto_play: autoPlay,
      buying: false,
      liking: false,
      download: false,
      sharing: false,
      show_artwork: false,
      show_comments: false,
      show_playcount: false,
      show_teaser: false,
      visual: false
    });
    widget.bind(window.SC.Widget.Events.READY, () => {
      soundCloudDuration = 0;
      soundCloudProgressSeen = false;
      currentSeconds = 0;
      widget.getDuration((duration) => {
        soundCloudDuration = Math.max(0, (duration || 0) / 1000);
        updatePlayerUI();
      });
      resolve(true);
    });
  });
}

function pauseSoundCloudWidget() {
  if (!soundCloudWidget) return;
  suppressWidgetPauseSync = true;
  soundCloudWidget.pause();
  window.setTimeout(() => {
    suppressWidgetPauseSync = false;
  }, 50);
}

async function verifySoundCloudStarted(track) {
  if (!isSoundCloudTrack(track) || !soundCloudWidget || !state.playing) return true;
  await new Promise((resolve) => window.setTimeout(resolve, 1800));
  if (!state.playing || !isSoundCloudTrack(track)) return true;

  return await new Promise((resolve) => {
    soundCloudWidget.getPosition(async (positionMs) => {
      const moved = (positionMs || 0) > 800 || soundCloudProgressSeen || currentSeconds > 0.8;
      if (moved) {
        resolve(true);
        return;
      }

      const canFallback = await resolveTrackStream(track);
      if (canFallback && syncAudio(track)) {
        pauseSoundCloudWidget();
        audio.play().then(() => {
          state.playing = true;
          updatePlayerUI();
          saveState();
          toast("SoundCloud не стартовал, включён preview-фолбек.");
          resolve(true);
        }).catch(() => {
          state.playing = false;
          updatePlayerUI();
          toast("Трек найден, но поток не стартует.");
          resolve(false);
        });
      } else {
        state.playing = false;
        updatePlayerUI();
        toast("SoundCloud не дал поток для этого трека.");
        resolve(false);
      }
    });
  });
}

function initials(name) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function setTheme(themeId) {
  const theme = themes.find((entry) => entry.id === themeId) || themes[0];
  document.documentElement.style.setProperty("--bg", theme.bg);
  document.documentElement.style.setProperty("--bg-2", theme.bg2);
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--accent-2", theme.accent2);
  document.documentElement.style.setProperty("--cream", theme.cream);
  state.settings.theme = theme.id;
  saveState();
}

function applyCustomControls() {
  document.documentElement.style.setProperty("--vein-opacity", `${state.settings.veinIntensity / 1000}`);
  document.documentElement.style.setProperty("--radius", `${state.settings.radius}px`);
  document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
  document.body.classList.toggle("simple-graphics", state.settings.simpleGraphics);
}

function detectDeviceProfile() {
  const ua = navigator.userAgent || "";
  const touch = navigator.maxTouchPoints > 0;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const isMobileUA = /Android|iPhone|iPod|Windows Phone|Mobile/i.test(ua);
  const isTabletUA = /iPad|Tablet/i.test(ua);
  const byViewport = window.innerWidth <= 880;
  const isMobile = (isMobileUA && !isTabletUA) || (byViewport && (touch || coarsePointer));
  const formFactor = isTabletUA ? "tablet" : (isMobile ? "mobile" : "desktop");

  document.body.dataset.device = formFactor;
  document.body.classList.toggle("is-mobile", formFactor === "mobile");

  const tabsRoot = document.getElementById("mobileContentTabs");
  if (tabsRoot) {
    tabsRoot.hidden = formFactor !== "mobile";
  }
}

function initDeviceProfile() {
  detectDeviceProfile();
  window.addEventListener("resize", detectDeviceProfile);
}

function initMobileBottomNav() {
  const page = document.body.dataset.page;
  const supportedPages = new Set(["home", "queue", "profile", "settings"]);
  if (!supportedPages.has(page)) return;

  const existing = document.getElementById("mobileBottomNav");
  if (existing) existing.remove();

  const nav = document.createElement("nav");
  nav.id = "mobileBottomNav";
  nav.className = "mobile-bottom-nav";
  nav.setAttribute("aria-label", "Мобильная навигация");
  nav.innerHTML = `
    <a class="mobile-bottom-nav__item" data-mobile-nav="home" href="/home.html">
      <span class="mobile-bottom-nav__icon">⌂</span>
      <span>Главная</span>
    </a>
    <a class="mobile-bottom-nav__item" data-mobile-nav="search" href="/home.html#search">
      <span class="mobile-bottom-nav__icon">⌕</span>
      <span>Поиск</span>
    </a>
    <a class="mobile-bottom-nav__item" data-mobile-nav="library" href="/queue.html">
      <span class="mobile-bottom-nav__icon">≣</span>
      <span>Моя медиатека</span>
    </a>
    <a class="mobile-bottom-nav__item" data-mobile-nav="settings" href="/settings.html">
      <span class="mobile-bottom-nav__icon">⚙</span>
      <span>Настройки</span>
    </a>
  `;

  const activeTab = (() => {
    if (page === "home" && location.hash === "#search") return "search";
    if (page === "home") return "home";
    if (page === "queue" || page === "profile") return "library";
    if (page === "settings") return "settings";
    return "home";
  })();
  nav.querySelector(`[data-mobile-nav="${activeTab}"]`)?.classList.add("is-active");
  document.body.appendChild(nav);
}

function initMobileContentTabs() {
  const tabsRoot = document.getElementById("mobileContentTabs");
  if (!tabsRoot) return;

  const show = document.body.dataset.device === "mobile";
  tabsRoot.hidden = !show;
  if (!show) return;

  tabsRoot.querySelectorAll("[data-mobile-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mobileTab === mobileContentFilter);
    button.addEventListener("click", () => {
      mobileContentFilter = button.dataset.mobileTab || "all";
      tabsRoot.querySelectorAll("[data-mobile-tab]").forEach((node) => {
        node.classList.toggle("is-active", node === button);
      });
      renderCatalog(document.getElementById("searchInput")?.value || "");
    });
  });
}

function initCursor() {
  document.querySelectorAll(".crystal-cursor").forEach((node) => node.remove());
}

function stoneClick() {
  if (!state.settings.stoneClick) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(110, ctx.currentTime);
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.14);
}

function initGlobalClickSound() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("button, .button, a")) stoneClick();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  // Dev-friendly behavior: remove old service workers and caches
  // so UI/code updates are visible immediately without hard refresh.
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});

  if ("caches" in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}

function syncAudio(track) {
  if (!track?.streamUrl) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    return false;
  }

  if (audio.src !== track.streamUrl) {
    audio.src = track.streamUrl;
    audio.load();
  }

  return true;
}

async function resolveTrackStream(track) {
  if (!track) return false;
  if (track.streamUrl) return true;

  const term = `${track.artist || ""} ${track.title || ""}`.trim();
  if (!term) return false;

  try {
    const deezerRes = await fetch(`/api/deezer/search?term=${encodeURIComponent(term)}`);
    if (deezerRes.ok) {
      const deezerData = await deezerRes.json();
      const deezerCandidate = Array.isArray(deezerData.data) ? deezerData.data.find((item) => item?.preview) : null;
      if (deezerCandidate?.preview) {
        track.streamUrl = deezerCandidate.preview;
        if (!track.duration && deezerCandidate.duration) {
          track.duration = Math.max(1, Number(deezerCandidate.duration));
        }
        if (!track.artwork) {
          track.artwork = deezerCandidate.album?.cover_xl || deezerCandidate.album?.cover_big || deezerCandidate.album?.cover_medium || "";
        }
      }
    }

    if (!track.streamUrl) {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=1`);
      if (response.ok) {
        const data = await response.json();
        const candidate = Array.isArray(data.results) ? data.results[0] : null;
        if (candidate?.previewUrl) {
          track.streamUrl = candidate.previewUrl;
          if (!track.duration && candidate.trackTimeMillis) {
            track.duration = Math.max(1, Math.round(candidate.trackTimeMillis / 1000));
          }
          if (!track.artwork && candidate.artworkUrl100) {
            track.artwork = candidate.artworkUrl100.replace("100x100", "512x512");
          }
        }
      }
    }

    if (!track.streamUrl) {
      return false;
    }
    rememberTrack(track);
    saveState();
    return true;
  } catch {
    return false;
  }
}

function setCurrentTrack(trackId) {
  state.currentTrackId = trackId;
  currentSeconds = 0;
  soundCloudDuration = 0;
  if (!state.queue.includes(trackId)) state.queue.unshift(trackId);
  const track = getTrack(trackId);
  pauseSoundCloudWidget();
  syncAudio(track);
  updatePlayerUI();
  renderExpandedPlayer();
  saveState();
}

async function togglePlay(force) {
  state.playing = typeof force === "boolean" ? force : !state.playing;
  if (state.playing && !state.currentTrackId && state.queue.length) {
    state.currentTrackId = state.queue[0];
  }

  const track = state.currentTrackId ? getTrack(state.currentTrackId) : null;
  if (state.playing && track) {
    pauseSoundCloudWidget();
    const canPlay = syncAudio(track) || await resolveTrackStream(track) && syncAudio(track);
    if (canPlay) {
      audio.play().catch(() => {
        state.playing = false;
        updatePlayerUI();
        toast("Не удалось воспроизвести этот источник.");
      });
    } else {
      state.playing = false;
      toast("Не удалось найти playable-версию. Попробуйте другой трек или источник.");
    }
  } else {
    audio.pause();
    pauseSoundCloudWidget();
  }

  updatePlayerUI();
  saveState();
}

function stepQueue(direction) {
  if (!state.queue.length) return;
  const index = state.queue.indexOf(state.currentTrackId);
  const nextIndex = index === -1 ? 0 : (index + direction + state.queue.length) % state.queue.length;
  setCurrentTrack(state.queue[nextIndex]);
  togglePlay(true);
}

function updatePlayerUI() {
  const track = state.currentTrackId ? getTrack(state.currentTrackId) : null;
  const title = track?.title || "Нет трека";
  const artist = track?.artist || "Выберите трек из поиска или локальной библиотеки.";
  const duration = getActiveDuration(track);
  const progress = duration ? Math.min(100, (currentSeconds / duration) * 100) : 0;

  setText("trackTitle", title);
  setText("trackArtist", track ? `${artist} • ${track.source}` : artist);
  setText("miniTitle", title);
  setText("miniArtist", track ? `${artist} • ${track.source}` : "Очередь пуста");
  setText("miniCurrentTime", formatTime(currentSeconds));
  setText("miniTotalTime", formatTime(duration));
  setText("profileTrackTitle", title);
  setText("profileTrackArtist", track ? `${artist} • ${track.source}` : "Плеер ждёт первый запуск");
  setText("currentTime", formatTime(currentSeconds));
  setText("totalTime", formatTime(duration));

  const timelineFill = document.getElementById("timelineFill");
  if (timelineFill) timelineFill.style.width = `${progress}%`;
  const overlayTimelineFill = document.getElementById("overlayTimelineFill");
  if (overlayTimelineFill) overlayTimelineFill.style.width = `${progress}%`;
  const miniTimelineFill = document.getElementById("miniTimelineFill");
  if (miniTimelineFill) miniTimelineFill.style.width = `${progress}%`;

  document.querySelectorAll("#playToggle, #miniPlay, #profilePlay, #playerPlay").forEach((button) => {
    button.textContent = state.playing ? "❚❚" : "▶";
  });

  const cover = document.getElementById("coverArt");
  if (cover) {
    cover.style.filter = track ? "saturate(1)" : "grayscale(1)";
    if (track?.artwork) {
      cover.style.backgroundImage = `linear-gradient(160deg, rgba(12,12,12,0.45), rgba(8,8,8,0.9)), url("${track.artwork}")`;
      cover.style.backgroundSize = "cover";
      cover.style.backgroundPosition = "center";
    } else {
      cover.style.backgroundImage = "";
      cover.style.backgroundSize = "";
      cover.style.backgroundPosition = "";
    }
  }
  applyCoverNode(document.getElementById("miniCover"), track);

  if (window.ONYX?.sendNative) {
    ONYX.sendNative("native.player.state", { playing: state.playing, track });
  }

  renderExpandedPlayer();
  renderPlayerPage();

  clearInterval(progressTimer);
}

async function fetchLyrics(track) {
  if (!track?.title || !track?.artist) return "Нет текста песни";
  const cacheKey = `${track.artist}::${track.title}`.toLowerCase();
  if (lyricsCache[cacheKey]) return lyricsCache[cacheKey];

  if (lyricsController) lyricsController.abort();
  lyricsController = new AbortController();
  const { signal } = lyricsController;

  const artist = encodeURIComponent(track.artist);
  const title = encodeURIComponent(track.title);

  try {
    const lrcRes = await fetch(`https://lrclib.net/api/search?artist_name=${artist}&track_name=${title}`, { signal });
    if (lrcRes.ok) {
      const lrcData = await lrcRes.json();
      const candidate = Array.isArray(lrcData) ? lrcData[0] : null;
      const text = candidate?.plainLyrics || candidate?.syncedLyrics || "";
      if (text.trim()) {
        lyricsCache[cacheKey] = text.trim();
        return lyricsCache[cacheKey];
      }
    }
  } catch (error) {
    if (error.name === "AbortError") return "";
  }

  try {
    const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`, { signal });
    if (ovhRes.ok) {
      const ovhData = await ovhRes.json();
      if (ovhData?.lyrics?.trim()) {
        lyricsCache[cacheKey] = ovhData.lyrics.trim();
        return lyricsCache[cacheKey];
      }
    }
  } catch (error) {
    if (error.name === "AbortError") return "";
  }

  lyricsCache[cacheKey] = "Для этого трека текст не найден.";
  return lyricsCache[cacheKey];
}

function openExpandedPlayer() {
  const modal = document.getElementById("expandedPlayer");
  if (!modal) return;
  modal.style.display = "grid";
  modal.hidden = false;
  document.body.classList.add("overlay-open");
  renderExpandedPlayer();
}

function closeExpandedPlayer() {
  const modal = document.getElementById("expandedPlayer");
  if (!modal) return;
  modal.hidden = true;
  modal.style.display = "none";
  document.body.classList.remove("overlay-open");
}

function renderExpandedPlayer() {
  const modal = document.getElementById("expandedPlayer");
  if (!modal) return;
  const track = state.currentTrackId ? getTrack(state.currentTrackId) : null;
  if (!track) return;

  setText("overlayTrackTitle", track.title || "Нет трека");
  setText("overlayTrackArtist", track.artist || "Неизвестный исполнитель");
  setText("overlayCurrentTime", formatTime(currentSeconds));
  const duration = getActiveDuration(track);
  setText("overlayTotalTime", formatTime(duration));

  const cover = document.getElementById("overlayCover");
  if (cover) {
    if (track.artwork) {
      cover.style.backgroundImage = `url("${track.artwork}")`;
      cover.style.backgroundSize = "cover";
      cover.style.backgroundPosition = "center";
    } else {
      cover.style.backgroundImage = "";
      cover.style.backgroundSize = "";
      cover.style.backgroundPosition = "";
    }
  }

  const playButton = document.getElementById("overlayPlay");
  if (playButton) playButton.textContent = state.playing ? "❚❚" : "▶";

  const lyricsNode = document.getElementById("overlayLyrics");
  if (lyricsNode && !lyricsNode.dataset.trackIdLoaded && track.id) {
    lyricsNode.textContent = "Ищу текст песни...";
  }

  if (lyricsNode && lyricsNode.dataset.trackIdLoaded !== track.id) {
    lyricsNode.dataset.trackIdLoaded = track.id;
    fetchLyrics(track).then((text) => {
      if (lyricsNode.dataset.trackIdLoaded === track.id) {
        lyricsNode.textContent = text || "Для этого трека текст не найден.";
      }
    });
  }
}

function getCoverClass() {
  const style = state.settings.coverStyle || "rounded";
  if (style === "square") return "cover-variant--square";
  if (style === "disc") return "cover-variant--disc";
  return "cover-variant--rounded";
}

function applyCoverNode(node, track) {
  if (!node) return;
  node.classList.remove("cover-variant--square", "cover-variant--rounded", "cover-variant--disc", "is-rotating");
  node.classList.add(getCoverClass());
  if (track?.artwork) {
    node.style.backgroundImage = `url("${track.artwork}")`;
    node.style.backgroundSize = "cover";
    node.style.backgroundPosition = "center";
  } else {
    node.style.backgroundImage = "";
    node.style.backgroundSize = "";
    node.style.backgroundPosition = "";
  }
}

function hashColor(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 72% 20%)`;
}

function applyPlayerMode(mode) {
  playerPageMode = mode;
  const compact = document.getElementById("playerCompact");
  const lyrics = document.getElementById("playerLyrics");
  const art = document.getElementById("playerArt");
  if (!compact || !lyrics || !art) return;
  compact.hidden = mode !== "compact";
  lyrics.hidden = mode !== "lyrics";
  art.hidden = mode !== "art";
}

function renderLyricFrames(track, lyricsText, duration) {
  const lines = (lyricsText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const safeLines = lines.length ? lines : ["Для этого трека текст не найден."];
  const step = Math.max(1, Math.floor((duration || track.duration || 180) / safeLines.length));
  const currentIndex = Math.min(safeLines.length - 1, Math.floor(currentSeconds / step));

  const lyricsView = document.getElementById("lyricsViewLines");
  if (lyricsView) {
    lyricsView.innerHTML = safeLines.map((line, index) => `<p class="${index === currentIndex ? "is-active" : ""}">${line}</p>`).join("");
  }

  setText("artMainLine", safeLines[currentIndex] || "");
  setText("artNextLine", safeLines[currentIndex + 1] || "");
  setText("artNextLine2", safeLines[currentIndex + 2] || "");
}

function renderPlayerPage() {
  if (document.body.dataset.page !== "player") return;
  const track = state.currentTrackId ? getTrack(state.currentTrackId) : null;
  if (!track) return;

  const duration = getActiveDuration(track);
  const progress = duration ? Math.min(100, (currentSeconds / duration) * 100) : 0;
  const fill = document.getElementById("playerTimelineFill");
  if (fill) fill.style.width = `${progress}%`;

  setText("playerTitleLink", track.title || "Нет трека");
  setText("playerArtistLine", track.artist || "Неизвестный исполнитель");
  setText("playerCurrentTime", formatTime(currentSeconds));
  setText("playerTotalTime", formatTime(duration));
  setText("lyricsTrackTitle", `${track.title} - текст`);

  const titleLink = document.getElementById("playerTitleLink");
  if (titleLink) {
    titleLink.setAttribute("href", trackLink(track.id));
  }

  const miniTitleLink = document.getElementById("miniTitleLink");
  if (miniTitleLink) {
    miniTitleLink.setAttribute("href", trackLink(track.id));
  }

  applyCoverNode(document.getElementById("playerCover"), track);
  applyCoverNode(document.getElementById("artCover"), track);

  const artMode = document.getElementById("playerArt");
  if (artMode) {
    const bg = hashColor(`${track.title} ${track.artist}`);
    artMode.style.background = `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 45%), linear-gradient(125deg, ${bg}, #080808 72%)`;
  }

  fetchLyrics(track).then((lyricsText) => {
    if (state.currentTrackId === track.id) {
      renderLyricFrames(track, lyricsText, duration);
    }
  });
  applyPlayerMode(playerPageMode);
}

async function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function writeHistory(entry) {
  try {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(entry);
  } catch {
    return null;
  }
}

async function readHistory() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.playedAt - a.playedAt));
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function setTrackHistory(track) {
  if (!state.historyEnabled) return;
  await writeHistory({
    id: `${track.id}-${Date.now()}`,
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    source: track.source,
    playedAt: Date.now()
  });
  state.stats.artists = new Set((await readHistory()).map((entry) => entry.artist)).size;
  saveState();
  renderHistory();
}

async function runProviderSearch(term) {
  const searchTerm = term.trim();
  if (!searchTerm) {
    state.searchCache = [];
    renderCatalog("");
    renderSearchDropdown("");
    return;
  }

  if (searchController) searchController.abort();
  searchController = new AbortController();

  const callProvider = async (methodName, ...args) => {
    const fn = window.ONYX_PROVIDERS?.[methodName];
    if (typeof fn !== "function") return [];
    return await fn(...args);
  };
  const soundCloudClientId = (state.settings.soundCloudClientId || "").trim() || BUILTIN_KEYS.soundCloudClientId;

  try {
    let results = [];
    if (state.currentSource === "apple") {
      results = await callProvider("searchApple", searchTerm, searchController.signal);
    } else if (state.currentSource === "jamendo") {
      results = await callProvider("searchJamendo", searchTerm, state.settings.serviceToken.trim(), searchController.signal);
    } else if (state.currentSource === "soundcloud") {
      if (!soundCloudClientId) {
        state.searchCache = [];
        renderCatalog(searchTerm);
        renderSearchDropdown(searchTerm);
        toast("SoundCloud client_id не найден. Укажите его в Настройки -> Сервисы / API.");
        return;
      }
      results = await callProvider("searchSoundCloud", searchTerm, soundCloudClientId, searchController.signal);
    } else if (state.currentSource === "youtube") {
      if (!state.settings.youtubeApiKey.trim()) {
        state.searchCache = [];
        renderCatalog(searchTerm);
        renderSearchDropdown(searchTerm);
        toast("Для YouTube укажите API key в Настройки -> Сервисы / API.");
        return;
      }
      results = await callProvider("searchYouTube", searchTerm, state.settings.youtubeApiKey.trim(), searchController.signal);
    } else if (state.currentSource === "all") {
      const [apple, jamendo, soundcloud, deezer, youtube] = await Promise.allSettled([
        callProvider("searchApple", searchTerm, searchController.signal),
        callProvider("searchJamendo", searchTerm, state.settings.serviceToken.trim(), searchController.signal),
        callProvider("searchSoundCloud", searchTerm, soundCloudClientId, searchController.signal),
        callProvider("searchDeezer", searchTerm, searchController.signal),
        callProvider("searchYouTube", searchTerm, state.settings.youtubeApiKey.trim(), searchController.signal)
      ]);
      results = [apple, jamendo, soundcloud, deezer, youtube]
        .filter((item) => item.status === "fulfilled")
        .flatMap((item) => item.value);
    } else {
      results = Object.values(state.externalTracks)
        .concat(demoTracks)
        .filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    results.forEach(rememberTrack);
    state.searchCache = results;
    saveState();
    renderCatalog(searchTerm);
    renderSearchDropdown(searchTerm);

    if (!results.length) {
      toast("Ничего не найдено в выбранном источнике.");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    state.searchCache = [];
    renderCatalog(searchTerm);
    renderSearchDropdown(searchTerm);
    toast("Поиск не удался. Проверьте источник или API-ключ.");
  }
}

function renderCatalog(filter = "") {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;

  const query = filter.trim().toLowerCase();
  const localTracks = Object.values(state.externalTracks).filter((track) => track.source === "My Library");
  const tracks = query
    ? state.searchCache.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(query))
    : state.currentSource === "library"
      ? demoTracks.filter((track) => track.source === "My Library" || track.source === "ONYX Demo").concat(localTracks)
      : demoTracks;

  const contentFilteredTracks = mobileContentFilter === "all"
    ? tracks
    : tracks.filter((track) => {
      const text = `${track.title} ${track.artist} ${track.source} ${(track.tags || []).join(" ")}`.toLowerCase();
      if (mobileContentFilter === "music") return true;
      if (mobileContentFilter === "podcasts") return /podcast|talk|interview|шоу/.test(text);
      if (mobileContentFilter === "books") return /book|audiobook|книга|аудиокнига/.test(text);
      return true;
    });

  grid.innerHTML = contentFilteredTracks.map((track) => `
    <article class="track-card">
      <div class="track-card__head">
        <div class="track-card__cover"${track.artwork ? ` style="background-image:linear-gradient(160deg, rgba(12,12,12,0.45), rgba(8,8,8,0.9)), url('${track.artwork}'); background-size:cover; background-position:center;"` : ""}></div>
        <div>
          <a class="track-title-link" href="${trackLink(track.id)}">${track.title}</a>
          <div>${track.artist}</div>
          <small class="mono">${formatTime(track.duration)}</small>
        </div>
      </div>
      <div class="track-card__tags">${track.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
      <div class="section-head">
        <span>${track.source}</span>
        <div class="catalog-actions">
          <button class="button button--small" data-play="${track.id}" type="button">Play</button>
          ${track.externalUrl ? `<a class="button button--ghost button--small" href="${track.externalUrl}" target="_blank" rel="noopener noreferrer">Open</a>` : ""}
        </div>
      </div>
    </article>
  `).join("");

  if (!contentFilteredTracks.length) {
    const tabHint = mobileContentFilter !== "all" ? " или переключите вкладку контента" : "";
    grid.innerHTML = `<div class="empty-state">Ничего не найдено. Попробуйте другой запрос или источник${tabHint}.</div>`;
    return;
  }

  grid.querySelectorAll("[data-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.play;
      if (!state.queue.includes(id)) state.queue.push(id);
      setCurrentTrack(id);
      togglePlay(true);
      saveState();
      renderQueue();
    });
  });
}

function renderSearchDropdown(filter = "") {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;
  const query = filter.trim().toLowerCase();
  if (!query) {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    return;
  }

  const tracks = state.searchCache
    .filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(query))
    .slice(0, 6);

  if (!tracks.length) {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    return;
  }

  dropdown.hidden = false;
  dropdown.innerHTML = `
    <div class="search-dropdown__head">
      <span class="mono">Быстрый поиск</span>
      <span class="mono">${tracks.length}</span>
    </div>
    <div class="search-dropdown__list">
      ${tracks.map((track) => `
      <div class="search-dropdown__item">
        <div class="search-dropdown__left">
          <div class="search-dropdown__thumb"${track.artwork ? ` style="background-image:url('${track.artwork}');"` : ""}></div>
          <div class="search-dropdown__meta">
            <a class="track-title-link" href="${trackLink(track.id)}">${track.title}</a>
            <span>${track.artist} • ${track.source}</span>
          </div>
        </div>
        <div class="catalog-actions">
          <button class="button button--small" data-dropdown-play="${track.id}" type="button">Play</button>
          ${track.externalUrl ? `<a class="button button--ghost button--small" href="${track.externalUrl}" target="_blank" rel="noopener noreferrer">Open</a>` : ""}
        </div>
      </div>
      `).join("")}
    </div>
  `;

  dropdown.querySelectorAll("[data-dropdown-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.dropdownPlay;
      if (!state.queue.includes(id)) state.queue.push(id);
      setCurrentTrack(id);
      togglePlay(true);
      saveState();
      renderQueue();
      dropdown.hidden = true;
    });
  });
}

async function renderHistory() {
  const list = document.getElementById("historyList");
  const stateNode = document.getElementById("historyState");
  if (!list) return;
  const entries = (await readHistory()).slice(0, 6);

  if (!entries.length) {
    list.innerHTML = "";
    if (stateNode) stateNode.hidden = false;
  } else {
    if (stateNode) stateNode.hidden = true;
    list.innerHTML = entries.map((entry) => `
      <div class="list-item">
        <a class="track-title-link" href="${trackLink(entry.trackId)}">${entry.title}</a>
        <span>${entry.artist} • ${entry.source}</span>
      </div>
    `).join("");
  }

  setText("statPlays", String(state.stats.plays));
  setText("statArtists", String(state.stats.artists));
  setText("statMinutes", `${state.stats.minutes} мин`);
}

function renderTopArtists() {
  const grid = document.getElementById("topArtists");
  if (!grid) return;
  const counts = {};
  demoTracks.concat(Object.values(state.externalTracks)).forEach((track) => {
    counts[track.artist] = (counts[track.artist] || 0) + (track.liked ? 2 : 1);
  });
  grid.innerHTML = Object.entries(counts).slice(0, 6).map(([artist, count]) => `
    <article class="artist-card">
      <div class="artist-card__avatar">${artist.charAt(0)}</div>
      <strong>${artist}</strong>
      <span>${count} прослушиваний</span>
    </article>
  `).join("");
}

function renderProfile() {
  setText("profileName", state.user.nickname);
  setText("profileUid", state.user.uid);
  setText("profileAvatar", initials(state.user.nickname));
  const container = document.getElementById("activeUsers");
  if (container) {
    container.innerHTML = activeUsers.map((user) => `
      <div class="list-item">
        <strong>${user.name}</strong>
        <span>${user.uid} • ${user.session} • ${user.status}</span>
      </div>
    `).join("");
  }
}

function attachQueueEvents(list) {
  let draggedId = null;

  list.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      state.queue = state.queue.filter((id) => id !== button.dataset.remove);
      if (state.currentTrackId === button.dataset.remove) state.currentTrackId = state.queue[0] || null;
      saveState();
      renderQueue();
      updatePlayerUI();
    });
  });

  list.querySelectorAll("[data-queue-id]").forEach((item) => {
    item.addEventListener("dragstart", () => {
      draggedId = item.dataset.queueId;
    });
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    item.addEventListener("drop", () => {
      const targetId = item.dataset.queueId;
      if (!draggedId || draggedId === targetId) return;
      const from = state.queue.indexOf(draggedId);
      const to = state.queue.indexOf(targetId);
      const next = [...state.queue];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      state.queue = next;
      saveState();
      renderQueue();
    });
  });
}

function renderQueue() {
  const list = document.getElementById("queueList");
  const empty = document.getElementById("queueEmpty");
  if (!list) return;

  const tracks = getQueueTracks();
  if (!tracks.length) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  list.innerHTML = tracks.map((track, index) => `
    <div class="queue-item" draggable="true" data-queue-id="${track.id}">
      <div class="queue-item__meta">
        <span class="queue-item__drag">⋮⋮</span>
        <div class="track-card__cover"${track.artwork ? ` style="background-image:linear-gradient(160deg, rgba(12,12,12,0.45), rgba(8,8,8,0.9)), url('${track.artwork}'); background-size:cover; background-position:center;"` : ""}></div>
        <div>
          <a class="track-title-link" href="${trackLink(track.id)}">${track.title}</a>
          <span>${track.artist} • ${formatTime(track.duration)} • ${track.source}</span>
        </div>
      </div>
      <div class="section-head">
        <span class="mono">#${index + 1}</span>
        <button class="icon-button" data-remove="${track.id}" type="button">✕</button>
      </div>
    </div>
  `).join("");

  attachQueueEvents(list);
}

function renderThemes() {
  const grid = document.getElementById("themeGrid");
  if (!grid) return;

  grid.innerHTML = themes.map((theme) => `
    <button class="theme-swatch" data-theme="${theme.id}" type="button">
      <div class="theme-swatch__preview" style="background:linear-gradient(145deg, ${theme.bg}, ${theme.bg2}), linear-gradient(90deg, ${theme.accent}, ${theme.accent2});"></div>
      <strong>${theme.name}</strong>
      <div class="mono">${theme.id}</div>
    </button>
  `).join("");

  grid.querySelectorAll("[data-theme]").forEach((button) => {
    button.addEventListener("click", () => setTheme(button.dataset.theme));
  });
}

function hookInput(id, key) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = state.settings[key] || "";
  input.addEventListener("input", () => {
    state.settings[key] = input.value;
    saveState();
  });
}

function hookRange(id, key, callback) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = state.settings[key];
  input.addEventListener("input", () => {
    state.settings[key] = Number(input.value);
    saveState();
    callback?.();
  });
}

function initSettings() {
  initMobileBottomNav();
  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".settings-tab").forEach((node) => node.classList.remove("is-active"));
      document.querySelectorAll(".settings-pane").forEach((node) => node.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.querySelector(`[data-pane="${tab.dataset.tab}"]`)?.classList.add("is-active");
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((button) => {
    const key = button.dataset.toggle;
    button.classList.toggle("is-on", !!state.settings[key]);
    button.addEventListener("click", () => {
      state.settings[key] = !state.settings[key];
      button.classList.toggle("is-on", state.settings[key]);
      applyCustomControls();
      saveState();
      toast("Настройка обновлена.");
    });
  });

  document.querySelectorAll("[data-quality]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.quality === state.settings.quality);
    button.addEventListener("click", () => {
      state.settings.quality = button.dataset.quality;
      document.querySelectorAll("[data-quality]").forEach((node) => node.classList.toggle("is-active", node === button));
      saveState();
    });
  });

  hookInput("serviceToken", "serviceToken");
  hookInput("soundCloudClientId", "soundCloudClientId");
  hookInput("youtubeApiKey", "youtubeApiKey");
  hookInput("coverStyle", "coverStyle");
  hookInput("giphyKey", "giphyKey");
  hookInput("searchMode", "searchMode");
  hookRange("veinIntensity", "veinIntensity", applyCustomControls);
  hookRange("radiusControl", "radius", applyCustomControls);

  document.getElementById("apiHelp")?.addEventListener("click", () => document.getElementById("helpModal")?.showModal());
  document.getElementById("closeModal")?.addEventListener("click", () => document.getElementById("helpModal")?.close());
  document.getElementById("resetHotkeys")?.addEventListener("click", () => toast("Демо: хоткеи сброшены к значениям по умолчанию."));

  document.getElementById("saveCustomTheme")?.addEventListener("click", () => {
    const bg = document.getElementById("customBackground")?.value || "#080808";
    const accent = document.getElementById("customAccent")?.value || "#9b87f5";
    document.documentElement.style.setProperty("--bg", bg);
    document.documentElement.style.setProperty("--bg-2", bg);
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-2", accent);
    saveState();
    toast("Кастомная тема применена.");
  });

  document.getElementById("exportTheme")?.addEventListener("click", () => {
    const payload = JSON.stringify({
      bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
      accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
      veinIntensity: state.settings.veinIntensity,
      radius: state.settings.radius
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href: url, download: "onyx-theme.onyxtheme" });
    link.click();
    URL.revokeObjectURL(url);
    toast("Тема экспортирована.");
  });

  document.getElementById("importTheme")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const theme = JSON.parse(text);
      if (theme.bg) document.documentElement.style.setProperty("--bg", theme.bg);
      if (theme.accent) document.documentElement.style.setProperty("--accent", theme.accent);
      if (theme.veinIntensity != null) state.settings.veinIntensity = Number(theme.veinIntensity);
      if (theme.radius != null) state.settings.radius = Number(theme.radius);
      applyCustomControls();
      saveState();
      toast("Тема импортирована.");
    } catch {
      toast("Не удалось импортировать тему.");
    }
  });

  renderThemes();
}

function initHome() {
  initMobileContentTabs();
  initMobileBottomNav();
  renderCatalog();
  renderTopArtists();
  renderHistory();
  renderQueue();
  updatePlayerUI();

  document.getElementById("searchInput")?.addEventListener("input", (event) => {
    const term = event.target.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => runProviderSearch(term), 350);
  });

  document.getElementById("localTrackInput")?.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const importedIds = [];
    files.forEach((file, index) => {
      const { title, artist } = parseLocalTrackMeta(file.name);
      const id = `local-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
      const track = {
        id,
        title,
        artist,
        duration: 0,
        source: "My Library",
        tags: ["LOCAL", "UPLOAD"],
        liked: false,
        streamUrl: URL.createObjectURL(file),
        artwork: "",
        externalUrl: ""
      };
      state.externalTracks[id] = track;
      importedIds.push(id);
    });

    if (importedIds.length) {
      importedIds.forEach((id) => {
        if (!state.queue.includes(id)) state.queue.unshift(id);
      });
      setCurrentTrack(importedIds[0]);
      togglePlay(true);
      saveState();
      renderCatalog(document.getElementById("searchInput")?.value || "");
      renderQueue();
      toast(`Импортировано треков: ${importedIds.length}`);
    }

    event.target.value = "";
  });

  if (location.hash === "#search") {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => searchInput.focus(), 120);
    }
  }

  document.addEventListener("click", (event) => {
    const dropdown = document.getElementById("searchDropdown");
    if (!dropdown) return;
    if (!event.target.closest(".searchbar, #searchDropdown")) {
      dropdown.hidden = true;
    }
  });

  document.querySelectorAll("[data-source]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.source === state.currentSource);
    button.addEventListener("click", () => {
      state.currentSource = button.dataset.source;
      document.querySelectorAll("[data-source]").forEach((node) => node.classList.toggle("is-active", node === button));
      runProviderSearch(document.getElementById("searchInput")?.value || "");
      saveState();
    });
  });

  document.getElementById("historySwitch")?.classList.toggle("is-on", state.historyEnabled);
  document.getElementById("historySwitch")?.addEventListener("click", (event) => {
    state.historyEnabled = !state.historyEnabled;
    event.currentTarget.classList.toggle("is-on", state.historyEnabled);
    event.currentTarget.setAttribute("aria-pressed", String(state.historyEnabled));
    saveState();
  });

  document.getElementById("playToggle")?.addEventListener("click", () => togglePlay());
  document.getElementById("overlayPlay")?.addEventListener("click", () => togglePlay());
  document.getElementById("overlayPrev")?.addEventListener("click", () => stepQueue(-1));
  document.getElementById("overlayNext")?.addEventListener("click", () => stepQueue(1));
  document.getElementById("openExpandedPlayer")?.addEventListener("click", () => openExpandedPlayer());
  document.getElementById("closeExpandedPlayer")?.addEventListener("click", () => closeExpandedPlayer());
  document.querySelector(".expanded-player__backdrop")?.addEventListener("click", () => closeExpandedPlayer());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeExpandedPlayer();
  });
  document.getElementById("miniPlay")?.addEventListener("click", () => togglePlay());
  document.getElementById("miniPrev")?.addEventListener("click", () => stepQueue(-1));
  document.getElementById("miniNext")?.addEventListener("click", () => stepQueue(1));
  document.getElementById("prevTrack")?.addEventListener("click", () => stepQueue(-1));
  document.getElementById("nextTrack")?.addEventListener("click", () => stepQueue(1));
  document.getElementById("enqueueTrack")?.addEventListener("click", () => {
    const id = state.currentTrackId || demoTracks[0].id;
    state.queue.push(id);
    saveState();
    renderQueue();
    toast("Трек добавлен в очередь.");
  });
  document.getElementById("likeTrack")?.addEventListener("click", () => toast("Лайк сохранён локально в демо-режиме."));
}

function initAuth() {
  document.querySelectorAll("[data-auth]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      if (form.dataset.auth === "register") {
        if (data.get("password") !== data.get("passwordConfirm")) {
          toast("Пароли не совпадают.");
          return;
        }
        state.user.nickname = String(data.get("nickname"));
        state.user.email = String(data.get("email"));
        state.user.uid = `#${Math.floor(1000 + Math.random() * 8999)}`;
      } else {
        state.user.email = String(data.get("email"));
      }
      saveState();
      toast("Профиль сохранён локально.");
      location.href = "/home.html";
    });
  });
}

function initProfile() {
  initMobileBottomNav();
  renderProfile();
  updatePlayerUI();
  document.getElementById("profilePlay")?.addEventListener("click", () => togglePlay());
  document.getElementById("passwordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    toast("Демо: пароль обновлён локально.");
  });
}

function initQueue() {
  initMobileBottomNav();
  renderQueue();
  document.getElementById("clearQueue")?.addEventListener("click", () => {
    state.queue = [];
    state.currentTrackId = null;
    state.playing = false;
    saveState();
    renderQueue();
    updatePlayerUI();
    toast("Очередь очищена.");
  });
}

function initBridge() {
  if (window.ONYX?.requestNativeTheme) ONYX.requestNativeTheme();
}

function initPlayerPage() {
  const params = new URLSearchParams(location.search);
  const requestedTrackId = params.get("track");
  if (requestedTrackId && (state.externalTracks[requestedTrackId] || demoTracks.some((track) => track.id === requestedTrackId))) {
    setCurrentTrack(requestedTrackId);
  } else if (!state.currentTrackId && state.queue.length) {
    setCurrentTrack(state.queue[0]);
  }

  applyPlayerMode("compact");
  renderPlayerPage();

  document.getElementById("playerPlay")?.addEventListener("click", () => togglePlay());
  document.getElementById("playerPrev")?.addEventListener("click", () => stepQueue(-1));
  document.getElementById("playerNext")?.addEventListener("click", () => stepQueue(1));
  document.getElementById("playerTitleLink")?.addEventListener("click", (event) => {
    event.preventDefault();
    applyPlayerMode("lyrics");
    renderPlayerPage();
  });
  document.getElementById("playerCover")?.addEventListener("click", () => {
    applyPlayerMode("art");
    renderPlayerPage();
  });
  document.getElementById("closeLyricsMode")?.addEventListener("click", () => applyPlayerMode("compact"));
  document.getElementById("closeArtMode")?.addEventListener("click", () => applyPlayerMode("compact"));
  document.getElementById("artCover")?.addEventListener("click", () => applyPlayerMode("compact"));
}

function bindAudioEvents() {
  audio.addEventListener("loadedmetadata", () => {
    updatePlayerUI();
  });

  audio.addEventListener("timeupdate", () => {
    currentSeconds = audio.currentTime || 0;
    updatePlayerUI();
  });

  audio.addEventListener("ended", async () => {
    const track = state.currentTrackId ? getTrack(state.currentTrackId) : null;
    if (isSoundCloudTrack(track)) return;
    state.stats.plays += 1;
    state.stats.minutes += Math.ceil((audio.duration || track?.duration || 0) / 60);
    await setTrackHistory(track);
    stepQueue(1);
  });

  audio.addEventListener("pause", () => {
    if (suppressAudioPauseSync) return;
    if (!audio.ended) {
      state.playing = false;
      updatePlayerUI();
      saveState();
    }
  });

  audio.addEventListener("play", () => {
    pauseSoundCloudWidget();
    state.playing = true;
    updatePlayerUI();
    saveState();
  });
}

function init() {
  bindAudioEvents();
  initDeviceProfile();
  if (!supportedSources.has(state.currentSource)) {
    state.currentSource = "apple";
  }
  setTheme(state.settings.theme);
  applyCustomControls();
  initCursor();
  initGlobalClickSound();
  registerServiceWorker();
  initBridge();

  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "settings") initSettings();
  if (page === "profile") initProfile();
  if (page === "queue") initQueue();
  if (page === "player") initPlayerPage();
  if (page === "login" || page === "register") initAuth();

  if (state.currentTrackId) {
    const track = getTrack(state.currentTrackId);
    syncAudio(track);
  }

  updatePlayerUI();
}

document.addEventListener("DOMContentLoaded", init);
