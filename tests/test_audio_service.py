"""
test_audio_service.py - Unit Tests for AudioDirectiveService
"""

import sys
import os
import unittest
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env")))

from audio_service import AudioDirectiveService

class TestAudioDirectiveService(unittest.TestCase):
    def setUp(self):
        self.service = AudioDirectiveService()

    def test_voice_configuration(self):
        """Verify default voice is configured to Charlie premade voice."""
        self.assertEqual(self.service.voice_id, "IKne3meq5aSn9XLyUdCD")
        self.assertIn("elevenlabs.io", self.service.base_url)

    def test_synthesize_speech_live(self):
        """Verify live synthesis generates valid MP3 audio bytes."""
        if not self.service.api_key:
            self.skipTest("ELEVENLABS_API_KEY not configured")
        audio_bytes = self.service.synthesize_speech("Your circadian recharge window is now active.")
        self.assertIsInstance(audio_bytes, bytes)
        self.assertGreater(len(audio_bytes), 1000)
        # Check MP3 magic header (ID3 or sync frame)
        is_mp3 = audio_bytes.startswith(b"ID3") or b"\xff\xfb" in audio_bytes[:10]
        self.assertTrue(is_mp3)

    def test_missing_api_key_raises_error(self):
        """Verify missing API key raises RuntimeError without fake chime."""
        service_no_key = AudioDirectiveService(api_key="")
        with self.assertRaises(RuntimeError):
            service_no_key.synthesize_speech("Test speech.")

if __name__ == "__main__":
    unittest.main()
