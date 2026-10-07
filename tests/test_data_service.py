"""
test_data_service.py - Unit Tests for AtmosphericDataService
"""

import sys
import os
import unittest
import pandas as pd

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from data_service import AtmosphericDataService

class TestAtmosphericDataService(unittest.TestCase):
    def setUp(self):
        self.service = AtmosphericDataService(latitude=30.5877, longitude=31.3468)

    def test_fetch_solar_telemetry_returns_dataframe(self):
        """Verify that fetch_solar_telemetry returns a valid pandas DataFrame with required columns."""
        df = self.service.fetch_solar_telemetry()
        self.assertIsInstance(df, pd.DataFrame)
        self.assertGreater(len(df), 0)

        expected_cols = [
            "time",
            "temperature_c",
            "direct_irradiance_wm2",
            "diffuse_irradiance_wm2",
            "uv_index",
            "cloud_cover_pct",
            "hour",
            "solar_elevation_deg"
        ]
        for col in expected_cols:
            self.assertIn(col, df.columns)

    def test_solar_elevation_estimation(self):
        """Verify that solar elevation angles follow daylight physical bounds (0 to 65 deg)."""
        self.assertEqual(self.service._estimate_solar_elevation(0), 0.0)
        self.assertEqual(self.service._estimate_solar_elevation(6), 0.0)
        noon_elevation = self.service._estimate_solar_elevation(12)
        self.assertGreater(noon_elevation, 60.0)
        self.assertLessEqual(noon_elevation, 65.0)

    def test_offline_telemetry_generation(self):
        """Verify that offline synthetic fallback generates exactly 24 valid hourly records."""
        offline_df = self.service._generate_offline_telemetry()
        self.assertEqual(len(offline_df), 24)
        self.assertTrue((offline_df["uv_index"] >= 0).all())
        self.assertTrue((offline_df["direct_irradiance_wm2"] >= 0).all())

if __name__ == "__main__":
    unittest.main()
