<div align="center">

<img src="docs/cover.png" alt="SunSync Banner" width="100%" style="border-radius: 12px; margin-bottom: 20px;" />

# ☀️ SunSync

### **Edge Photobiology AI & Circadian Realignment for Screen Workers**

[![Hacktoberfest 2026](https://img.shields.io/badge/Hacktoberfest-2026_DEV_Challenge-orange.svg?style=flat-square)](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)
[![Prior Labs TabPFN](https://img.shields.io/badge/ML_Engine-Prior_Labs_TabPFN-blue.svg?style=flat-square)](https://priorlabs.ai)
[![Sentry Agent Tracing](https://img.shields.io/badge/Telemetry-Sentry_Agent_Tracing-purple.svg?style=flat-square)](https://sentry.io)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-green.svg?style=flat-square)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

*An offline-first, edge intelligence application that models atmospheric telemetry and photobiological daylight flux using Prior Labs' TabPFN, calculating the exact zero-screen solar recharge window to reverse developer burnout and circadian disruption.*

[**Live Production App (Render)**](https://sunsync.onrender.com/) • [**Read DEV.to Submission Post**](https://dev.to) • [**Scientific Literature Review**](#-peer-reviewed-scientific-foundations)

</div>

---

## 📌 The Problem: The 480nm Photonic Deficit

Modern software engineers spend over **90% of daylight hours behind double-glazed glass windows** that filter out 99% of natural UV and severely attenuate the **480nm melanopic wavelengths** required to activate retinal ganglion cells. Meanwhile, their retinas are bombarded by narrow-band 450nm artificial screen spikes.

The result is chronic **circadian phase delay**: delayed melatonin release, sluggish morning focus, and restless sleep latency.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     THE DEVELOPER PHOTONIC CRISIS                      │
│                                                                        │
│   INDOORS (Behind Office Window):                                      │
│   • ~300 - 500 Lux (Heavily attenuated blue-cyan spectrum)             │
│   • 0% UV penetration (commercial Low-E glass filters 99%)             │
│   • ipRGCs fail to trigger SCN master clock synchronization            │
│   • Result: Delayed melatonin, afternoon brain fog, sleep disruption   │
│                                                                        │
│   OUTDOORS ("Touch Grass"):                                            │
│   • 10,000 - 100,000 Lux (Broad-spectrum diffuse natural daylight)     │
│   • Peak melanopsin activation at 480nm wavelength                     │
│   • Natural morning cortisol pulse + anchors sleep 14–16 hours later   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 How SunSync Works

**SunSync** evaluates local atmospheric telemetry (diffuse solar radiation, direct normal irradiance, cloud cover attenuation, UV index, and solar elevation angle) to compute the **Circadian Recharge Score (CRS: 0–100)**. 

Instead of an endless chatbot that traps you at your desk, SunSync determines your daily **20-minute Solar Recharge Window**, speaks a 15-second eyes-free directive, and prompts you to lock your workstation and step outside.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SUNSYNC SYSTEM TOPOLOGY                                 │
│                                                                                        │
│   [Free Open-Meteo Telemetry]          [Local Atmospheric Cache]                       │
│   (Hourly UV, Irradiance, Cloud)       (Offline Fallback Matrix)                       │
│                │                                   │                                   │
│                └─────────────────┬─────────────────┘                                   │
│                                  ▼                                                     │
│                  ┌───────────────────────────────┐                                     │
│                  │  Data Transformation Pipeline │                                     │
│                  │  (Feature Vector Assembly)    │                                     │
│                  └───────────────┬───────────────┘                                     │
│                                  │                                                     │
│                                  ▼                                                     │
│                  ┌───────────────────────────────┐     [Sentry Agent Tracing]          │
│                  │  Prior Labs TabPFN ML Core    │ ◄── (Monitors Inference Spans,      │
│                  │  (Zero-Shot Melanopic EML)    │     Latency & Pipeline Telemetry)   │
│                  └───────────────┬───────────────┘                                     │
│                                  │                                                     │
│                                  ▼                                                     │
│                  ┌───────────────────────────────┐                                     │
│                  │  Google Gemma 2 Local Core    │                                     │
│                  │  (15-Second Action Directive) │                                     │
│                  └───────────────┬───────────────┘                                     │
│                                  │                                                     │
│                                  ▼                                                     │
│                  ┌───────────────────────────────┐     [Render Cloud Platform]         │
│                  │  ElevenLabs Audio Synthesizer │ ──► (Public Web Application &       │
│                  │  (Screen-Free Spoken Brief)   │     REST API Gateway)               │
│                  └───────────────────────────────┘                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Sponsor Technology Integrations

| Sponsor Category | Implementation Responsibility | Prize Tier |
|---|---|---|
| **Prior Labs TabPFN** | Foundation transformer model evaluating multi-dimensional atmospheric tables for zero-shot Equivalent Melanopic Lux forecasting in <250ms. | **$200 USD** |
| **Sentry Agent Tracing** | Instruments distributed spans (`ai.telemetry.ingest`, `ai.model.tabpfn`, `ai.llm.gemma`), tracking latency and token metrics. | **$100 USD** |
| **Google Gemma 2** | Lightweight open-weight local model synthesizing tabular ML outputs into a 15-second human directive. | **$200 USD** |
| **ElevenLabs** | Synthesizes eyes-free spoken audio so developers can step into natural daylight without looking at a screen. | **$100 USD** |
| **Render** | Declarative infrastructure as code (`render.yaml`) hosting the production web service at zero cost. | **$200 USD** |

---

## 🚀 Quick Start (Local Run in 60 Seconds)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/OmarAfifi-CSE/sunsync.git
cd sunsync
pip install -r src/requirements.txt
```

### 2. Launch the Web Interface (Instant Local Server)
```bash
python run_local.py
```
Open your browser at `http://localhost:8000`.

### 3. API Documentation (FastAPI OpenAPI)
With the server running, visit `http://localhost:8000/docs` for the interactive Swagger schema and `/health` for system health telemetry.

---

## 🧪 Automated Test Suite

SunSync includes a comprehensive unit test suite covering data ingestion, TabPFN machine learning bounds, and audio synthesis:

```bash
python -m unittest discover tests
```

---

## 📖 Peer-Reviewed Scientific Foundations

1. **Hattar, S., et al. (Science, 2002):** *Melanopsin-containing retinal ganglion cells: architecture, projections, and intrinsic photosensitivity.* Identifies the non-image-forming retinal system synchronizing the SCN master clock. [DOI: 10.1126/science.1069609](https://doi.org/10.1126/science.1069609)
2. **Lucas, R. J., et al. (Trends in Neurosciences, 2014):** *Measuring and using light in the melanopsin age.* Formulates the CIE standard for Equivalent Melanopic Lux (EML). [DOI: 10.1016/j.tins.2013.10.004](https://doi.org/10.1016/j.tins.2013.10.004)
3. **Panda, S., et al. (Science, 2002):** *Melanopsin is required for non-image-forming photic responses in blind mice.* [DOI: 10.1126/science.1076109](https://doi.org/10.1126/science.1076109)
4. **Huberman Lab (Stanford School of Medicine):** Clinical protocols establishing that 10–20 minutes of outdoor morning daylight viewing anchors cortisol and melatonin rhythms.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
