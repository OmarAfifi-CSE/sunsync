"""
test_gemma_service.py - Unit Tests for Google Gemma Directive Service
"""

import sys
import os
import unittest
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env")))

from gemma_service import GemmaDirectiveService

class TestGemmaDirectiveService(unittest.TestCase):
    def setUp(self):
        self.service = GemmaDirectiveService()

    def test_directive_generation(self):
        """Verify that directive is synthesized into a coherent string."""
        directive = self.service.generate_directive(
            window_time="15:30",
            score=88,
            uv_index=2.4,
            cloud_cover=15
        )
        self.assertIsInstance(directive, str)
        self.assertTrue(len(directive) > 20)
        # Should contain key circadian / solar concepts
        directive_lower = directive.lower()
        has_keywords = any(k in directive_lower for k in ["circadian", "sunlight", "daylight", "window", "outside", "screen", "clock", "recharge"])
        self.assertTrue(has_keywords)

    def test_edge_fallback_adaptation(self):
        """Verify analytical fallback generates proper photobiological guidance when offline."""
        service_offline = GemmaDirectiveService()
        service_offline.google_api_key = None
        service_offline.openrouter_api_key = None
        fallback_directive = service_offline.generate_directive(
            window_time="12:00",
            score=70,
            uv_index=7.5,
            cloud_cover=5
        )
        self.assertIn("12:00", fallback_directive)
        self.assertIn("elevated", fallback_directive.lower())

    def test_validator_accepts_grounded_directive(self):
        """Verify validator passes text repeating the computed window and UV."""
        ok = self.service.validate_directive(
            "Your peak window opens at 14:15. UV is gentle at 2.8, step outside now.",
            window_time="14:15 - 14:35",
            uv_index=2.8,
        )
        self.assertTrue(ok)

    def test_validator_rejects_wrong_window(self):
        """Verify validator rejects hallucinated times."""
        ok = self.service.validate_directive(
            "Your peak window opens at 09:00. UV is gentle at 2.8, step outside now.",
            window_time="14:15 - 14:35",
            uv_index=2.8,
        )
        self.assertFalse(ok)

    def test_validator_rejects_missing_uv(self):
        """Verify validator rejects directives that drop the UV grounding."""
        ok = self.service.validate_directive(
            "Your peak window opens at 14:15. The weather is nice, step outside now.",
            window_time="14:15 - 14:35",
            uv_index=2.8,
        )
        self.assertFalse(ok)

    def test_validator_rejects_empty(self):
        """Verify validator rejects empty or trivial text."""
        self.assertFalse(self.service.validate_directive("", "14:15 - 14:35", 2.8))
        self.assertFalse(self.service.validate_directive("Go outside.", "14:15 - 14:35", 2.8))

    def test_with_source_offline_reports_edge(self):
        """Verify keyless path reports edge source with analytical model tag."""
        svc = GemmaDirectiveService()
        svc.google_api_key = None
        svc.openrouter_api_key = None
        text, source, model = svc.generate_directive_with_source("14:15 - 14:35", 88, 2.8, 15)
        self.assertEqual(source, "edge")
        self.assertEqual(model, "analytical-edge")
        self.assertIn("14:15", text)

    def test_past_state_never_says_go_now(self):
        """Verify a passed window is mourned, never chased."""
        svc = GemmaDirectiveService()
        svc.google_api_key = None
        svc.openrouter_api_key = None
        text, source, _ = svc.generate_directive_with_source(
            "14:15 - 14:35", 100, 5.3, 10, state="past")
        self.assertEqual(source, "edge")
        lowered = text.lower()
        self.assertIn("14:15", text)
        self.assertNotIn("lock your screen, step outside", lowered)
        self.assertTrue("missed" in lowered or "tomorrow" in lowered)

    def test_upcoming_state_says_get_ready(self):
        """Verify a future window tells users to wait for it, not rush now."""
        svc = GemmaDirectiveService()
        svc.google_api_key = None
        svc.openrouter_api_key = None
        text, source, _ = svc.generate_directive_with_source(
            "14:15 - 14:35", 90, 3.1, 10, state="upcoming")
        self.assertEqual(source, "edge")
        self.assertIn("14:15", text)
        self.assertIn("opens at", text.lower())

if __name__ == "__main__":
    unittest.main()
