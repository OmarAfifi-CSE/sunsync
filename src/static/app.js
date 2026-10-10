/**
 * SunSync Photobiology Engine - Client Logic
 * Sub-300ms interactive photobiology HUD & Canvas visualizer
 */

(function () {
  'use strict';

  // DOM Elements
  const inputLat = document.getElementById('input-lat');
  const inputLon = document.getElementById('input-lon');
  const btnCalculate = document.getElementById('btn-calculate');
  const btnGeolocate = document.getElementById('btn-geolocate');
  const cityChips = document.querySelectorAll('.city-chips .chip');

  const valWindow = document.getElementById('val-window');
  const valScore = document.getElementById('val-score');
  const valEfficacyTitle = document.getElementById('val-efficacy-title');
  const valUv = document.getElementById('val-uv');
  const badgeUvStatus = document.getElementById('badge-uv-status');
  const uvScaleMarker = document.getElementById('uv-scale-marker');
  const txtUvHint = document.getElementById('txt-uv-hint');
  const valLatency = document.getElementById('val-latency');
  const valModelArch = document.getElementById('val-model-arch');
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

  // Application State
  let currentAudio = null;
  let isAudioPlaying = false;
  let detoxInterval = null;
  let detoxSeconds = 1200; // 20 minutes
  let isDetoxRunning = false;
  let currentTimelineData = [];

  // Gauge circumference for r=42 is ~263.89
  const GAUGE_CIRCUMFERENCE = 263.89;

  // Initialize
  function init() {
    setupCityChips();
    setupGeolocation();
    setupDirectiveCopy();
    setupAudioPlayer();
    setupDetoxModal();
    setupForm();
    setupChartInteraction();

    // Auto-calculate initial state
    evaluateSolarWindow(parseFloat(inputLat.value), parseFloat(inputLon.value));
  }

  // Toast Helper
  function showToast(message, duration = 3000) {
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

  // City Chips Setup
  function setupCityChips() {
    cityChips.forEach(chip => {
      chip.addEventListener('click', () => {
        cityChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        inputLat.value = chip.dataset.lat;
        inputLon.value = chip.dataset.lon;
        evaluateSolarWindow(parseFloat(chip.dataset.lat), parseFloat(chip.dataset.lon));
      });
    });
  }

  // Geolocation Handler
  function setupGeolocation() {
    btnGeolocate.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser');
        return;
      }
      btnGeolocate.innerHTML = '<span>Detecting...</span>';
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(4));
          const lon = parseFloat(position.coords.longitude.toFixed(4));
          inputLat.value = lat;
          inputLon.value = lon;
          cityChips.forEach(c => c.classList.remove('active'));
          btnGeolocate.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2"></polygon></svg><span>Detected!</span>';
          showToast(`Detected location: ${lat}°N, ${lon}°E`);
          setTimeout(() => {
            btnGeolocate.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2"></polygon></svg><span>Detect My Location</span>';
          }, 2500);
          evaluateSolarWindow(lat, lon);
        },
        (error) => {
          btnGeolocate.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2"></polygon></svg><span>Detect My Location</span>';
          showToast('Could not access GPS: ' + error.message);
        },
        { timeout: 8000 }
      );
    });
  }

  // Form Submission
  function setupForm() {
    document.getElementById('solar-form').addEventListener('submit', (e) => {
      e.preventDefault();
      evaluateSolarWindow(parseFloat(inputLat.value), parseFloat(inputLon.value));
    });
  }

  // Main Solar Evaluation Function
  async function evaluateSolarWindow(lat, lon) {
    btnCalculate.classList.add('loading');
    btnCalculate.disabled = true;

    try {
      const resp = await fetch(`/evaluate?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      if (!resp.ok) throw new Error(`HTTP Error: ${resp.status}`);
      const data = await resp.json();

      renderResults(data);
    } catch (err) {
      showToast('Error calculating solar telemetry: ' + err.message);
    } finally {
      btnCalculate.classList.remove('loading');
      btnCalculate.disabled = false;
    }
  }

  // Render Telemetry Results into UI
  function renderResults(data) {
    // 1. Peak Window
    valWindow.textContent = data.optimal_window || '12:00 – 12:20';

    // 2. Circadian Score & Radial Gauge
    const score = Math.round(data.recharge_score || 0);
    valScore.textContent = score;

    // Animate radial gauge
    const offset = GAUGE_CIRCUMFERENCE - (score / 100) * GAUGE_CIRCUMFERENCE;
    gaugeFill.style.strokeDashoffset = offset;

    if (score >= 80) {
      valEfficacyTitle.textContent = 'High Photonic Efficacy';
      valEfficacyTitle.style.color = 'var(--solar-gold)';
    } else if (score >= 50) {
      valEfficacyTitle.textContent = 'Moderate Efficacy';
      valEfficacyTitle.style.color = 'var(--solar-amber)';
    } else {
      valEfficacyTitle.textContent = 'Low Solar Angle';
      valEfficacyTitle.style.color = 'var(--cyan-wavelength)';
    }

    // 3. UV Index
    const uv = parseFloat(data.uv_index || 0).toFixed(1);
    valUv.textContent = uv;
    const uvPct = Math.min(100, (parseFloat(uv) / 10.0) * 100);
    uvScaleMarker.style.width = `${uvPct}%`;

    if (uv < 3.0) {
      badgeUvStatus.textContent = 'SAFE VIEWING';
      badgeUvStatus.className = 'metric-badge uv-safe';
      txtUvHint.textContent = 'Gentle diffuse light; no glare hazard';
    } else if (uv < 6.0) {
      badgeUvStatus.textContent = 'MODERATE UV';
      badgeUvStatus.className = 'metric-badge';
      txtUvHint.textContent = 'Optimal ambient indirect viewing';
    } else {
      badgeUvStatus.textContent = 'ELEVATED UV';
      badgeUvStatus.className = 'metric-badge';
      badgeUvStatus.style.background = 'rgba(239, 68, 68, 0.15)';
      badgeUvStatus.style.color = '#f87171';
      txtUvHint.textContent = 'Avoid direct glare; view diffuse shade';
    }

    // 4. ML Latency
    valLatency.innerHTML = `${Math.round(data.ml_latency_ms || 210)}<span class="metric-sub-unit">ms</span>`;
    valModelArch.textContent = data.model_provider || 'Prior Labs TabPFN Transformer';

    // 5. Directive Quote
    directiveQuote.textContent = `"${data.spoken_directive}"`;

    // 6. Sentry HUD Spans
    const totalMs = data.total_pipeline_ms || 320;
    valTotalLatency.textContent = `${totalMs.toFixed(1)}ms`;

    const ingestMs = data.telemetry_latency_ms || 110;
    const mlMs = data.ml_latency_ms || 210;
    const gemmaMs = Math.max(10, Math.round(totalMs - ingestMs - mlMs));

    spanTimeIngest.textContent = `${Math.round(ingestMs)}ms`;
    spanBarIngest.style.width = `${Math.min(100, (ingestMs / totalMs) * 100)}%`;

    spanTimeMl.textContent = `${Math.round(mlMs)}ms`;
    spanBarMl.style.width = `${Math.min(100, (mlMs / totalMs) * 100)}%`;

    spanTimeGemma.textContent = `${gemmaMs}ms`;
    spanBarGemma.style.width = `${Math.min(100, (gemmaMs / totalMs) * 100)}%`;

    // 7. Footer Stats
    statSolarElevation.textContent = `${(data.solar_elevation_deg || 58.4).toFixed(1)}°`;
    statDiffuseIrr.textContent = `${Math.round(data.diffuse_irradiance_wm2 || 220)} W/m²`;

    // 8. Draw Solar Photobiology Chart
    currentTimelineData = data.hourly_timeline && data.hourly_timeline.length > 0
      ? data.hourly_timeline
      : generateDefaultTimeline();

    drawSolarChart(currentTimelineData);
  }

  // Generate Fallback Timeline if needed
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

  // Draw 24-Hour Solar Photobiology Canvas
  function drawSolarChart(timeline) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    const width = chartCanvas.width;
    const height = chartCanvas.height;

    // Handle High-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = chartCanvas.getBoundingClientRect();
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const padding = { top: 30, right: 30, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const n = timeline.length;
    if (n < 2) return;

    // Coordinate helpers
    const getX = (i) => padding.left + (i / (n - 1)) * chartW;
    const getYScore = (score) => padding.top + chartH - (score / 100) * chartH;
    const getYUV = (uv) => padding.top + chartH - (uv / 10) * chartH;

    // Draw Grid Lines & Hour Labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < n; i++) {
      const x = getX(i);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartH);
      ctx.stroke();

      const hr = timeline[i].hour;
      const label = `${hr}:00`;
      ctx.fillText(label, x, h - 14);
    }

    // Horizontal threshold for UV 6.0
    const uv6Y = getYUV(6.0);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.beginPath();
    ctx.moveTo(padding.left, uv6Y);
    ctx.lineTo(w - padding.right, uv6Y);
    ctx.stroke();
    ctx.restore();

    // 1. Draw Melanopic Score Gradient Area
    ctx.beginPath();
    ctx.moveTo(getX(0), padding.top + chartH);

    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const y = getYScore(timeline[i].circadian_score);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = getX(i - 1);
        const prevY = getYScore(timeline[i - 1].circadian_score);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    ctx.lineTo(getX(n - 1), padding.top + chartH);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    areaGrad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    areaGrad.addColorStop(0.6, 'rgba(251, 146, 60, 0.12)');
    areaGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 2. Draw Melanopic Stroke Line
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const y = getYScore(timeline[i].circadian_score);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = getX(i - 1);
        const prevY = getYScore(timeline[i - 1].circadian_score);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. Draw UV Index Line
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const y = getYUV(timeline[i].uv_index);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = getX(i - 1);
        const prevY = getYUV(timeline[i - 1].uv_index);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Find and highlight peak hour point
    let maxIdx = 0;
    let maxScore = -1;
    for (let i = 0; i < n; i++) {
      if (timeline[i].circadian_score > maxScore) {
        maxScore = timeline[i].circadian_score;
        maxIdx = i;
      }
    }

    const peakX = getX(maxIdx);
    const peakY = getYScore(maxScore);

    // Glowing Peak Indicator
    ctx.beginPath();
    ctx.arc(peakX, peakY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Interactive Tooltip on Canvas
  function setupChartInteraction() {
    if (!chartCanvas) return;

    chartCanvas.addEventListener('mousemove', (e) => {
      if (!currentTimelineData || currentTimelineData.length === 0) return;
      const rect = chartCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const padding = { left: 45, right: 30 };
      const chartW = rect.width - padding.left - padding.right;

      const n = currentTimelineData.length;
      const ratio = Math.max(0, Math.min(1, (mouseX - padding.left) / chartW));
      const idx = Math.round(ratio * (n - 1));

      if (idx >= 0 && idx < n) {
        const item = currentTimelineData[idx];
        chartTooltip.style.display = 'block';
        chartTooltip.style.left = `${e.clientX - rect.left + 15}px`;
        chartTooltip.style.top = `${e.clientY - rect.top - 30}px`;
        chartTooltip.innerHTML = `<strong>${item.hour}:00</strong> · Score: <span style="color:var(--solar-gold)">${item.circadian_score}</span> · UV: <span style="color:var(--cyan-wavelength)">${item.uv_index}</span>`;
      }
    });

    chartCanvas.addEventListener('mouseleave', () => {
      chartTooltip.style.display = 'none';
    });
  }

  // Audio Directive Player Setup
  function setupAudioPlayer() {
    btnPlayAudio.addEventListener('click', async () => {
      if (isAudioPlaying && currentAudio) {
        currentAudio.pause();
        isAudioPlaying = false;
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
        audioWaves.classList.remove('playing');
        audioBtnLabel.textContent = 'Listen (15s Eyes-Free Brief)';
        return;
      }

      const text = directiveQuote.textContent.replace(/^"|"$/g, '').trim();
      audioBtnLabel.textContent = 'Synthesizing voice...';
      btnPlayAudio.disabled = true;

      try {
        const resp = await fetch('/synthesize-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text })
        });

        if (!resp.ok) throw new Error('Speech synthesis failed');

        const blob = await resp.blob();
        const audioUrl = URL.createObjectURL(blob);

        if (currentAudio) {
          currentAudio.pause();
        }

        currentAudio = new Audio(audioUrl);
        currentAudio.play();
        isAudioPlaying = true;
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
        audioWaves.classList.add('playing');
        audioBtnLabel.textContent = 'Playing directive...';

        currentAudio.onended = () => {
          isAudioPlaying = false;
          iconPlay.classList.remove('hidden');
          iconPause.classList.add('hidden');
          audioWaves.classList.remove('playing');
          audioBtnLabel.textContent = 'Replay Eyes-Free Brief';
        };
      } catch (err) {
        showToast('Audio playback error: ' + err.message);
        audioBtnLabel.textContent = 'Listen (15s Eyes-Free Brief)';
      } finally {
        btnPlayAudio.disabled = false;
      }
    });
  }

  // Directive Clipboard Copy
  function setupDirectiveCopy() {
    btnCopyDirective.addEventListener('click', () => {
      const text = directiveQuote.textContent.replace(/^"|"$/g, '').trim();
      navigator.clipboard.writeText(text).then(() => {
        copyText.textContent = 'Copied!';
        showToast('Directive copied to clipboard');
        setTimeout(() => { copyText.textContent = 'Copy'; }, 2000);
      });
    });
  }

  // Detox Screen-Lock Modal Setup
  function setupDetoxModal() {
    btnStartDetox.addEventListener('click', () => {
      detoxModal.classList.add('active');
      detoxModal.setAttribute('aria-hidden', 'false');
      detoxSeconds = 1200; // 20 mins
      updateDetoxTimer();
      startDetoxTimer();
    });

    btnToggleDetox.addEventListener('click', () => {
      if (isDetoxRunning) {
        clearInterval(detoxInterval);
        isDetoxRunning = false;
        btnToggleDetox.textContent = 'Resume Timer';
      } else {
        startDetoxTimer();
        btnToggleDetox.textContent = 'Pause Timer';
      }
    });

    btnExitDetox.addEventListener('click', () => {
      clearInterval(detoxInterval);
      isDetoxRunning = false;
      detoxModal.classList.remove('active');
      detoxModal.setAttribute('aria-hidden', 'true');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && detoxModal.classList.contains('active')) {
        btnExitDetox.click();
      }
    });
  }

  function startDetoxTimer() {
    isDetoxRunning = true;
    detoxInterval = setInterval(() => {
      if (detoxSeconds > 0) {
        detoxSeconds--;
        updateDetoxTimer();
      } else {
        clearInterval(detoxInterval);
        isDetoxRunning = false;
        detoxTimerDisplay.textContent = '00:00';
        showToast('🎉 Circadian recharge cycle complete!');
      }
    }, 1000);
  }

  function updateDetoxTimer() {
    const mins = Math.floor(detoxSeconds / 60);
    const secs = detoxSeconds % 60;
    detoxTimerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Re-draw chart on window resize
  window.addEventListener('resize', () => {
    if (currentTimelineData.length > 0) {
      drawSolarChart(currentTimelineData);
    }
  });

  // Run on DOM load
  document.addEventListener('DOMContentLoaded', init);
})();
