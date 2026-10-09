"""
test_audio_service.py - Unit Tests for AudioDirectiveService
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from audio_service import AudioDirectiveService

class TestAudioDirectiveService(unittest.TestCase):
    def setUp(self):
        self.service = AudioDirectiveService()

    def test_acoustic_chime_generation(self):
        """Verify that offline acoustic chime generates a valid WAV header and non-empty byte buffer."""
        audio_bytes = self.service._generate_acoustic_chime()
        self.assertIsInstance(audio_bytes, bytes)
        self.assertGreater(len(audio_bytes), 44) # WAV header is at least 44 bytes

        # Check RIFF and WAVE magic bytes
        self.assertEqual(audio_bytes[:4], b"RIFF")
        self.assertEqual(audio_bytes[8:12], b"WAVE")

    def test_synthesize_speech_fallback(self):
        """Verify that synthesize_speech succeeds even with no API key via fallback."""
        audio_bytes = self.service.synthesize_speech("Test spoken directive.")
        self.assertIsInstance(audio_bytes, bytes)
        self.assertGreater(len(audio_bytes), 0)

if __name__ == "__main__":
    unittest.main()
