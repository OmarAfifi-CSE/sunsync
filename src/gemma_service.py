"""
gemma_service.py - Google Gemma 2 Directive Synthesizer

Transforms tabular photobiological telemetry and TabPFN Circadian Recharge Scores
into a concise, 15-second eyes-free spoken directive using Google's Gemma 2.
Supports Google AI Studio, Groq, Hugging Face, or resilient edge fallback.
"""

import os
import requests

class GemmaDirectiveService:
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.hf_api_key = os.getenv("HUGGINGFACE_API_KEY")

    def generate_directive(self, window_time: str, score: int, uv_index: float, cloud_cover: int) -> str:
        """
        Generates a 15-second human action directive based on atmospheric parameters.
        """
        prompt = (
            f"You are SunSync's photobiology coach. "
            f"Given the user's solar telemetry: Peak recharge window is {window_time}, "
            f"Circadian Recharge Score is {score}/100, UV Index is {uv_index}, and Cloud Cover is {cloud_cover}%. "
            f"Write a single concise spoken directive (maximum 2 sentences, 25-30 words) instructing the developer "
            f"to lock their screen and step outside to anchor their circadian clock. Do not include quotes or formatting."
        )

        # 1. Try Groq Gemma 2 (Fastest & Free)
        if self.groq_api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.groq_api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "gemma2-9b-it",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 80,
                    "temperature": 0.6
                }
                resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=5.0)
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip()
                    if text:
                        return text.strip('"')
            except Exception:
                pass

        # 2. Try Google Gemma Official Model with fast 2.5s timeout
        if self.google_api_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key={self.google_api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "maxOutputTokens": 120,
                        "temperature": 0.4
                    }
                }
                resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=2.5)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw = parts[-1].get("text", "").strip()
                            # Clean output: extract quoted text or meaningful sentence
                            import re
                            quotes = re.findall(r'"([^"]{20,160})"', raw)
                            if quotes:
                                return quotes[0].strip()
                            clean_lines = [l.strip(' *#-') for l in raw.splitlines() if len(l.strip(' *#-')) > 20 and not l.strip().startswith(('Context', 'Goal', 'Constraint', 'Input', 'Persona'))]
                            if clean_lines:
                                return clean_lines[-1].strip('"')
            except Exception:
                pass


        # 4. Resilient Edge Synthesis Fallback (Modeled after Gemma 2 instruction-tuned outputs)
        if uv_index < 3.0:
            uv_note = f"UV is gentle at {uv_index}, making it safe for direct, unshielded viewing"
        elif uv_index < 6.0:
            uv_note = f"UV is moderate at {uv_index}, ideal for diffuse ambient light without harsh glare"
        else:
            uv_note = f"UV is elevated at {uv_index}; enjoy indirect daylight in shaded open air"

        return (
            f"Your peak melanopic solar recharge window opens at {window_time}. "
            f"{uv_note}. Lock your screen, step outside into natural daylight, "
            f"and let your retinal cells anchor your master circadian clock."
        )
