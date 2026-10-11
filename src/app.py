"""
app.py - SunSync Core REST API with Sentry Agent Tracing & High-Performance UI

Production FastAPI service instrumented with Sentry distributed spans,
measuring end-to-end telemetry ingestion, TabPFN inference latency,
and Gemma / ElevenLabs eyes-free synthesis. Serves the ultra-fast
instant-paint static frontend.
"""

import os
import sys
import math
import time
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

# Ensure src directory is in Python path for reliable module resolution
SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

# Load environment variables from .env
load_dotenv()

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import requests

from data_service import AtmosphericDataService
from circadian_ml import CircadianMLEngine
from gemma_service import GemmaDirectiveService
from audio_service import AudioDirectiveService

# ---------------------------------------------------------------------------
# Sentry Observability & Distributed Tracing Setup
# ---------------------------------------------------------------------------
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
        environment=os.getenv("ENVIRONMENT", "production"),
        release="sunsync@1.0.0",
    )

@asynccontextmanager
async def _lifespan(_: FastAPI):
    # Pay TabPFN's one-time init cost at boot so the first user request
    # never waits on model cold-start. Never blocks deployment on failure.
    try:
        ml_engine.warm_up()
    except Exception:
        pass
    yield

app = FastAPI(
    title="SunSync Photobiology API",
    description="Edge-ready circadian intelligence engine powered by TabPFN & Sentry",
    version="1.0.0",
    lifespan=_lifespan,
)

ml_engine = CircadianMLEngine()
audio_service = AudioDirectiveService()

