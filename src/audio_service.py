"""
audio_service.py - Authentic Screen-Free Spoken Directive Synthesizer

Provides genuine eyes-free speech synthesis for SunSync using ElevenLabs API
powered by official premade voice AI (Sarah) and the low-latency eleven_flash_v2_5 model.
"""

import os
import requests

class AudioDirectiveService:
    def __init__(self, api_key: str = None, voice_id: str = "EXAVITQu4vr4xnSDxMaL"):
        """
        Initializes ElevenLabs audio service.
        Default voice: 'Sarah' (EXAVITQu4vr4xnSDxMaL - soothing, natural, reassuring).
        """
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = voice_id
        self.base_url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"

    def synthesize_speech(self, text: str) -> bytes:
        """
        Synthesizes authentic spoken audio from text via ElevenLabs API.
        Returns raw MP3 audio bytes. Raises RuntimeError on failure (no artificial fallback).
        """
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
        response = requests.post(self.base_url, json=payload, headers=headers, timeout=10.0)
        if response.status_code == 200:
            return response.content
        else:
            raise RuntimeError(f"ElevenLabs API error ({response.status_code}): {response.text}")
