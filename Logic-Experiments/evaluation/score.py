#!/usr/bin/env python3
"""Score AI evaluation results against ground truth.

Usage:
    python evaluation/score.py [RESULTS_JSON]

If no argument given, uses the most recent results file in evaluation/results/.
"""

import json
import os
import sys
from collections import defaultdict


def load_results(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def score(data: dict) -> dict:
    """Compute detailed scores from evaluation results."""
    results = data["results"]

    # Filter out errors and unparsed
    valid = [r for r in results if r["parsed"] is not None and r["error"] is None]
    errors = [r for r in results if r["error"] is not None]
    unparsed = [r for r in results if r["parsed"] is None and r["error"] is None]
    undetermined = [r for r in valid if r["parsed"] == "undetermined"]

    # Overall accuracy (undetermined counts as incorrect)
    correct = sum(1 for r in valid if r["correct"])
    total = len(valid)

    # Breakdown by model
    by_model = defaultdict(lambda: {"correct": 0, "total": 0})
    for r in valid:
        by_model[r["model"]]["total"] += 1
        if r["correct"]:
            by_model[r["model"]]["correct"] += 1

    # Breakdown by logic
    by_logic = defaultdict(lambda: {"correct": 0, "total": 0})
    for r in valid:
        by_logic[r["logic"]]["total"] += 1
        if r["correct"]:
            by_logic[r["logic"]]["correct"] += 1

    # Breakdown by style
    by_style = defaultdict(lambda: {"correct": 0, "total": 0})
    for r in valid:
        by_style[r["style"]]["total"] += 1
        if r["correct"]:
            by_style[r["style"]]["correct"] += 1

    # Breakdown by model x logic
    by_model_logic = defaultdict(lambda: {"correct": 0, "total": 0})
    for r in valid:
        key = f"{r['model']} / {r['logic']}"
        by_model_logic[key]["total"] += 1
        if r["correct"]:
            by_model_logic[key]["correct"] += 1

    # Breakdown by model x logic x style
    by_model_logic_style = defaultdict(lambda: {"correct": 0, "total": 0})
    for r in valid:
        key = f"{r['model']} / {r['logic']} / {r['style']}"
        by_model_logic_style[key]["total"] += 1
        if r["correct"]:
            by_model_logic_style[key]["correct"] += 1

    # Confusion matrix per model x logic
    confusion = defaultdict(lambda: defaultdict(int))
    for r in valid:
        key = f"{r['model']} / {r['logic']}"
        confusion[key][(r["ground_truth"], r["parsed"])] += 1

    # Special: classically valid but intuitionistically contingent
    interesting = [
        r for r in valid
        if r["logic"] == "intuitionistic" and r["ground_truth"] == "contingent"
    ]
    # Check if these same formulas are tautologies classically
    # (We can't tell from individual results, but ground_truth for intuitionistic
    # being contingent while the formula is classically a tautology is the key case)
    interesting_correct = sum(1 for r in interesting if r["correct"])
    interesting_total = len(interesting)

    # Breakdown by ground truth category
    by_ground_truth = defaultdict(lambda: {"correct": 0, "total": 0})
    for r in valid:
        key = f"{r['logic']}/{r['ground_truth']}"
        by_ground_truth[key]["total"] += 1
        if r["correct"]:
            by_ground_truth[key]["correct"] += 1

    def acc(d):
        return d["correct"] / d["total"] if d["total"] > 0 else 0

    report = {
        "overall": {
            "correct": correct,
            "total": total,
            "accuracy": acc({"correct": correct, "total": total}),
            "errors": len(errors),
            "unparsed": len(unparsed),
            "undetermined": len(undetermined),
        },
        "by_model": {k: {**v, "accuracy": acc(v)} for k, v in sorted(by_model.items())},
        "by_logic": {k: {**v, "accuracy": acc(v)} for k, v in sorted(by_logic.items())},
        "by_style": {k: {**v, "accuracy": acc(v)} for k, v in sorted(by_style.items())},
        "by_model_logic": {k: {**v, "accuracy": acc(v)} for k, v in sorted(by_model_logic.items())},
        "by_model_logic_style": {k: {**v, "accuracy": acc(v)} for k, v in sorted(by_model_logic_style.items())},
        "intuitionistic_contingent": {
            "correct": interesting_correct,
            "total": interesting_total,
            "accuracy": acc({"correct": interesting_correct, "total": interesting_total}),
            "note": "Accuracy on formulas that are contingent in intuitionistic logic (many of which are classically valid)",
        },
        "by_ground_truth": {k: {**v, "accuracy": acc(v)} for k, v in sorted(by_ground_truth.items())},
        "confusion_matrices": {
            key: {f"{gt}->{pred}": count for (gt, pred), count in sorted(matrix.items())}
            for key, matrix in sorted(confusion.items())
        },
    }

    return report


def print_report(report: dict):
    """Pretty-print the scoring report."""
    print("=" * 60)
    print("EVALUATION REPORT")
    print("=" * 60)

    o = report["overall"]
    print(f"\nOverall: {o['correct']}/{o['total']} = {o['accuracy']:.1%}")
    print(f"Errors: {o['errors']}, Unparsed: {o['unparsed']}, Undetermined: {o['undetermined']}")

    print("\n── By Model ──")
    for k, v in report["by_model"].items():
        print(f"  {k:20s} {v['correct']:4d}/{v['total']:4d} = {v['accuracy']:.1%}")

    print("\n── By Logic ──")
    for k, v in report["by_logic"].items():
        print(f"  {k:20s} {v['correct']:4d}/{v['total']:4d} = {v['accuracy']:.1%}")

    print("\n── By Style ──")
    for k, v in report["by_style"].items():
        print(f"  {k:20s} {v['correct']:4d}/{v['total']:4d} = {v['accuracy']:.1%}")

    print("\n── By Model x Logic ──")
    for k, v in report["by_model_logic"].items():
        print(f"  {k:35s} {v['correct']:4d}/{v['total']:4d} = {v['accuracy']:.1%}")

    print("\n── By Model x Logic x Style ──")
    for k, v in report["by_model_logic_style"].items():
        print(f"  {k:50s} {v['correct']:4d}/{v['total']:4d} = {v['accuracy']:.1%}")

    ic = report["intuitionistic_contingent"]
    print(f"\n── Intuitionistic Contingent (key category) ──")
    print(f"  {ic['correct']}/{ic['total']} = {ic['accuracy']:.1%}")
    print(f"  {ic['note']}")

    print("\n── By Ground Truth Category ──")
    for k, v in report["by_ground_truth"].items():
        print(f"  {k:30s} {v['correct']:4d}/{v['total']:4d} = {v['accuracy']:.1%}")

    print("\n── Confusion Matrices ──")
    for key, matrix in report["confusion_matrices"].items():
        print(f"\n  {key}:")
        for transition, count in matrix.items():
            print(f"    {transition}: {count}")


def generate_latex_table(report: dict) -> str:
    """Generate a LaTeX table from the report."""
    lines = [
        r"\begin{table}[h]",
        r"\centering",
        r"\begin{tabular}{llrrr}",
        r"\toprule",
        r"Model & Logic & Correct & Total & Accuracy \\",
        r"\midrule",
    ]
    for k, v in report["by_model_logic"].items():
        model, logic = k.split(" / ")
        lines.append(
            f"  {model} & {logic} & {v['correct']} & {v['total']} & {v['accuracy']:.1%} \\\\"
        )
    lines.extend([
        r"\bottomrule",
        r"\end{tabular}",
        r"\caption{AI classification accuracy by model and logic type}",
        r"\label{tab:logic-eval}",
        r"\end{table}",
    ])
    return "\n".join(lines)


def main():
    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
        if not os.path.exists(results_dir):
            print("No results directory found. Run run_eval.py first.")
            sys.exit(1)
        files = sorted(f for f in os.listdir(results_dir) if f.endswith(".json"))
        if not files:
            print("No results files found. Run run_eval.py first.")
            sys.exit(1)
        path = os.path.join(results_dir, files[-1])
        print(f"Using most recent results: {path}")

    data = load_results(path)
    report = score(data)
    print_report(report)

    # Save report JSON
    report_path = path.replace(".json", "_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to {report_path}")

    # Save LaTeX table
    latex = generate_latex_table(report)
    latex_path = path.replace(".json", "_table.tex")
    with open(latex_path, "w") as f:
        f.write(latex)
    print(f"LaTeX table saved to {latex_path}")


if __name__ == "__main__":
    main()
