"""
audio_service.py - Screen-Free Spoken Directive Synthesizer

Provides eyes-free audio synthesis for SunSync using ElevenLabs API
with automatic offline audio synthesis fallback for zero-dependency execution.
"""

import os
import io
import requests

class AudioDirectiveService:
    def __init__(self, api_key: str = None, voice_id: str = "21m00Tcm4TlvDq8ikWAM"):
        """
        Initializes ElevenLabs audio service.
        Default voice: 'Rachel' (warm, clear, meditative).
        """
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = voice_id
        self.base_url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"

    def synthesize_speech(self, text: str) -> bytes:
        """
        Synthesizes spoken audio from text.
        Returns raw audio bytes (MP3 or WAV). Falls back to generated PCM chime if offline.
        """
        if self.api_key:
            try:
                headers = {
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": self.api_key
                }
                payload = {
                    "text": text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {
                        "stability": 0.75,
                        "similarity_boost": 0.85
                    }
                }
                response = requests.post(self.base_url, json=payload, headers=headers, timeout=8.0)
                if response.status_code == 200:
                    return response.content
            except Exception:
                pass

        # Resilient offline fallback: synthesize simple acoustic bell chime (WAV format)
        return self._generate_acoustic_chime()

    def _generate_acoustic_chime(self) -> bytes:
        """
        Generates a pleasant 1.5-second acoustic sine-wave chime in valid WAV format
        without requiring external audio libraries or system codecs.
        """
        import struct
        import math

        sample_rate = 22050
        duration_s = 1.2
        num_samples = int(sample_rate * duration_s)
        freq = 528.0  # 528 Hz harmonic solfeggio tone (peace / clarity)

        buf = io.BytesIO()
        # RIFF header
        buf.write(b"RIFF")
        buf.write(struct.pack("<I", 36 + num_samples * 2))
        buf.write(b"WAVE")
        buf.write(b"fmt ")
        buf.write(struct.pack("<I", 16))          # Subchunk1Size
        buf.write(struct.pack("<H", 1))           # AudioFormat (PCM)
        buf.write(struct.pack("<H", 1))           # NumChannels (Mono)
        buf.write(struct.pack("<I", sample_rate)) # SampleRate
        buf.write(struct.pack("<I", sample_rate * 2)) # ByteRate
        buf.write(struct.pack("<H", 2))           # BlockAlign
        buf.write(struct.pack("<H", 16))          # BitsPerSample
        buf.write(b"data")
        buf.write(struct.pack("<I", num_samples * 2))

        for i in range(num_samples):
            t = float(i) / sample_rate
            # Smooth exponential decay envelope
            amplitude = math.exp(-2.5 * t) * 0.7
            sample = int(32767.0 * amplitude * math.sin(2.0 * math.pi * freq * t))
            buf.write(struct.pack("<h", max(-32768, min(32767, sample))))

        buf.seek(0)
        return buf.read()
