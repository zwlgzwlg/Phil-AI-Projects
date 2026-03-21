#!/usr/bin/env python3
"""Generate the verified sentence bank.

Collects formulas from hand-curated cases, templates, and random generation,
verifies them with both classical and intuitionistic provers, and outputs
a JSON bank.
"""

import json
import sys
import os
from datetime import datetime, timezone

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from formulas.ast_types import get_variables, depth, connectives_used
from formulas.parser import parse
from formulas.printer import to_symbolic, to_natural, to_latex
from formulas.known_hard_cases import get_all_cases
from formulas.generator import generate_templates, generate_random
from provers import classical, intuitionistic


def classify_formula(formula):
    """Classify a formula in both classical and intuitionistic logic."""
    cl = classical.classify(formula)
    # Optimisation: classical contradictions are always intuitionistic contradictions
    if cl == "contradiction":
        return cl, "contradiction"
    il = intuitionistic.classify(formula)
    return cl, il


def build_bank():
    sentences = []
    seen_canonical = set()
    idx = 0

    def add(formula, source, source_name="", notes="", expected_category=""):
        nonlocal idx
        canonical = to_symbolic(formula)
        if canonical in seen_canonical:
            return
        seen_canonical.add(canonical)

        cl, il = classify_formula(formula)

        # Flag if classification doesn't match expected category
        warnings = []
        if expected_category == "tautology_both":
            if cl != "tautology":
                warnings.append(f"Expected classical tautology, got {cl}")
            if il != "tautology":
                warnings.append(f"Expected intuitionistic tautology, got {il}")
        elif expected_category == "tautology_classical_only":
            if cl != "tautology":
                warnings.append(f"Expected classical tautology, got {cl}")
            if il == "tautology":
                warnings.append(f"Expected intuitionistic non-tautology, got tautology")
        elif expected_category == "contradiction":
            if cl != "contradiction":
                warnings.append(f"Expected contradiction, got classical={cl}")
        elif expected_category == "contingent_both":
            if cl != "contingent":
                warnings.append(f"Expected classical contingent, got {cl}")

        if warnings:
            for w in warnings:
                print(f"  WARNING [{source_name or canonical}]: {w}")

        entry = {
            "id": f"{source[:2].upper()}-{idx:03d}",
            "formula": canonical,
            "formula_natural": to_natural(formula),
            "formula_latex": to_latex(formula),
            "variables": sorted(get_variables(formula)),
            "depth": depth(formula),
            "connectives": sorted(connectives_used(formula)),
            "source": source,
            "source_name": source_name,
            "classical": cl,
            "intuitionistic": il,
            "notes": notes,
        }
        sentences.append(entry)
        idx += 1

    # 1. Hand-curated cases
    print("Processing hand-curated cases...")
    for name, formula_str, category, notes in get_all_cases():
        try:
            formula = parse(formula_str)
            add(formula, "hand_curated", name, notes, category)
        except Exception as e:
            print(f"  ERROR parsing {name}: {e}")

    print(f"  Added {len(sentences)} hand-curated formulas")

    # 2. Template-based
    print("Processing templates...")
    before = len(sentences)
    for i, formula in enumerate(generate_templates()):
        add(formula, "template", f"template_{i}")
    print(f"  Added {len(sentences) - before} template formulas")

    # 3. Random
    print("Processing random formulas...")
    before = len(sentences)
    for formula in generate_random(count=100, seed=42):
        add(formula, "random")
    print(f"  Added {len(sentences) - before} random formulas")

    # Summary
    print(f"\nTotal: {len(sentences)} formulas")
    cl_taut = sum(1 for s in sentences if s["classical"] == "tautology")
    cl_cont = sum(1 for s in sentences if s["classical"] == "contingent")
    cl_contr = sum(1 for s in sentences if s["classical"] == "contradiction")
    il_taut = sum(1 for s in sentences if s["intuitionistic"] == "tautology")
    il_cont = sum(1 for s in sentences if s["intuitionistic"] == "contingent")
    il_contr = sum(1 for s in sentences if s["intuitionistic"] == "contradiction")
    interesting = sum(
        1 for s in sentences
        if s["classical"] == "tautology" and s["intuitionistic"] == "contingent"
    )

    print(f"Classical:      {cl_taut} tautologies, {cl_cont} contingent, {cl_contr} contradictions")
    print(f"Intuitionistic: {il_taut} tautologies, {il_cont} contingent, {il_contr} contradictions")
    print(f"Classically valid but intuitionistically contingent: {interesting}")

    bank = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_count": len(sentences),
            "max_kripke_worlds": intuitionistic.MAX_WORLDS,
            "summary": {
                "classical": {"tautology": cl_taut, "contingent": cl_cont, "contradiction": cl_contr},
                "intuitionistic": {"tautology": il_taut, "contingent": il_cont, "contradiction": il_contr},
                "classically_valid_intuitionistically_contingent": interesting,
            },
        },
        "sentences": sentences,
    }

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentence_bank.json")
    with open(output_path, "w") as f:
        json.dump(bank, f, indent=2)
    print(f"\nBank written to {output_path}")


if __name__ == "__main__":
    build_bank()
