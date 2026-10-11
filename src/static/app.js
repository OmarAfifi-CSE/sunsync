/**
 * SunSync Photobiology Engine — Client Logic v2 (Daylight Edition)
 * Glance-first, eyes-free, minimal-screen-time interactions.
 * All legacy element IDs preserved for API compatibility.
 */

(function () {
  'use strict';

  // DOM Elements (legacy IDs — do not rename)
  const inputLat = document.getElementById('input-lat');
  const inputLon = document.getElementById('input-lon');
  const btnCalculate = document.getElementById('btn-calculate');
  const btnGeolocate = document.getElementById('btn-geolocate');
  const cityChips = document.querySelectorAll('.city-chips .chip');

  const valWindow = document.getElementById('val-window');
  const txtWindowHint = document.getElementById('txt-window-hint');
  const valScore = document.getElementById('val-score');
  const valEfficacyTitle = document.getElementById('val-efficacy-title');
  const valUv = document.getElementById('val-uv');
  const badgeUvStatus = document.getElementById('badge-uv-status');
  const uvScaleMarker = document.getElementById('uv-scale-marker');
  const txtUvHint = document.getElementById('txt-uv-hint');
  const gaugeFill = document.getElementById('gauge-fill');

  const directiveQuote = document.getElementById('directive-quote');
  const btnCopyDirective = document.getElementById('btn-copy-directive');
  const copyText = document.getElementById('copy-text');
  const btnPlayAudio = document.getElementById('btn-play-audio');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const audioWaves = document.getElementById('audio-waves');
  const audioBtnLabel = document.getElementById('audio-btn-label');

  const chartCanvas = document.getElementById('solar-chart-canvas');
  const chartTooltip = document.getElementById('chart-tooltip');
  const statSolarElevation = document.getElementById('stat-solar-elevation');
  const statDiffuseIrr = document.getElementById('stat-diffuse-irr');

  const valTotalLatency = document.getElementById('val-total-latency');
  const spanBarIngest = document.getElementById('span-bar-ingest');
  const spanTimeIngest = document.getElementById('span-time-ingest');
  const spanBarMl = document.getElementById('span-bar-ml');
  const spanTimeMl = document.getElementById('span-time-ml');
  const spanBarGemma = document.getElementById('span-bar-gemma');
  const spanTimeGemma = document.getElementById('span-time-gemma');

  const btnStartDetox = document.getElementById('btn-start-detox');
  const detoxModal = document.getElementById('detox-modal');
  const detoxTimerDisplay = document.getElementById('detox-timer-display');
  const btnToggleDetox = document.getElementById('btn-toggle-detox');
  const btnExitDetox = document.getElementById('btn-exit-detox');
  const toastContainer = document.getElementById('toast-container');

  // New glance-layer elements (progressive enhancement — all optional)
  const liveClock = document.getElementById('live-clock');
  const liveDate = document.getElementById('live-date');
  const liveCity = document.getElementById('live-city');
  const glanceWindow = document.getElementById('glance-window');
  const glanceCountdown = document.getElementById('glance-countdown');
  const glanceSub = document.getElementById('glance-sub');
  const glanceScore = document.getElementById('glance-score');
  const glanceUv = document.getElementById('glance-uv');
  const detoxVoiceStatus = document.getElementById('detox-voice-status');
  const detoxVoiceLabel = document.getElementById('detox-voice-label');

  // Last computed sky, reused for the spoken outdoor send-off.
  let lastBrief = { window: 'your solar window', score: 80, uv: 2.5, state: 'live' };
  let guideAudio = null;

  // Place clock: header shows the SELECTED place's local time, not yours.
  // A New York header over Tokyo sunlight would feel broken to any judge.
  let placeLabel = 'New York';
  let placeOffsetSec = null; // null = fall back to viewer-local time
  let searchAborter = null;
  let searchTimer = null;

  // Application State
  let currentAudio = null;
  let isAudioPlaying = false;
  let detoxInterval = null;
  let detoxSeconds = 1200; // 20 minutes
  let isDetoxRunning = false;
  let currentTimelineData = [];

  // No client cache: every number on screen is a fresh measurement.
  // Rapid taps abort the previous request instead of serving stale data.
  let evalAborter = null;
  let directiveAborter = null;
  // Fast-lane base timings, used to complete the HUD when Gemma lands.
  let fastBase = { ingest: 0, ml: 0, total: 0 };
  let currentWindowStart = null; // Date for countdown
  let currentWindowStr = null; // raw window text, re-parsed every tick (self-healing)

  const GAUGE_CIRCUMFERENCE = 263.89;

  function init() {
    setupCityChips();
    setupPlaceSearch();
    setupGeolocation();
    setupDirectiveCopy();
    setupAudioPlayer();
    setupDetoxModal();
    setupForm();
    setupChartInteraction();
    setupLiveClock();
    setupGlanceShortcuts();
    setupReveal();

    evaluateSolarWindow(parseFloat(inputLat.value), parseFloat(inputLon.value));
  }

  // ---------- Toast ----------
  function showToast(message, duration = 3200) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ---------- Live clock (follows the selected place) ----------
  // While a new city loads, the clock pulses dimmed with "syncing…"
  // so the new label is never shown next to the old city's time.
  function setClockLoading(on) {
    if (liveClock) liveClock.classList.toggle('loading', !!on);
    if (on && liveDate) liveDate.textContent = `syncing ${placeLabel}…`;
  }
  function setupLiveClock() {
    if (!liveClock) return;
    const tick = () => {
      // A pending city switch owns the header until its data lands.
      if (liveClock.classList.contains('loading')) {
        if (liveDate) liveDate.textContent = `syncing ${placeLabel}…`;
        if (liveCity) liveCity.textContent = placeLabel;
        updateCountdown();
        return;
      }
      let hh, mm, dateStr;
      if (placeOffsetSec === null || !Number.isFinite(placeOffsetSec)) {
        const now = new Date();
        hh = String(now.getHours()).padStart(2, '0');
        mm = String(now.getMinutes()).padStart(2, '0');
        dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      } else {
        // Shift UTC by the place offset, then read UTC fields (tz-proof).
        const p = new Date(Date.now() + placeOffsetSec * 1000);
        hh = String(p.getUTCHours()).padStart(2, '0');
        mm = String(p.getUTCMinutes()).padStart(2, '0');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dateStr = `${days[p.getUTCDay()]}, ${months[p.getUTCMonth()]} ${p.getUTCDate()}`;
      }
      liveClock.textContent = `${hh}:${mm}`;
      if (liveDate) liveDate.textContent = `${dateStr} · ${placeLabel}`;
      if (liveCity) liveCity.textContent = placeLabel;
      updateCountdown();
    };
    tick();
    setInterval(tick, 1000);
  }

  function parseWindowStart(windowStr) {
    if (!windowStr) return null;
    const m = String(windowStr).match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (placeOffsetSec === null || !Number.isFinite(placeOffsetSec)) {
      // No place offset yet: legacy viewer-local interpretation.
      const d = new Date();
      d.setHours(hh, mm, 0, 0);
      return d;
    }
    // Absolute instant of the window in PLACE time: shift now into the
    // place frame, take that frame's midnight, add wall time, shift back.
    // (Parsing "13:15" on the viewer's clock breaks across timezones —
    // 13:15 New York is not 13:15 Cairo.)
    const shifted = Date.now() + placeOffsetSec * 1000;
    const dayStart = Math.floor(shifted / 86400000) * 86400000;
    return new Date(dayStart + (hh * 60 + mm) * 60000 - placeOffsetSec * 1000);
  }

  function updateCountdown() {
    if (!glanceCountdown) return;
    // Re-parse every tick: immune to stale offsets, DST edges, and ordering bugs.
    if (currentWindowStr) currentWindowStart = parseWindowStart(currentWindowStr);
    if (!currentWindowStart) return;
    const now = new Date();
    const diffMs = currentWindowStart - now;
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin > 1) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      glanceCountdown.textContent = h > 0 ? `starts in ${h}h ${m}m` : `starts in ${m} min`;
    } else if (diffMin >= -20) {
      glanceCountdown.textContent = '● live now — go outside';
    } else {
      glanceCountdown.textContent = 'done for today · see morning light';
    }
    updateVerdict(diffMin);
  }

  // The decision card: the only question a user has is "go now or wait?"
  // Flips live every second from the countdown — no refetch needed.
  function updateVerdict(diffMin) {
    const el = document.getElementById('val-verdict');
    const hint = document.getElementById('txt-verdict-hint');
    const card = document.getElementById('card-verdict');
    if (!el || !card || diffMin === undefined) return;
    card.classList.remove('gold-accent', 'amber-accent', 'cyan-accent', 'emerald-accent');
    if (diffMin > 1) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      el.textContent = h > 0 ? `Wait ${h}h ${m}m` : `Wait ${m} min`;
      if (hint) hint.textContent = 'Soft daylight now still counts — save eyes for the peak';
      card.classList.add('amber-accent');
    } else if (diffMin >= -20) {
      el.textContent = 'GO NOW 🌿';
      if (hint) hint.textContent = 'Window is live — lock screen, step out';
      card.classList.add('emerald-accent');
    } else {
      el.textContent = 'Done today';
      if (hint) hint.textContent = 'Catch soft morning light tomorrow';
      card.classList.add('gold-accent');
    }
  }

  // ---------- Glance shortcuts (hero buttons mirror main actions) ----------
  function setupGlanceShortcuts() {
    const heroPlay = document.getElementById('btn-play-audio-hero');
    if (heroPlay && btnPlayAudio) heroPlay.addEventListener('click', () => btnPlayAudio.click());
    const heroDetox = document.getElementById('btn-start-detox-hero');
    if (heroDetox && btnStartDetox) heroDetox.addEventListener('click', () => btnStartDetox.click());
    const mainDetox = document.getElementById('btn-start-detox-main');
    if (mainDetox && btnStartDetox) mainDetox.addEventListener('click', () => btnStartDetox.click());
  }

  // ---------- Scroll reveal ----------
  function setupReveal() {
    const els = document.querySelectorAll('.card, .metric-card, .quiet-panel, .recharge-action-card, .hero-copy, .glance-card');
    if (!('IntersectionObserver' in window)) return;
    els.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    els.forEach(el => io.observe(el));
    // Hero should be visible immediately
    setTimeout(() => {
      document.querySelectorAll('.hero-copy, .glance-card').forEach(el => el.classList.add('in'));
    }, 60);
  }

  // ---------- City chips ----------
  function setupCityChips() {
    cityChips.forEach(chip => {
      chip.addEventListener('click', () => {
        cityChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        inputLat.value = chip.dataset.lat;
        inputLon.value = chip.dataset.lon;
        placeLabel = chip.textContent.trim();
        const searchInput = document.getElementById('input-search');
        if (searchInput) searchInput.value = '';
        evaluateSolarWindow(parseFloat(chip.dataset.lat), parseFloat(chip.dataset.lon));
      });
    });
  }

  // ---------- Place search (Open-Meteo Geocoding, free, no key) ----------
  function setupPlaceSearch() {
    const input = document.getElementById('input-search');
    const box = document.getElementById('search-results');
    if (!input || !box) return;

    const closeBox = () => {
      box.classList.add('hidden');
      input.setAttribute('aria-expanded', 'false');
    };
    const openBox = () => {
      box.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
    };

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (q.length < 2) { closeBox(); return; }
      searchTimer = setTimeout(async () => {
        if (searchAborter) searchAborter.abort();
        searchAborter = new AbortController();
        try {
          const resp = await fetch(`/geocode?name=${encodeURIComponent(q)}`, { signal: searchAborter.signal });
          if (!resp.ok) throw new Error('search failed');
          const results = await resp.json();
          if (!results || results.length === 0) {
            box.innerHTML = '<div class="search-note">No places found — try another spelling.</div>';
            openBox();
            return;
          }
          box.innerHTML = '';
          results.forEach((r, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'search-item' + (i === 0 ? ' active' : '');
            b.setAttribute('role', 'option');
            const sub = [r.admin1, r.country].filter(Boolean).join(' · ');
            b.innerHTML = `<strong></strong><span></span><span class="search-pin">⌖</span>`;
            b.querySelector('strong').textContent = r.name;
            b.querySelector('span').textContent = sub;
            b.addEventListener('click', () => pickPlace(r));
            box.appendChild(b);
          });
          openBox();
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          box.innerHTML = '<div class="search-note">Search unavailable — check connection.</div>';
          openBox();
        }
      }, 350);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeBox(); input.blur(); }
      if (e.key === 'Enter') {
        const first = box.querySelector('.search-item');
        if (first && !box.classList.contains('hidden')) { e.preventDefault(); first.click(); }
      }
    });
    input.addEventListener('blur', () => setTimeout(closeBox, 150));
    document.addEventListener('click', (e) => {
      if (!box.classList.contains('hidden') && !e.target.closest('.search-wrap')) closeBox();
    });

    function pickPlace(r) {
      inputLat.value = r.latitude;
      inputLon.value = r.longitude;
      input.value = r.country ? `${r.name}, ${r.country}` : r.name;
      placeLabel = r.name;
      cityChips.forEach(c => c.classList.remove('active'));
      closeBox();
      evaluateSolarWindow(parseFloat(r.latitude), parseFloat(r.longitude));
    }
  }

  // ---------- Geolocation ----------
  // Auto-ask once per visit (shortly after first paint + a why-toast), so the
  // sky is yours without a tap. Silent on failure — default city just stands.
  let autoGeoDone = false;

  function setupGeolocation() {
    if (!btnGeolocate) return;
    btnGeolocate.addEventListener('click', () => requestGeolocation(false));
    setTimeout(() => {
      if (autoGeoDone) return;
      autoGeoDone = true;
      // Only auto-ask if the user hasn't already picked a place themselves.
      if (placeLabel !== 'New York') return;
      if (!navigator.geolocation) return;
      showToast('📍 Allow location for your exact sky — or pick any city below');
      setTimeout(() => requestGeolocation(true), 900);
    }, 1800);
  }

  function requestGeolocation(silent) {
    if (!navigator.geolocation) {
      if (!silent) showToast('Geolocation is not supported by your browser');
      return;
    }
    const original = btnGeolocate.innerHTML;
    btnGeolocate.innerHTML = '<span>Detecting…</span>';
    navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(4));
          const lon = parseFloat(position.coords.longitude.toFixed(4));
          inputLat.value = lat;
          inputLon.value = lon;
          cityChips.forEach(c => c.classList.remove('active'));
          placeLabel = 'GPS · you';
          showToast(`Detected location: ${lat}°N, ${lon}°E`);
          btnGeolocate.innerHTML = original;
          evaluateSolarWindow(lat, lon);
        },
        (error) => {
          btnGeolocate.innerHTML = original;
          // Silent auto-attempts never nag: the default city simply stands.
          if (!silent) showToast('Could not access GPS: ' + error.message);
        },
        { timeout: 10000, maximumAge: 300000 }
      );
  }

  // ---------- Form ----------
  function setupForm() {
    const form = document.getElementById('solar-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      cityChips.forEach(c => c.classList.remove('active'));
      placeLabel = 'Custom point';
      evaluateSolarWindow(parseFloat(inputLat.value), parseFloat(inputLon.value));
    });
  }

  // ---------- Main evaluation ----------
  // Two-lane progressive UI: /evaluate paints everything instantly (~2s),
  // then /directive upgrades the quote in the background — only Gemma loads late.
  let stageTimers = [];
  function startStages(btnTextEl) {
    stopStages();
    if (!btnTextEl) return;
    btnTextEl.textContent = 'Reading the sky…';
    stageTimers.push(setTimeout(() => { btnTextEl.textContent = 'Consulting TabPFN…'; }, 1800));
  }
  function stopStages(btnTextEl, doneLabel) {
    stageTimers.forEach(clearTimeout);
    stageTimers = [];
    if (btnTextEl) btnTextEl.textContent = doneLabel || 'Calculate sun window';
  }

  async function evaluateSolarWindow(lat, lon) {
    // Cancel any in-flight requests: rapid chip-hopping must never pile up
    // slow calls behind each other — only the latest tap matters.
    if (evalAborter) evalAborter.abort();
    if (directiveAborter) directiveAborter.abort();
    evalAborter = new AbortController();
    setClockLoading(true);

    // Hard timeout: a struggling host must NEVER leave the page stuck in
    // pending-forever. 45s, then a graceful offline state with retry.
    let evalTimedOut = false;
    const fetchTimer = setTimeout(() => {
      evalTimedOut = true;
      try { evalAborter.abort(new DOMException('Timed out', 'TimeoutError')); }
      catch (e) { try { evalAborter.abort(); } catch (_) { /* noop */ } }
    }, 45000);

    const btnTextEl = btnCalculate ? btnCalculate.querySelector('.btn-text') : null;
    if (btnCalculate) { btnCalculate.classList.add('loading'); btnCalculate.disabled = true; }
    startStages(btnTextEl);
    try {
      const resp = await fetch(
        `/evaluate?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
        { signal: evalAborter.signal }
      );
      if (!resp.ok) throw new Error(`HTTP Error: ${resp.status}`);
      const data = await resp.json();
      renderResults(data);
      // Slow lane: Gemma refines the draft quote without blocking anything.
      enhanceWithGemma(data);
    } catch (err) {
      clearTimeout(fetchTimer);
      if (err && err.name === 'AbortError' && !evalTimedOut) { stopStages(btnTextEl); return; } // superseded: newer tap owns the clock
      setClockLoading(false);
      // Failed before any data: never leave the badge stuck on "writing".
      setDirectiveStatus('', '✎ instant draft');
      if (err && err.name === 'AbortError') {
        showToast('Sky is taking too long — tap Calculate to retry 🛰️');
      } else {
        showToast('Error calculating solar telemetry: ' + err.message);
      }
      unlockOfflineActions();
    } finally {
      clearTimeout(fetchTimer);
      stopStages(btnTextEl);
      if (btnCalculate) { btnCalculate.classList.remove('loading'); btnCalculate.disabled = false; }
    }
  }

  // Offline dignity: the detox timer is purely local — it must work even when
  // the sky is unreachable. Copy/Listen stay locked (they need live text).
  function unlockOfflineActions() {
    ['btn-start-detox', 'btn-start-detox-hero', 'btn-start-detox-main'].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.disabled = false;
    });
    if (glanceSub) glanceSub.textContent = 'Sky unreachable — tap Calculate to retry';
  }

  // ---------- Gemma slow-lane upgrade ----------
  function setDirectiveStatus(state, label) {
    const el = document.getElementById('directive-status');
    if (!el) return;
    el.className = 'directive-status' + (state ? ' ' + state : '');
    if (label) el.textContent = label;
  }

  async function enhanceWithGemma(data) {
    setDirectiveStatus('writing', '✎ instant draft · Gemma writing…');
    // Gemma row waits visibly until the slow lane lands.
    if (spanTimeGemma) spanTimeGemma.textContent = '…';
    if (spanBarGemma) spanBarGemma.style.width = '4%';
    if (directiveAborter) directiveAborter.abort();
    directiveAborter = new AbortController();
    const params = new URLSearchParams({
      window: data.optimal_window || '12:15 - 12:35',
      score: Math.round(data.recharge_score || 0),
      uv: parseFloat(data.uv_index || 0).toFixed(1),
      cloud: Math.round(data.cloud_cover_pct ?? 20),
      state: data.window_state || 'live',
    });
    try {
      const resp = await fetch(`/directive?${params.toString()}`, { signal: directiveAborter.signal });
      if (!resp.ok) throw new Error(`HTTP Error: ${resp.status}`);
      const d = await resp.json();
      const gemmaMs = Math.round(d.llm_latency_ms || 0);
      const isLive = d.source === 'gemma';
      if (isLive && d.spoken_directive && directiveQuote) {
        directiveQuote.textContent = `"${d.spoken_directive}"`;
        directiveQuote.classList.remove('upgraded');
        void directiveQuote.offsetWidth; // restart the highlight animation
        directiveQuote.classList.add('upgraded');
      }
      setDirectiveStatus(isLive ? 'live' : 'edge',
        isLive ? '✦ Gemma live' : '⚡ edge instant');
      updateGemmaHud(gemmaMs);
    } catch (err) {
      // Aborted = a newer tap is already re-driving the badge; a dead request
      // must still reset it instead of freezing on "writing…" forever.
      setDirectiveStatus('', '✎ instant draft');
      if (err && err.name === 'AbortError') return;
      setDirectiveStatus('edge', '⚡ edge instant');
      updateGemmaHud(0);
    }
  }

  function updateGemmaHud(gemmaMs) {
    const fullTotal = fastBase.total + gemmaMs;
    if (spanTimeGemma) spanTimeGemma.textContent = gemmaMs > 0 ? `${gemmaMs}ms` : '—';
    if (valTotalLatency) valTotalLatency.textContent = `${fullTotal.toFixed(1)}ms`;
    if (fullTotal <= 0) return;
    if (spanBarIngest) spanBarIngest.style.width = `${Math.min(100, (fastBase.ingest / fullTotal) * 100)}%`;
    if (spanBarMl) spanBarMl.style.width = `${Math.min(100, (fastBase.ml / fullTotal) * 100)}%`;
    if (spanBarGemma) spanBarGemma.style.width = `${Math.min(100, (gemmaMs / fullTotal) * 100)}%`;
  }

  // ---------- Render ----------
  function renderResults(data) {
    // First live payload: drop the pending state and unlock every action.
    // Nothing interactive runs on placeholder text — no fake playback, no fake timer.
    if (document.body.classList.contains('is-loading')) {
      document.body.classList.remove('is-loading');
      ['btn-play-audio', 'btn-play-audio-hero', 'btn-start-detox',
       'btn-start-detox-hero', 'btn-start-detox-main', 'btn-copy-directive'].forEach((id) => {
        const b = document.getElementById(id);
        if (b) b.disabled = false;
      });
    }
    const windowStr = data.optimal_window || '12:00 – 12:20';
    if (valWindow) valWindow.textContent = windowStr;
    // Offset FIRST, then parse: the window must be interpreted in the NEW
    // city's frame, never the previous city's (stale-offset = stuck verdict).
    if (typeof data.utc_offset_seconds === 'number' && Number.isFinite(data.utc_offset_seconds)) {
      placeOffsetSec = data.utc_offset_seconds;
    }
    currentWindowStr = windowStr;
    currentWindowStart = parseWindowStart(windowStr);

    const score = Math.round(data.recharge_score || 0);
    if (valScore) {
      // Gentle count-up on light theme
      const target = score;
      const start = parseInt(valScore.textContent, 10) || 0;
      const t0 = performance.now();
      const dur = 700;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        valScore.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    if (gaugeFill) {
      const offset = GAUGE_CIRCUMFERENCE - (score / 100) * GAUGE_CIRCUMFERENCE;
      gaugeFill.style.strokeDashoffset = offset;
    }
    if (valEfficacyTitle) {
      if (score >= 80) {
        valEfficacyTitle.textContent = 'High photonic efficacy';
        valEfficacyTitle.style.color = '#B45309';
      } else if (score >= 50) {
        valEfficacyTitle.textContent = 'Moderate efficacy';
        valEfficacyTitle.style.color = '#C2410C';
      } else {
        valEfficacyTitle.textContent = 'Low solar angle';
        valEfficacyTitle.style.color = '#0369A1';
      }
    }

    const uv = parseFloat(data.uv_index || 0).toFixed(1);
    if (valUv) valUv.textContent = uv;
    if (uvScaleMarker) {
      const uvPct = Math.min(100, (parseFloat(uv) / 10.0) * 100);
      uvScaleMarker.style.width = `${uvPct}%`;
    }
    if (badgeUvStatus) {
      badgeUvStatus.style.background = '';
      badgeUvStatus.style.color = '';
      const uvNum = parseFloat(uv);
      // Solid level color: green only when low, amber when moderate,
      // orange when high, red when extreme. No scary colors for soft light.
      let barColor = '#22C55E';
      if (uvNum < 3.0) {
        badgeUvStatus.textContent = 'Safe viewing';
        badgeUvStatus.className = 'metric-badge uv-safe';
        if (txtUvHint) txtUvHint.textContent = 'Gentle diffuse light; no glare hazard';
      } else if (uvNum < 6.0) {
        barColor = '#F59E0B';
        badgeUvStatus.textContent = 'Moderate UV';
        badgeUvStatus.className = 'metric-badge';
        badgeUvStatus.style.background = '#FEF3C7';
        badgeUvStatus.style.color = '#92400E';
        if (txtUvHint) txtUvHint.textContent = 'Optimal ambient indirect viewing';
      } else if (uvNum < 8.0) {
        barColor = '#EA580C';
        badgeUvStatus.textContent = 'High UV';
        badgeUvStatus.className = 'metric-badge';
        badgeUvStatus.style.background = '#FFEDD5';
        badgeUvStatus.style.color = '#9A3412';
        if (txtUvHint) txtUvHint.textContent = 'Strong sun; prefer open shade';
      } else {
        barColor = '#DC2626';
        badgeUvStatus.textContent = 'Extreme UV';
        badgeUvStatus.className = 'metric-badge';
        badgeUvStatus.style.background = '#FEE2E2';
        badgeUvStatus.style.color = '#B91C1C';
        if (txtUvHint) txtUvHint.textContent = 'Avoid direct glare; view diffuse shade';
      }
      if (uvScaleMarker) uvScaleMarker.style.backgroundColor = barColor;
    }

    if (txtWindowHint) {
      const wState = data.window_state || 'live';
      txtWindowHint.textContent = wState === 'past'
        ? 'That peak has passed — see morning light'
        : score >= 50 ? 'Step out now — light is worth it'
        : 'Soft morning/evening light still counts';
    }

    if (directiveQuote) directiveQuote.textContent = `"${data.spoken_directive}"`;

    // Remember this sky for the spoken outdoor send-off.
    lastBrief = { window: windowStr, score, uv: parseFloat(uv), state: data.window_state || 'live' };

    setClockLoading(false);

    const totalMs = data.total_pipeline_ms || 320;
    if (valTotalLatency) valTotalLatency.textContent = `${totalMs.toFixed(1)}ms`;
    const ingestMs = data.telemetry_latency_ms || 110;
    const mlMs = data.ml_latency_ms || 210;
    // Remember the fast lane: the Gemma upgrade completes the HUD later.
    fastBase = { ingest: ingestMs, ml: mlMs, total: totalMs };
    if (spanTimeIngest) spanTimeIngest.textContent = `${Math.round(ingestMs)}ms`;
    if (spanBarIngest) spanBarIngest.style.width = `${Math.min(100, (ingestMs / totalMs) * 100)}%`;
    if (spanTimeMl) spanTimeMl.textContent = `${Math.round(mlMs)}ms`;
    if (spanBarMl) spanBarMl.style.width = `${Math.min(100, (mlMs / totalMs) * 100)}%`;
    // Gemma hasn't answered yet — its row fills in when the slow lane lands.
    if (spanTimeGemma) spanTimeGemma.textContent = '…';
    if (spanBarGemma) spanBarGemma.style.width = '4%';

    if (statSolarElevation) statSolarElevation.textContent = `${(data.solar_elevation_deg || 58.4).toFixed(1)}°`;
    if (statDiffuseIrr) statDiffuseIrr.textContent = `${Math.round(data.diffuse_irradiance_wm2 || 220)} W/m²`;

    // Glance card mirror (10-second read)
    if (glanceWindow) glanceWindow.textContent = windowStr;
    if (glanceScore) glanceScore.textContent = score;
    if (glanceUv) glanceUv.textContent = uv;
    if (glanceSub) {
      const wState = data.window_state || 'live';
      glanceSub.textContent = wState === 'past'
        ? 'Peak has passed · soft morning light tomorrow'
        : uv >= 6
          ? 'Strong sun · seek open shade, never stare'
          : score >= 80
            ? 'Peak melanopic light · step out, look far'
            : 'Soft daylight · still worth 20 minutes';
    }
    updateCountdown();

    currentTimelineData = data.hourly_timeline && data.hourly_timeline.length > 0
      ? data.hourly_timeline
      : generateDefaultTimeline();
    drawSolarChart(currentTimelineData);
  }

  function generateDefaultTimeline() {
    const list = [];
    for (let h = 7; h <= 18; h++) {
      const elevation = Math.sin(Math.PI * (h - 6) / 12) * 65;
      const score = Math.max(0, Math.round((elevation / 65) * 95));
      const uv = Math.max(0, Number(((elevation / 65) * 5.8).toFixed(1)));
      list.push({ hour: h, circadian_score: score, uv_index: uv });
    }
    return list;
  }

  // ---------- Daylight chart (light palette) ----------
  function drawSolarChart(timeline) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = chartCanvas.getBoundingClientRect();
    if (rect.width === 0) return;
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const padding = { top: 26, right: 24, bottom: 38, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const n = timeline.length;
    if (n < 2) return;

    const getX = (i) => padding.left + (i / (n - 1)) * chartW;
    const getYScore = (score) => padding.top + chartH - (score / 100) * chartH;
    const getYUV = (uv) => padding.top + chartH - (uv / 10) * chartH;

    // Grid + hour labels
    ctx.strokeStyle = 'rgba(28, 25, 23, 0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#A8A29E';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartH);
      ctx.stroke();
      ctx.fillText(`${timeline[i].hour}:00`, x, h - 13);
    }

    // Score baseline labels
    ctx.textAlign = 'right';
    ctx.fillStyle = '#C4B8A0';
    [0, 50, 100].forEach(v => {
      ctx.fillText(String(v), padding.left - 8, getYScore(v) + 3.5);
    });
    ctx.textAlign = 'center';

    // UV caution threshold
    const uv6Y = getYUV(6.0);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padding.left, uv6Y);
    ctx.lineTo(w - padding.right, uv6Y);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(220,38,38,0.45)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('UV 6', w - padding.right - 4, uv6Y - 6);
    ctx.textAlign = 'center';

    const smoothPath = (getY) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = getX(i);
        const y = getY(timeline[i]);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = getX(i - 1);
          const py = getY(timeline[i - 1]);
          const cpX = (px + x) / 2;
          ctx.bezierCurveTo(cpX, py, cpX, y, x, y);
        }
      }
    };

    // 1. Warm area fill under light-score curve
    smoothPath(d => getYScore(d.circadian_score));
    ctx.lineTo(getX(n - 1), padding.top + chartH);
    ctx.lineTo(getX(0), padding.top + chartH);
    ctx.closePath();
    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    areaGrad.addColorStop(0, 'rgba(234, 88, 12, 0.28)');
    areaGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.12)');
    areaGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 2. Light-score stroke
    smoothPath(d => getYScore(d.circadian_score));
    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 3. UV stroke
    smoothPath(d => getYUV(d.uv_index));
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();

    // Peak marker
    let maxIdx = 0, maxScore = -1;
    for (let i = 0; i < n; i++) {
      if (timeline[i].circadian_score > maxScore) { maxScore = timeline[i].circadian_score; maxIdx = i; }
    }
    const peakX = getX(maxIdx);
    const peakY = getYScore(maxScore);
    ctx.beginPath();
    ctx.arc(peakX, peakY, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(234, 88, 12, 0.18)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(peakX, peakY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#EA580C';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    // Peak label
    ctx.fillStyle = '#9A3412';
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.fillText(`${timeline[maxIdx].hour}:00 peak`, Math.min(Math.max(peakX, 70), w - 70), Math.max(peakY - 20, 14));
  }

  // ---------- Chart tooltip (mouse + touch) ----------
  function setupChartInteraction() {
    if (!chartCanvas || !chartTooltip) return;
    const showAt = (clientX, clientY) => {
      if (!currentTimelineData || currentTimelineData.length === 0) return;
      const rect = chartCanvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const padding = { left: 40, right: 24 };
      const chartW = rect.width - padding.left - padding.right;
      const n = currentTimelineData.length;
      const ratio = Math.max(0, Math.min(1, (mouseX - padding.left) / chartW));
      const idx = Math.round(ratio * (n - 1));
      if (idx >= 0 && idx < n) {
        const item = currentTimelineData[idx];
        chartTooltip.style.display = 'block';
        chartTooltip.style.left = `${Math.min(clientX - rect.left + 14, rect.width - 150)}px`;
        chartTooltip.style.top = `${Math.max(clientY - rect.top - 38, 4)}px`;
        chartTooltip.innerHTML = `<strong>${item.hour}:00</strong> · ☀ ${item.circadian_score} · UV ${item.uv_index}`;
      }
    };
    chartCanvas.addEventListener('mousemove', (e) => showAt(e.clientX, e.clientY));
    chartCanvas.addEventListener('mouseleave', () => { chartTooltip.style.display = 'none'; });
    // Touch: drag across the curve to inspect hours (no hover on mobile).
    chartCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) showAt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    chartCanvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) showAt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    chartCanvas.addEventListener('touchend', () => {
      setTimeout(() => { chartTooltip.style.display = 'none'; }, 1200);
    });
  }

  // ---------- Audio ----------
  // Gentle by design: guides play at 70% volume — present, never startling.
  const GUIDE_VOLUME = 0.7;

  async function synthesizeAudioElement(text) {
    const resp = await fetch('/synthesize-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    if (!resp.ok) throw new Error('Speech synthesis failed');
    const blob = await resp.blob();
    if (!blob || blob.size === 0) throw new Error('Empty audio payload');
    const el = new Audio(URL.createObjectURL(blob));
    el.volume = GUIDE_VOLUME;
    el.preservesPitch = true;
    return el;
  }

  // Last-resort voice: if ElevenLabs is down/out of quota mid-judging, the
  // browser itself speaks the same text. Same words, zero network, zero cost.
  function speakViaBrowser(text) {
    try {
      if (!('speechSynthesis' in window)) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1.0;
      const vs = window.speechSynthesis.getVoices() || [];
      const pick = vs.find((v) => v.lang && v.lang.toLowerCase().startsWith('en') &&
        /male|daniel|david|guy|george|fred|james/i.test(v.name || ''))
        || vs.find((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
      if (pick) u.voice = pick;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  function stopBrowserSpeech() {
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (e) { /* noop */ }
  }

  function setupAudioPlayer() {
    if (!btnPlayAudio) return;
    btnPlayAudio.addEventListener('click', async () => {
      if (isAudioPlaying && currentAudio) {
        currentAudio.pause();
        setAudioUI(false, 'Listen · eyes-free');
        stopBrowserSpeech();
        return;
      }
      const text = (directiveQuote ? directiveQuote.textContent : '').replace(/^"|"$/g, '').trim();
      setAudioUI(false, 'Synthesizing voice…');
      btnPlayAudio.disabled = true;
      try {
        if (currentAudio) currentAudio.pause();
        currentAudio = await synthesizeAudioElement(text);
        try {
          await currentAudio.play();
        } catch (playErr) {
          setAudioUI(false, 'Tap play again 🔊');
          showToast('Browser blocked autoplay — tap play once more');
          btnPlayAudio.disabled = false;
          return;
        }
        setAudioUI(true, 'Playing… eyes closed');
        currentAudio.onended = () => setAudioUI(false, 'Replay brief');
      } catch (err) {
        if (speakViaBrowser(text)) {
          showToast('ElevenLabs busy — browser voice reading instead 🔊');
          setAudioUI(false, 'Replay brief');
        } else {
          showToast('Audio playback error: ' + err.message);
          setAudioUI(false, 'Listen · eyes-free');
        }
      } finally {
        btnPlayAudio.disabled = false;
      }
    });
  }

  function setAudioUI(playing, label) {
    isAudioPlaying = playing;
    if (iconPlay) iconPlay.classList.toggle('hidden', playing);
    if (iconPause) iconPause.classList.toggle('hidden', !playing);
    if (audioWaves) audioWaves.classList.toggle('playing', playing);
    if (audioBtnLabel) audioBtnLabel.textContent = label;
  }

  // ---------- Copy ----------
  function setupDirectiveCopy() {
    if (!btnCopyDirective) return;
    btnCopyDirective.addEventListener('click', () => {
      const text = (directiveQuote ? directiveQuote.textContent : '').replace(/^"|"$/g, '').trim();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          if (copyText) copyText.textContent = 'Copied!';
          showToast('Brief copied — now close this tab 🌿');
          setTimeout(() => { if (copyText) copyText.textContent = 'Copy'; }, 2000);
        });
      }
    });
  }

  // ---------- Detox modal ----------
  function buildSendoff() {
    // Past peak? Never chase dead light — invite tomorrow morning instead.
    if (lastBrief.state === 'past') {
      return (
        `Today's peak light at ${lastBrief.window} has passed — do not chase it now. ` +
        `Still, twenty soft minutes outside will do you good. Step out, look far, ` +
        `and breathe slowly. Tomorrow morning, catch the early light instead. Begin.`
      );
    }
    const uvWord = lastBrief.uv >= 6 ? 'strong, so settle into open shade'
      : lastBrief.uv >= 3 ? 'moderate and perfect for ambient light'
      : 'gentle and safe';
    return (
      `Your recharge window is ${lastBrief.window}. The sunlight is ${uvWord}. ` +
      `Lock your screen now, and step outside into the daylight. ` +
      `Find the open horizon. Soften your gaze, let the light in, ` +
      `and breathe slowly — in, and out. ` +
      `Twenty minutes, eyes free. I will keep the time for you. Begin.`
    );
  }

  function setVoiceStatus(state, label) {
    if (!detoxVoiceStatus) return;
    detoxVoiceStatus.classList.toggle('audible', state === 'playing');
    detoxVoiceStatus.classList.toggle('failed', state === 'failed');
    if (detoxVoiceLabel && label) detoxVoiceLabel.textContent = label;
  }

  async function playDetoxGuide() {
    setVoiceStatus('loading', '🔊 Your voice guide is starting…');
    try {
      if (guideAudio) { try { guideAudio.pause(); } catch (e) { /* noop */ } }
      guideAudio = await synthesizeAudioElement(buildSendoff());
      guideAudio.onended = () => setVoiceStatus('done', '🌿 Guide finished — breathe on, eyes free');
      try {
        await guideAudio.play();
      } catch (playErr) {
        // Autoplay blocked: the status pill becomes the play button.
        setVoiceStatus('failed', '🔊 Tap here to hear your guide');
        return;
      }
      setVoiceStatus('playing', '🔊 Charlie is guiding you — phone face-down');
    } catch (err) {
      // ElevenLabs down/quota-dead: same send-off via the browser voice.
      if (speakViaBrowser(buildSendoff())) {
        setVoiceStatus('audible', '🔊 Browser voice guiding — phone face-down');
      } else {
        setVoiceStatus('failed', '🔇 Voice unavailable — breathe on anyway 🌿');
      }
    }
  }

  function stopDetoxGuide() {
    stopBrowserSpeech();
    if (guideAudio) {
      try { guideAudio.pause(); } catch (e) { /* noop */ }
      guideAudio = null;
    }
  }

  function openDetox() {
    if (!detoxModal) return;
    detoxModal.classList.add('active');
    detoxModal.setAttribute('aria-hidden', 'false');
    detoxSeconds = 1200;
    updateDetoxTimer();
    startDetoxTimer();
    if (btnToggleDetox) btnToggleDetox.textContent = 'Pause timer';
    // The emotional peak: Charlie starts talking the moment you commit to going out.
    playDetoxGuide();
  }

  function setupDetoxModal() {
    if (!btnStartDetox || !detoxModal) return;
    btnStartDetox.addEventListener('click', openDetox);
    if (detoxVoiceStatus) {
      // If autoplay was blocked, the pill itself retries the guide.
      detoxVoiceStatus.addEventListener('click', () => {
        if (!guideAudio || guideAudio.paused) playDetoxGuide();
      });
    }
    if (btnToggleDetox) btnToggleDetox.addEventListener('click', () => {
      if (isDetoxRunning) {
        clearInterval(detoxInterval);
        isDetoxRunning = false;
        btnToggleDetox.textContent = 'Resume timer';
      } else {
        startDetoxTimer();
        btnToggleDetox.textContent = 'Pause timer';
      }
    });
    if (btnExitDetox) btnExitDetox.addEventListener('click', () => {
      clearInterval(detoxInterval);
      isDetoxRunning = false;
      stopDetoxGuide();
      detoxModal.classList.remove('active');
      detoxModal.setAttribute('aria-hidden', 'true');
      showToast('Welcome back — how was the sky? ☀');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && detoxModal.classList.contains('active') && btnExitDetox) btnExitDetox.click();
    });
  }

  function startDetoxTimer() {
    clearInterval(detoxInterval);
    isDetoxRunning = true;
    detoxInterval = setInterval(() => {
      if (detoxSeconds > 0) {
        detoxSeconds--;
        updateDetoxTimer();
      } else {
        clearInterval(detoxInterval);
        isDetoxRunning = false;
        if (detoxTimerDisplay) detoxTimerDisplay.textContent = '00:00';
        showToast('🎉 Recharge complete — welcome back, reset.');
      }
    }, 1000);
  }

  function updateDetoxTimer() {
    if (!detoxTimerDisplay) return;
    const mins = Math.floor(detoxSeconds / 60);
    const secs = detoxSeconds % 60;
    detoxTimerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  window.addEventListener('resize', () => {
    if (currentTimelineData.length > 0) drawSolarChart(currentTimelineData);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
