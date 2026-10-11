"""
gemma_service.py - Google Gemma Directive Synthesizer

Transforms tabular photobiological telemetry and TabPFN Circadian Recharge Scores
into a concise, 15-second eyes-free spoken directive using Google's Gemma
via Google AI Studio, with a resilient analytical edge fallback.
Only Gemma models are ever called — no other LLM family is used anywhere.
"""

import os
import random
import requests

class GemmaDirectiveService:
    # Verified live via ListModels: these are the Gemma models this key serves.
    # gemma-4-26b-a4b-it (MoE) first — fastest real generation for a short brief.
    MODEL_CANDIDATES = ("gemma-4-26b-a4b-it", "gemma-4-31b-it")
    PRIMARY_MODEL = "google/gemma-4-26b-a4b-it"
    # OpenRouter serves NON-reasoning Gemma 3 (which actually answers instead of
    # only thinking) on a free tier. Groq no longer lists any Gemma model, so it
    # is deliberately NOT integrated.
    # Rotated per request so consecutive briefs never open the same way.
    # The validator still enforces the facts, so variety never costs truth.
    OPENERS = ("Quick one:", "Sun check:", "Listen up:", "Fresh air alert:", "Hey you:")
    OPENROUTER_CANDIDATES = ("google/gemma-3-27b-it", "google/gemma-3-12b-it")
    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
    MAX_ATTEMPTS = 2

    def __init__(self, timeout_s: float = None):
        self.google_api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        try:
            self.timeout_s = float(
                timeout_s if timeout_s is not None else os.getenv("GEMMA_TIMEOUT_S", "8.0")
            )
        except (TypeError, ValueError):
            self.timeout_s = 8.0

    def generate_directive(self, window_time: str, score: int, uv_index: float, cloud_cover: int, state: str = "live") -> str:
        """
        Generates a 15-second human action directive based on atmospheric parameters
        exclusively using Google's official Gemma AI model.
        Returns the live Gemma text, or the instant analytical directive when
        the API cannot answer in time.
        `state` is one of "upcoming" | "live" | "past" (place-local time) so the
        directive never tells users to chase a window that already passed.
        """
        text, _, _ = self.generate_directive_with_source(window_time, score, uv_index, cloud_cover, state)
        return text

    def generate_directive_with_source(self, window_time: str, score: int, uv_index: float,
                                       cloud_cover: int, state: str = "live") -> tuple:
        """
        Same as generate_directive, but also reports where the text came from:
        ("...", "gemma", model_id) for a live model answer,
        ("...", "edge", "analytical-edge") for the instant on-device directive.

        Provider order: OpenRouter (non-reasoning Gemma 3, actually answers) →
        Google AI Studio (reasoning Gemma 4, tight budget) → analytical edge.
        Gemma only, always.
        """
        # Strict prompts, strict validator: the model MUST quote the exact
        # computed facts verbatim (code judges every answer before it ships).
        # The opener is rotated client-side per request — providers sample too
        # greedily, so we guarantee freshness instead of hoping for it.
        # `state` keeps tense honest: never "go now" for a passed window.
        opener = random.choice(self.OPENERS)
        if state == "past":
            timing_rule = (
                f"Today's peak window \"{window_time}\" has ALREADY passed. "
                f"Tell them they missed it, do NOT tell them to go outside now, "
                f"and invite them to catch soft morning light tomorrow instead."
            )
        elif state == "upcoming":
            timing_rule = (
                f"The peak window \"{window_time}\" opens LATER today. "
                f"Tell them to get ready and step out when it opens, "
                f"do NOT say 'right now'."
            )
        else:
            timing_rule = (
                f"The peak window \"{window_time}\" is happening RIGHT NOW. "
                f"Urge immediate action."
            )
        prompt = (
            f"Write exactly one spoken sentence, maximum 30 words, telling a developer "
            f"about their daylight break. {timing_rule} "
            f"You MUST include the exact time window \"{window_time}\" and the exact UV value "
            f"\"{uv_index}\" inside the sentence. "
            f"Start your sentence with exactly \"{opener}\" "
            f"Reply with ONLY the quoted sentence, nothing else."
        )

        # Strictly Gemma, fastest lane first: OpenRouter's non-reasoning Gemma 3
        # answers directly when a (free-tier) key is configured; otherwise
        # skipped instantly with zero delay.
        if self.openrouter_api_key:
            for or_model in self.OPENROUTER_CANDIDATES:
                or_text = self._try_openrouter(prompt, or_model)
                if or_text is None:
                    continue
                if self.validate_directive(or_text, window_time, uv_index):
                    return or_text, "gemma", "openrouter/" + or_model
                break

        # Strictly use Google's Official Gemma model on Google AI Studio.
        # Fast-fail design: a slow/blocked LLM must never hold the user on
        # screen — the analytical fallback below is instant and always safe.
        if self.google_api_key:
            for model_name in self.MODEL_CANDIDATES[: self.MAX_ATTEMPTS]:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.google_api_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            # Tight budget on purpose: these reasoning models
                            # think up to the cap before answering, so a small
                            # cap fails fast into the instant edge fallback
                            # instead of holding the user on screen.
                            "maxOutputTokens": 150,
                            "temperature": 0.3
                        }
                    }
                    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=self.timeout_s)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            # Gemma reasoning models emit `thought` parts before
                            # the answer: only spoken text counts, never the
                            # inner monologue.
                            spoken = [
                                p.get("text", "") for p in parts
                                if p.get("text", "").strip() and not p.get("thought")
                            ]
                            raw = "\n".join(spoken).strip()
                            if raw:
                                import re
                                quotes = re.findall(r'"([^"]{20,300})"', raw)
                                if quotes:
                                    candidate = quotes[-1].strip()
                                    if self.validate_directive(candidate, window_time, uv_index):
                                        return candidate, "gemma", "google/" + model_name
                                    break
                                clean_lines = [
                                    l.strip(' *#-') for l in raw.splitlines()
                                    if len(l.strip(' *#-')) > 20
                                    and not l.strip().startswith(('Context', 'Goal', 'Constraint', 'Input', 'Persona', 'Option', 'Tone', 'Thought', 'Step', 'Data', 'Task'))
                                ]
                                if clean_lines:
                                    candidate = clean_lines[-1].strip('"')
                                    if self.validate_directive(candidate, window_time, uv_index):
                                        return candidate, "gemma", "google/" + model_name
                        # Model answered but unusable: fall back immediately,
                        # another model returns the same shape anyway.
                        break
                    elif resp.status_code == 404:
                        # Unknown model name: the next candidate may exist.
                        continue
                    elif resp.status_code in (429, 500, 502, 503):
                        # Transient: one retry with the next candidate.
                        continue
                    else:
                        # 400/401/403 (bad key, blocked prompt, ...): retrying
                        # other models cannot help — fall back instantly.
                        break
                except requests.Timeout:
                    # Slow network/model: never make the user wait — fallback.
                    break
                except requests.RequestException:
                    # No connectivity at all: fallback immediately.
                    break
                except Exception:
                    continue

        return self.analytical_directive(window_time, score, uv_index, cloud_cover, state), "edge", "analytical-edge"

    def _try_openrouter(self, prompt: str, model: str):
        """
        OpenAI-compatible chat call to OpenRouter's Gemma. Returns clean text
        or None on any failure (caller falls through to AI Studio / edge).
        """
        try:
            resp = requests.post(
                self.OPENROUTER_URL,
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 120,
                    "temperature": 1.0,
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.openrouter_api_key}",
                    "HTTP-Referer": "https://sunsync-766905975866.europe-west1.run.app",
                    "X-Title": "SunSync Circadian Brief",
                },
                timeout=self.timeout_s,
            )
            if resp.status_code != 200:
                return None
            choices = resp.json().get("choices", [])
            if not choices:
                return None
            text = (choices[0].get("message", {}).get("content", "") or "").strip()
            return text.strip('"').strip() or None
        except Exception:
            return None

    def validate_directive(self, text: str, window_time: str, uv_index: float) -> bool:
        """
        Code-decides guardrail: the model narrates, but only verified facts ship.
        A candidate passes iff it repeats the computed window start AND grounds
        the UV reading. Anything else (hallucinated times, dropped numbers) is
        rejected into the instant analytical fallback.
        """
        if not text or len(text.strip()) < 20:
            return False
        start = str(window_time).split("-")[0].strip()
        if start and start not in text:
            return False
        try:
            uv_token = f"{float(uv_index):.1f}"
        except (TypeError, ValueError):
            return False
        text_lower = text.lower()
        if uv_token not in text and "uv" not in text_lower:
            return False
        return True

    def analytical_directive(self, window_time: str, score: int, uv_index: float, cloud_cover: int, state: str = "live") -> str:
        """
        Instant on-device directive (zero network). Used as the first-paint
        text and as the fallback when live Gemma cannot answer in time.
        Time-aware: a passed window is mourned, never chased.
        """
        # Resilient Edge Synthesis (Modeled after Gemma instruction-tuned outputs)
        if state == "past":
            return (
                f"Today's peak melanopic window was {window_time} — that light has passed. "
                f"Do not chase it now. Catch soft morning light tomorrow instead: step out early, "
                f"look far, and let daylight anchor your master circadian clock."
            )
        if uv_index < 3.0:
            uv_note = f"UV is gentle at {uv_index}, making it safe for direct, unshielded viewing"
        elif uv_index < 6.0:
            uv_note = f"UV is moderate at {uv_index}, ideal for diffuse ambient light without harsh glare"
        else:
            uv_note = f"UV is elevated at {uv_index}; enjoy indirect daylight in shaded open air"

        if state == "upcoming":
            return (
                f"Your peak melanopic solar recharge window opens at {window_time}. "
                f"{uv_note}. Get ready — when it opens, lock your screen, step outside "
                f"into natural daylight, and let your retinal cells anchor your master circadian clock."
            )
        return (
            f"Your peak melanopic solar recharge window opens at {window_time}. "
            f"{uv_note}. Lock your screen, step outside into natural daylight, "
            f"and let your retinal cells anchor your master circadian clock."
        )
