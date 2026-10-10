"""
app.py - SunSync Core REST API with Sentry Agent Tracing

Production FastAPI service instrumented with Sentry distributed spans,
measuring end-to-end telemetry ingestion, TabPFN inference latency,
and Gemma 2 / ElevenLabs eyes-free synthesis.
"""

import os
import time
from dotenv import load_dotenv
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

# Load environment variables from .env
load_dotenv()

from data_service import AtmosphericDataService
from circadian_ml import CircadianMLEngine
from gemma_service import GemmaDirectiveService

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

app = FastAPI(
    title="SunSync Photobiology API",
    description="Edge-ready circadian intelligence engine powered by TabPFN & Sentry",
    version="1.0.0"
)

data_service = AtmosphericDataService()
ml_engine = CircadianMLEngine()

class CircadianResponse(BaseModel):
    status: str
    optimal_window: str
    recharge_score: float
    uv_index: float
    spoken_directive: str
    telemetry_latency_ms: float
    ml_latency_ms: float
    total_pipeline_ms: float
    model_provider: str
    observability_provider: str

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "sunsync-core", "version": "1.0.0"}

@app.get("/evaluate", response_model=CircadianResponse)
def evaluate_solar_window(
    lat: float = Query(default=30.5877, description="User Latitude"),
    lon: float = Query(default=31.3468, description="User Longitude")
):
    """
    Main evaluation endpoint. Ingests solar telemetry, runs TabPFN inference,
    synthesizes a 15-second eyes-free directive, and records detailed Sentry spans.
    """
    pipeline_start = time.time()

    # Span 1: Atmospheric Ingestion
    with sentry_sdk.start_span(op="ai.telemetry.ingest", name="Open-Meteo Atmospheric Ingestion") as span_ingest:
        t0 = time.time()
        service = AtmosphericDataService(latitude=lat, longitude=lon)
        telemetry_df = service.fetch_solar_telemetry()
        t_ingest_ms = round((time.time() - t0) * 1000, 2)
        span_ingest.set_data("rows_retrieved", len(telemetry_df))
        span_ingest.set_data("latitude", lat)
        span_ingest.set_data("longitude", lon)

    # Span 2: Prior Labs TabPFN Inference
    with sentry_sdk.start_span(op="ai.model.tabpfn", name="Prior Labs TabPFN Melanopic Regression") as span_ml:
        ml_result = ml_engine.predict_optimal_window(telemetry_df)
        span_ml.set_data("model_architecture", ml_result["model_architecture"])
        span_ml.set_data("inference_latency_ms", ml_result["inference_latency_ms"])
        span_ml.set_data("circadian_score", ml_result["circadian_recharge_score"])
        span_ml.set_data("optimal_hour", ml_result["optimal_hour"])

    # Span 3: Google Gemma 2 / ElevenLabs Voice Synthesis
    with sentry_sdk.start_span(op="ai.llm.gemma", name="Gemma 2 Eyes-Free Directive Synthesis") as span_gemma:
        score = ml_result["circadian_recharge_score"]
        window = ml_result["window_time_formatted"]
        uv = ml_result["uv_index"]
        cloud = int(telemetry_df.iloc[0].get("cloud_cover_pct", 20))

        gemma_service = GemmaDirectiveService()
        spoken_directive = gemma_service.generate_directive(window, score, uv, cloud)

        # Record LLM token metrics for Sentry Partner Category
        span_gemma.set_data("llm.model", "google/gemma-2-2b-it")
        span_gemma.set_data("llm.estimated_prompt_tokens", 48)
        span_gemma.set_data("llm.estimated_completion_tokens", len(spoken_directive.split()) * 2)

    total_latency_ms = round((time.time() - pipeline_start) * 1000, 2)

    return CircadianResponse(
        status="success",
        optimal_window=window,
        recharge_score=score,
        uv_index=uv,
        spoken_directive=spoken_directive,
        telemetry_latency_ms=t_ingest_ms,
        ml_latency_ms=ml_result["inference_latency_ms"],
        total_pipeline_ms=total_latency_ms,
        model_provider="Prior Labs TabPFN + Google Gemma 2",
        observability_provider="Sentry Agent Tracing"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
