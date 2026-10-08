"""
test_circadian_ml.py - Unit Tests for CircadianMLEngine
"""

import sys
import os
import unittest
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from data_service import AtmosphericDataService
from circadian_ml import CircadianMLEngine

class TestCircadianMLEngine(unittest.TestCase):
    def setUp(self):
        self.data_service = AtmosphericDataService()
        self.engine = CircadianMLEngine(use_cpu=True)

    def test_predict_optimal_window_structure(self):
        """Verify that prediction output contains all critical photobiology parameters."""
        telemetry_df = self.data_service.fetch_solar_telemetry()
        result = self.engine.predict_optimal_window(telemetry_df)

        required_keys = [
            "optimal_hour",
            "window_time_formatted",
            "circadian_recharge_score",
            "uv_index",
            "solar_elevation_deg",
            "diffuse_irradiance_wm2",
            "inference_latency_ms",
            "model_architecture",
            "hourly_timeline"
        ]
        for key in required_keys:
            self.assertIn(key, result)

    def test_circadian_score_bounds(self):
        """Ensure Circadian Recharge Score (CRS) is bounded between 0 and 100."""
        telemetry_df = self.data_service.fetch_solar_telemetry()
        result = self.engine.predict_optimal_window(telemetry_df)

        score = result["circadian_recharge_score"]
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 100.0)

    def test_hourly_timeline_length(self):
        """Ensure daytime timeline evaluates between 7 AM and 6 PM (12 hours)."""
        telemetry_df = self.data_service.fetch_solar_telemetry()
        result = self.engine.predict_optimal_window(telemetry_df)
        self.assertEqual(len(result["hourly_timeline"]), 12)

if __name__ == "__main__":
    unittest.main()