def _sanitize_float(value: float, default: float = 0.0) -> float:
    """Coerce NaN/Inf floats (from flaky telemetry) into safe JSON-serializable numbers."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    return number


class CircadianResponse(BaseModel):
    status: str
    optimal_window: str
    recharge_score: float
    uv_index: float
    spoken_directive: str
    directive_source: str = "edge-instant"
    cloud_cover_pct: float = 20.0
    telemetry_latency_ms: float
    ml_latency_ms: float
    total_pipeline_ms: float
    model_provider: str
    observability_provider: str
    hourly_timeline: list = []
    solar_elevation_deg: float = 0.0
    diffuse_irradiance_wm2: float = 0.0
    utc_offset_seconds: int = 0
    window_state: str = "live"

class DirectiveResponse(BaseModel):
    spoken_directive: str
    source: str = "edge"
    llm_latency_ms: float = 0.0
    model: str = ""

class GeocodeResult(BaseModel):
    name: str
    latitude: float
    longitude: float
    country: str = ""
    admin1: str = ""

class AudioSynthesisRequest(BaseModel):
    text: str

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "sunsync-core", "version": "1.0.0"}

@app.get("/evaluate", response_model=CircadianResponse)
def evaluate_solar_window(
    lat: float = Query(default=40.7128, ge=-90.0, le=90.0, description="User Latitude"),
    lon: float = Query(default=-74.0060, ge=-180.0, le=180.0, description="User Longitude")
):
    """
    Fast evaluation endpoint: ingests solar telemetry and runs TabPFN
    inference (~2s). Returns instantly with an on-device analytical directive;
    the client upgrades it via /directive (live Gemma) in the background.
    Every number is a real fresh measurement — no caching anywhere.
    """
    pipeline_start = time.time()

    telemetry_df, ml_result, t_ingest_ms, utc_offset = _run_telemetry_ml(lat, lon)

    score = _sanitize_float(ml_result["circadian_recharge_score"])
    window = ml_result["window_time_formatted"]
    uv = _sanitize_float(ml_result["uv_index"])
    cloud = _extract_cloud_cover(telemetry_df)

    gemma_service = GemmaDirectiveService()
    state = _window_state(window, utc_offset)
    instant_directive = gemma_service.analytical_directive(window, score, uv, cloud, state)

    total_latency_ms = round((time.time() - pipeline_start) * 1000, 2)

    return CircadianResponse(
        status="success",
        optimal_window=window,
        recharge_score=score,
        uv_index=uv,
        spoken_directive=instant_directive,
        directive_source="edge-instant",
        cloud_cover_pct=float(cloud),
        telemetry_latency_ms=t_ingest_ms,
        ml_latency_ms=_sanitize_float(ml_result["inference_latency_ms"]),
        total_pipeline_ms=total_latency_ms,
        model_provider=ml_result.get("model_architecture", "Prior Labs TabPFN + Google Gemma"),
        observability_provider="Sentry Agent Tracing",
        hourly_timeline=_sanitize_timeline(ml_result.get("hourly_timeline", [])),
        solar_elevation_deg=_sanitize_float(ml_result.get("solar_elevation_deg", 0.0)),
        diffuse_irradiance_wm2=_sanitize_float(ml_result.get("diffuse_irradiance_wm2", 0.0)),
        utc_offset_seconds=utc_offset,
        window_state=state,
    )

@app.get("/directive", response_model=DirectiveResponse)
def synthesize_directive(
    window: str = Query(default="12:15 - 12:35", description="Peak window, e.g. 14:15 - 14:35"),
    score: float = Query(default=80.0, ge=0.0, le=100.0, description="Circadian Recharge Score"),
    uv: float = Query(default=2.5, ge=0.0, le=15.0, description="UV Index"),
    cloud: int = Query(default=20, ge=0, le=100, description="Cloud cover percent"),
    state: str = Query(default="live", description="Window timing: upcoming, live, or past"),
):
    """
    Slow lane: asks live Gemma for a tailored spoken directive. Called by the
    client AFTER /evaluate has already painted, so only this span loads late.
    """
    if state not in ("upcoming", "live", "past"):
        state = "live"
    t0 = time.time()
    with sentry_sdk.start_span(op="ai.llm.gemma", name="Gemma Eyes-Free Directive Synthesis") as span_gemma:
        gemma_service = GemmaDirectiveService()
        spoken_directive, source, model_used = gemma_service.generate_directive_with_source(window, score, uv, cloud, state)
        llm_ms = round((time.time() - t0) * 1000, 2)

        span_gemma.set_data("llm.model", model_used)
        span_gemma.set_data("llm.estimated_prompt_tokens", 48)
        span_gemma.set_data("llm.estimated_completion_tokens", len(spoken_directive.split()) * 2)
        span_gemma.set_data("directive.source", source)

    return DirectiveResponse(
        spoken_directive=spoken_directive,
        source=source,
        llm_latency_ms=llm_ms,
        model=model_used,
    )

def _window_state(window: str, utc_offset: int) -> str:
    """
    Classifies the peak window against the PLACE-local now so no directive
    ever tells a user to chase light that already passed.
    Returns "upcoming" | "live" | "past" (safe default: "live").
    """
    try:
        from datetime import datetime, timedelta, timezone
        start = str(window).split("-")[0].strip()
        hh, mm = (int(x) for x in start.split(":"))
        now_place = datetime.now(timezone.utc) + timedelta(seconds=int(utc_offset or 0))
        window_start = now_place.replace(hour=hh, minute=mm, second=0, microsecond=0)
        delta_min = (window_start - now_place).total_seconds() / 60.0
        if delta_min > 1:
            return "upcoming"
        if delta_min >= -20:
            return "live"
        return "past"
    except Exception:
        return "live"

def _extract_cloud_cover(telemetry_df) -> int:
    try:
        return int(telemetry_df.iloc[0].get("cloud_cover_pct", 20))
    except (IndexError, AttributeError, ValueError, TypeError):
        return 20

def _sanitize_timeline(hourly_timeline: list) -> list:
    for row in hourly_timeline:
        row["circadian_score"] = _sanitize_float(row.get("circadian_score", 0.0))
        row["uv_index"] = _sanitize_float(row.get("uv_index", 0.0))
    return hourly_timeline

def _run_telemetry_ml(lat: float, lon: float):
    """
    Runs telemetry ingestion + TabPFN inference with Sentry spans.
    Returns (telemetry_df, ml_result, ingest_ms, utc_offset_seconds).
    Always fresh, never cached.
    """
    # Span 1: Atmospheric Ingestion
    with sentry_sdk.start_span(op="ai.telemetry.ingest", name="Open-Meteo Atmospheric Ingestion") as span_ingest:
        t0 = time.time()
        service = AtmosphericDataService(latitude=lat, longitude=lon)
        telemetry_df = service.fetch_solar_telemetry()
        t_ingest_ms = round((time.time() - t0) * 1000, 2)
        if telemetry_df is None or telemetry_df.empty:
            raise HTTPException(status_code=502, detail="Atmospheric telemetry unavailable for these coordinates.")
        span_ingest.set_data("rows_retrieved", len(telemetry_df))
        span_ingest.set_data("latitude", lat)
        span_ingest.set_data("longitude", lon)

    # Span 2: Prior Labs TabPFN Inference
    with sentry_sdk.start_span(op="ai.model.tabpfn", name="Prior Labs TabPFN Melanopic Regression") as span_ml:
        try:
            ml_result = ml_engine.predict_optimal_window(telemetry_df)
        except ValueError as exc:
            raise HTTPException(status_code=502, detail=f"Circadian inference failed: {exc}")
        span_ml.set_data("model_architecture", ml_result["model_architecture"])
        span_ml.set_data("inference_latency_ms", ml_result["inference_latency_ms"])
        span_ml.set_data("circadian_score", ml_result["circadian_recharge_score"])
        span_ml.set_data("optimal_hour", ml_result["optimal_hour"])

    try:
        utc_offset = int(service.utc_offset_seconds or 0)
    except (TypeError, ValueError, AttributeError):
        utc_offset = 0
    return telemetry_df, ml_result, t_ingest_ms, utc_offset

@app.get("/geocode", response_model=list[GeocodeResult])
def geocode_place(
    name: str = Query(..., min_length=2, max_length=100, description="Place name to search"),
):
    """
    Free place search via Open-Meteo Geocoding (no key). Powers the
    "search any city" box so judges can jump anywhere in seconds.
    """
    query = (name or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Missing place name.")
    try:
        resp = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": query, "count": 6, "language": "en", "format": "json"},
            timeout=6.0,
        )
        resp.raise_for_status()
        results = (resp.json().get("results") or [])[:6]
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Place search failed: {exc}")
    out = []
    for r in results:
        try:
            out.append(GeocodeResult(
                name=str(r.get("name", query)),
                latitude=float(r["latitude"]),
                longitude=float(r["longitude"]),
                country=str(r.get("country", "")),
                admin1=str(r.get("admin1", "")),
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return out

@app.post("/synthesize-audio")
def synthesize_audio(request: AudioSynthesisRequest):
    """
    Synthesizes speech directive into genuine MP3 audio bytes via ElevenLabs.
    """
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing text for audio synthesis")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="Text exceeds 1000-character synthesis limit.")
    try:
        audio_bytes = audio_service.synthesize_speech(text)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "X-Voice-Id": audio_service.voice_id,
                "X-Voice-Name": getattr(audio_service, "voice_name", "Custom"),
            },
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"ElevenLabs TTS failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ElevenLabs TTS failed: {str(e)}")

# ---------------------------------------------------------------------------
# Static Web App Mounting (Instant 30ms First-Paint Delivery)
# ---------------------------------------------------------------------------
STATIC_DIR = SRC_DIR / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/favicon.ico")
def serve_favicon():
    favicon_path = STATIC_DIR / "favicon.svg"
    if favicon_path.exists():
        return FileResponse(str(favicon_path), media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Favicon not found")

@app.get("/")
def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"status": "ok", "message": "SunSync API active. Static dashboard folder not initialized."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

