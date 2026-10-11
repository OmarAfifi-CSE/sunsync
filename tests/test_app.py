"""
test_app.py - Integration Tests for SunSync FastAPI Application
"""

import sys
import os
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from app import app

class TestSunSyncApp(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check_endpoint(self):
        """Verify that /health returns 200 OK and healthy status."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "sunsync-core")

    def test_evaluate_endpoint(self):
        """Verify that /evaluate executes end-to-end and returns complete circadian response."""
        response = self.client.get("/evaluate?lat=30.5877&lon=31.3468")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("optimal_window", data)
        self.assertIn("recharge_score", data)
        self.assertIn("spoken_directive", data)
        self.assertIn("telemetry_latency_ms", data)
        self.assertIn("ml_latency_ms", data)
        self.assertIn("total_pipeline_ms", data)
        self.assertIn("cloud_cover_pct", data)
        self.assertEqual(data["observability_provider"], "Sentry Agent Tracing")

    def test_evaluate_rejects_bad_coordinates(self):
        """Verify that out-of-range coordinates are rejected with 422."""
        response = self.client.get("/evaluate?lat=999&lon=0")
        self.assertEqual(response.status_code, 422)

    def test_directive_endpoint(self):
        """Verify that /directive returns a spoken directive with source attribution."""
        response = self.client.get("/directive?window=14:15%20-%2014:35&score=88&uv=2.8&cloud=15")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("spoken_directive", data)
        self.assertTrue(len(data["spoken_directive"]) > 20)
        self.assertIn(data["source"], ("gemma", "edge"))
        self.assertIn("llm_latency_ms", data)
        self.assertIn("model", data)

    def test_geocode_endpoint(self):
        """Verify that /geocode resolves a city name to coordinates."""
        response = self.client.get("/geocode?name=Cairo")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        first = data[0]
        self.assertIn("latitude", first)
        self.assertIn("longitude", first)
        self.assertGreaterEqual(first["latitude"], -90)
        self.assertLessEqual(first["latitude"], 90)

    def test_geocode_rejects_short_query(self):
        """Verify that too-short place queries are rejected with 422."""
        response = self.client.get("/geocode?name=X")
        self.assertEqual(response.status_code, 422)

if __name__ == "__main__":
    unittest.main()
