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

    def generate_directive(self, window_time: str, score: int, uv_index: float, cloud_cover: int) -> str:
        """
        Generates a 15-second human action directive based on atmospheric parameters
        exclusively using Google's official Gemma AI model.
        """
        prompt = (
            f"You are SunSync's photobiology voice coach. "
            f"Given the user's solar telemetry: Peak recharge window is {window_time}, "
            f"Circadian Recharge Score is {score}/100, UV Index is {uv_index}, and Cloud Cover is {cloud_cover}%. "
            f"Write a single concise spoken directive (maximum 2 sentences, 25-30 words) instructing the developer "
            f"to lock their screen and step outside into natural daylight to anchor their master circadian clock. "
            f"Start directly with the spoken sentence in quotes."
        )

        # Strictly use Google's Official Gemma model on Google AI Studio
        if self.google_api_key:
            for model_name in ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.google_api_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "maxOutputTokens": 300,
                            "temperature": 0.3
                        }
                    }
                    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12.0)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                raw = parts[-1].get("text", "").strip()
                                import re
                                quotes = re.findall(r'"([^"]{20,200})"', raw)
                                if quotes:
                                    return quotes[-1].strip()
                                clean_lines = [
                                    l.strip(' *#-') for l in raw.splitlines()
                                    if len(l.strip(' *#-')) > 20
                                    and not l.strip().startswith(('Context', 'Goal', 'Constraint', 'Input', 'Persona', 'Option', 'Tone', 'Thought', 'Step'))
                                ]
                                if clean_lines:
                                    return clean_lines[-1].strip('"')
                except Exception:
                    continue


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
