"""
audio_service.py - Authentic Screen-Free Spoken Directive Synthesizer

Provides genuine eyes-free speech synthesis for SunSync using ElevenLabs API
powered by official premade voice AI (Charlie) and the low-latency eleven_flash_v2_5 model.
"""

import os
import requests

class AudioDirectiveService:
    # Charlie (IKne3meq5aSn9XLyUdCD): relaxed, natural conversationalist —
    # the calmest masculine guide for eyes-free outdoor send-offs.
    DEFAULT_VOICE_ID = "IKne3meq5aSn9XLyUdCD"
    DEFAULT_VOICE_NAME = "Charlie"

    def __init__(self, api_key: str = None, voice_id: str = None):
        """
        Initializes ElevenLabs audio service.
        Default voice: 'Charlie' (IKne3meq5aSn9XLyUdCD - calm, natural, reassuring).
        """
        self.api_key = api_key if api_key is not None else os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID") or self.DEFAULT_VOICE_ID
        self.voice_name = self.DEFAULT_VOICE_NAME if self.voice_id == self.DEFAULT_VOICE_ID else "Custom"
        self.base_url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"

    def synthesize_speech(self, text: str) -> bytes:
        """
        Synthesizes authentic spoken audio from text via ElevenLabs API.
        Returns raw MP3 audio bytes. Raises RuntimeError on failure (no artificial fallback).
        """
        if not text or not text.strip():
            raise RuntimeError("Cannot synthesize empty text.")
        if not self.api_key:
            raise RuntimeError("Missing ELEVENLABS_API_KEY environment variable.")

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        payload = {
            "text": text,
            "model_id": "eleven_flash_v2_5",
            "voice_settings": {
                "stability": 0.75,
                "similarity_boost": 0.85
            }
        }
        try:
            response = requests.post(self.base_url, json=payload, headers=headers, timeout=15.0)
        except requests.RequestException as exc:
            raise RuntimeError(f"ElevenLabs request failed: {exc}")
        if response.status_code == 200:
            if not response.content:
                raise RuntimeError("ElevenLabs returned empty audio payload.")
            return response.content
        else:
            raise RuntimeError(f"ElevenLabs API error ({response.status_code}): {response.text}")
