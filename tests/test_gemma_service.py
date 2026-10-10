"""
test_gemma_service.py - Unit Tests for Google Gemma 2 Service
"""

import unittest
from src.gemma_service import GemmaDirectiveService

class TestGemmaDirectiveService(unittest.TestCase):
    def setUp(self):
        self.service = GemmaDirectiveService()

    def test_directive_generation_fallback(self):
        directive = self.service.generate_directive(
            window_time="15:30",
            score=88,
            uv_index=2.4,
            cloud_cover=15
        )
        self.assertIsInstance(directive, str)
        self.assertIn("15:30", directive)
        self.assertTrue(len(directive) > 20)

    def test_directive_uv_adaptation(self):
        high_uv_directive = self.service.generate_directive(
            window_time="12:00",
            score=70,
            uv_index=7.5,
            cloud_cover=5
        )
        self.assertIn("elevated", high_uv_directive.lower())
