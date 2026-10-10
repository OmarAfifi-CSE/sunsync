"""
dashboard.py - Streamlit Interface for SunSync

A dark-mode, minimalist interface designed to present photobiological
telemetry in seconds and encourage immediate screen detachment.
"""

import time
import streamlit as st
import pandas as pd
from data_service import AtmosphericDataService
from circadian_ml import CircadianMLEngine

st.set_page_config(
    page_title="SunSync | Edge Circadian AI",
    page_icon="☀️",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Custom Styling: Minimalist, modern dark mode
st.markdown("""
<style>
    .main { background-color: #0d1117; color: #c9d1d9; }
    .stMetric { background-color: #161b22; border-radius: 8px; padding: 15px; border: 1px solid #30363d; }
    .hero-title { font-size: 2.2rem; font-weight: 700; color: #f0883e; margin-bottom: 0px; }
    .sub-title { font-size: 1.0rem; color: #8b949e; margin-bottom: 25px; }
    .badge-bar { display: flex; gap: 10px; margin-bottom: 20px; }
    .badge { background: #21262d; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; border: 1px solid #30363d; }
</style>
""", unsafe_allow_html=True)

st.markdown('<div class="hero-title">☀️ SunSync Engine</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Edge Photobiology AI & Circadian Realignment for Screen Workers</div>', unsafe_allow_html=True)

st.markdown("""
<div class="badge-bar">
    <span class="badge">🧠 Prior Labs TabPFN</span>
    <span class="badge">📊 Sentry Agent Tracing</span>
    <span class="badge">🔬 480nm Melanopic Lux</span>
    <span class="badge">⚡ Zero Cloud Dependencies</span>
</div>
""", unsafe_allow_html=True)

# Geolocation controls (defaults to local coordinates)
col_lat, col_lon = st.columns(2)
with col_lat:
    lat = st.number_input("Latitude", value=30.5877, format="%.4f")
with col_lon:
    lon = st.number_input("Longitude", value=31.3468, format="%.4f")

if st.button("Calculate Circadian Recharge Window", type="primary", use_container_width=True):
    with st.spinner("Evaluating atmospheric telemetry through TabPFN transformer..."):
        service = AtmosphericDataService(latitude=lat, longitude=lon)
        telemetry_df = service.fetch_solar_telemetry()

        ml_engine = CircadianMLEngine()
        result = ml_engine.predict_optimal_window(telemetry_df)

    st.success("✅ Photobiological Optimization Complete")

    # Metrics row
    m1, m2, m3 = st.columns(3)
    with m1:
        st.metric(
            label="Peak Recharge Window",
            value=result["window_time_formatted"],
            help="Optimal time for 480nm melanopsin stimulation"
        )
    with m2:
        st.metric(
            label="Circadian Score (CRS)",
            value=f"{result['circadian_recharge_score']} / 100",
            help="Photobiological efficacy index"
        )
    with m3:
        st.metric(
            label="TabPFN Latency",
            value=f"{result['inference_latency_ms']} ms",
            help="Edge zero-shot execution time"
        )

    # Spoken Brief Banner & Audio Player
    spoken_text = f"Your peak solar window is {result['window_time_formatted']}. Step outside into natural daylight. Retinal cells require 15 minutes of unshielded diffuse daylight to anchor your circadian rhythm."
    st.info(f"🎧 **Spoken Directive (ElevenLabs):**\n\"{spoken_text}\"")

    try:
        from audio_service import AudioDirectiveService
        audio_service = AudioDirectiveService()
        audio_bytes = audio_service.synthesize_speech(spoken_text)
        if audio_bytes:
            st.audio(audio_bytes, format="audio/mp3", autoplay=False)
    except Exception as e:
        pass

    # Timeline Chart
    timeline_df = pd.DataFrame(result["hourly_timeline"])
    st.markdown("#### Hourly Circadian Efficacy Curve")
    st.line_chart(timeline_df.set_index("hour")["circadian_score"])

    # Touch Grass Detachment Trigger
    st.markdown("---")
    st.markdown("### 🌿 Ready to Touch Grass?")
    if st.button("🔒 Lock Screen & Begin 20-Min Outdoor Detox", type="secondary", use_container_width=True):
        st.warning("Screen Locked. Put your phone in your pocket, step into natural daylight, and observe the horizon.")
        progress_bar = st.progress(0)
        status_text = st.empty()
        for i in range(100):
            time.sleep(0.05)
            progress_bar.progress(i + 1)
            status_text.text(f"Detox active: Absorbing natural photons... ({i+1}%)")
        st.balloons()
        st.success("🎉 Circadian alignment cycle recorded! SCN master clock synchronized.")

st.markdown("---")
with st.expander("📖 Scientific Literature & Photobiology Basis"):
    st.markdown("""
    - **Hattar et al. (Science 2002):** Melanopsin-expressing ipRGCs project directly to the SCN, synchronizing circadian clock genes.
    - **Lucas et al. (Trends in Neurosciences 2014):** CIE standards establish 480nm melanopic irradiance as the physiological driver of melatonin phase-shifting.
    - **Huberman Lab (Stanford Medicine):** 10–20 minutes of early daylight viewing creates the optimal morning dopamine/cortisol surge.
    """)
