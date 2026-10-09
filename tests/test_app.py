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
        self.assertEqual(data["observability_provider"], "Sentry Agent Tracing")

if __name__ == "__main__":
    unittest.main()
