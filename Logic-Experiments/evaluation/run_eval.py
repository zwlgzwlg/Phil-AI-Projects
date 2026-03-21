#!/usr/bin/env python3
"""Run AI evaluation on the sentence bank.

Sends each formula to AI APIs (Claude and/or OpenAI) and collects
classifications. Supports both one-word and reasoning prompt styles.

Usage:
    python evaluation/run_eval.py [--bank PATH] [--models MODEL,...] [--styles STYLE,...] [--logics LOGIC,...] [--output DIR] [--limit N]

Environment variables:
    ANTHROPIC_API_KEY  - Required for Claude models
    OPENAI_API_KEY     - Required for OpenAI models
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evaluation.prompts import make_prompt

# Rate limiting: requests per minute per provider
RATE_LIMITS = {
    "anthropic": 50,
    "openai": 50,
}


def parse_classification(response_text: str, style: str) -> str | None:
    """Extract classification from an AI response.

    Returns 'tautology', 'contradiction', 'contingent', 'undetermined', or None if unparseable.
    """
    VALID = ("tautology", "contradiction", "contingent", "undetermined")
    text = response_text.strip().lower()

    if style == "one_word":
        # Try exact match first
        if text in VALID:
            return text
        # Try to find the word in the response
        for word in VALID:
            if word in text:
                return word
        return None

    # Reasoning style — look for "Classification: X" at the end
    match = re.search(r"classification:\s*(tautology|contradiction|contingent|undetermined)", text)
    if match:
        return match.group(1)

    # Fallback: look for the last occurrence of any classification word
    last_pos = -1
    result = None
    for word in VALID:
        pos = text.rfind(word)
        if pos > last_pos:
            last_pos = pos
            result = word
    return result


async def call_anthropic(prompt: str, model: str) -> str:
    """Call the Anthropic API."""
    import anthropic
    client = anthropic.AsyncAnthropic()
    message = await client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def call_openai(prompt: str, model: str) -> str:
    """Call the OpenAI API."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI()
    response = await client.chat.completions.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


# Model registry: name -> (provider, api_model_id)
MODEL_REGISTRY = {
    "claude-sonnet": ("anthropic", "claude-sonnet-4-20250514"),
    "claude-haiku": ("anthropic", "claude-haiku-4-5-20251001"),
    "gpt-4o": ("openai", "gpt-4o"),
    "gpt-4o-mini": ("openai", "gpt-4o-mini"),
    "o3-mini": ("openai", "o3-mini"),
}


async def evaluate_single(
    sentence: dict,
    model_name: str,
    logic: str,
    style: str,
    semaphore: asyncio.Semaphore,
) -> dict:
    """Evaluate a single formula with a single model/logic/style combination."""
    provider, api_model = MODEL_REGISTRY[model_name]
    prompt = make_prompt(sentence["formula_natural"], logic, style)

    async with semaphore:
        try:
            if provider == "anthropic":
                raw_response = await call_anthropic(prompt, api_model)
            else:
                raw_response = await call_openai(prompt, api_model)
        except Exception as e:
            return {
                "sentence_id": sentence["id"],
                "formula": sentence["formula"],
                "model": model_name,
                "logic": logic,
                "style": style,
                "prompt": prompt,
                "raw_response": None,
                "parsed": None,
                "ground_truth": sentence[logic],
                "correct": None,
                "error": str(e),
            }

    parsed = parse_classification(raw_response, style)
    ground_truth = sentence[logic]

    return {
        "sentence_id": sentence["id"],
        "formula": sentence["formula"],
        "model": model_name,
        "logic": logic,
        "style": style,
        "prompt": prompt,
        "raw_response": raw_response,
        "parsed": parsed,
        "ground_truth": ground_truth,
        "correct": parsed == ground_truth if parsed else None,
        "error": None,
    }


async def run_evaluation(
    bank_path: str,
    model_names: list[str],
    styles: list[str],
    logics: list[str],
    output_dir: str,
    limit: int | None = None,
):
    """Run the full evaluation."""
    with open(bank_path) as f:
        bank = json.load(f)

    sentences = bank["sentences"]
    if limit:
        sentences = sentences[:limit]

    print(f"Evaluating {len(sentences)} formulas")
    print(f"Models: {model_names}")
    print(f"Styles: {styles}")
    print(f"Logics: {logics}")
    total = len(sentences) * len(model_names) * len(styles) * len(logics)
    print(f"Total API calls: {total}")

    # Semaphore per provider for rate limiting
    semaphores = {}
    for model_name in model_names:
        provider, _ = MODEL_REGISTRY[model_name]
        if provider not in semaphores:
            semaphores[provider] = asyncio.Semaphore(RATE_LIMITS[provider])

    tasks = []
    for sentence in sentences:
        for model_name in model_names:
            provider, _ = MODEL_REGISTRY[model_name]
            for logic in logics:
                for style in styles:
                    tasks.append(
                        evaluate_single(
                            sentence, model_name, logic, style,
                            semaphores[provider],
                        )
                    )

    print(f"\nRunning {len(tasks)} evaluations...")
    results = []
    done = 0
    for coro in asyncio.as_completed(tasks):
        result = await coro
        results.append(result)
        done += 1
        if done % 10 == 0:
            print(f"  {done}/{len(tasks)} complete")

    # Save results
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(output_dir, f"eval_{timestamp}.json")

    output = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bank_path": bank_path,
            "models": model_names,
            "styles": styles,
            "logics": logics,
            "total_sentences": len(sentences),
            "total_evaluations": len(results),
        },
        "results": results,
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nResults written to {output_path}")

    # Quick summary
    correct = sum(1 for r in results if r["correct"] is True)
    incorrect = sum(1 for r in results if r["correct"] is False)
    errors = sum(1 for r in results if r["error"])
    unparsed = sum(1 for r in results if r["parsed"] is None and r["error"] is None)
    print(f"Correct: {correct}, Incorrect: {incorrect}, Errors: {errors}, Unparsed: {unparsed}")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Run AI evaluation on sentence bank")
    parser.add_argument(
        "--bank",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bank", "sentence_bank.json"),
        help="Path to sentence bank JSON",
    )
    parser.add_argument(
        "--models",
        default="claude-sonnet,gpt-4o-mini",
        help="Comma-separated model names",
    )
    parser.add_argument(
        "--styles",
        default="one_word,reasoning",
        help="Comma-separated prompt styles",
    )
    parser.add_argument(
        "--logics",
        default="classical,intuitionistic",
        help="Comma-separated logic types",
    )
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "results"),
        help="Output directory",
    )
    parser.add_argument("--limit", type=int, help="Limit number of sentences")
    args = parser.parse_args()

    models = [m.strip() for m in args.models.split(",")]
    styles = [s.strip() for s in args.styles.split(",")]
    logics = [l.strip() for l in args.logics.split(",")]

    for model in models:
        if model not in MODEL_REGISTRY:
            print(f"Unknown model: {model}. Available: {list(MODEL_REGISTRY.keys())}")
            sys.exit(1)

    asyncio.run(run_evaluation(args.bank, models, styles, logics, args.output, args.limit))


if __name__ == "__main__":
    main()
