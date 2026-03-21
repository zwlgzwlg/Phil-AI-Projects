"""Tests for the classical propositional logic prover."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from formulas.parser import parse
from provers.classical import classify, evaluate


def test_tautologies():
    tautologies = [
        "p | ~p",               # excluded middle
        "p -> p",               # identity
        "~~p -> p",             # double negation elimination
        "p & q -> p",           # and elimination
        "p -> p | q",           # or introduction
        "(p -> q) -> (~q -> ~p)",  # contraposition
        "((p -> q) -> p) -> p",    # Peirce's law
        "(p & q -> r) -> (p -> (q -> r))",  # currying
    ]
    for formula_str in tautologies:
        f = parse(formula_str)
        result = classify(f)
        assert result == "tautology", f"{formula_str} should be tautology, got {result}"
        print(f"  OK tautology: {formula_str}")


def test_contradictions():
    contradictions = [
        "p & ~p",
        "~(p -> p)",
        "p <-> ~p",
    ]
    for formula_str in contradictions:
        f = parse(formula_str)
        result = classify(f)
        assert result == "contradiction", f"{formula_str} should be contradiction, got {result}"
        print(f"  OK contradiction: {formula_str}")


def test_contingent():
    contingent = [
        "p",
        "p -> q",
        "p & q",
        "p | q",
        "(p -> q) -> (q -> p)",  # converse is not a tautology
    ]
    for formula_str in contingent:
        f = parse(formula_str)
        result = classify(f)
        assert result == "contingent", f"{formula_str} should be contingent, got {result}"
        print(f"  OK contingent: {formula_str}")


def test_evaluate():
    f = parse("p & q -> p | r")
    assert evaluate(f, {"p": True, "q": True, "r": False}) == True
    assert evaluate(f, {"p": False, "q": True, "r": False}) == True
    assert evaluate(f, {"p": True, "q": False, "r": True}) == True
    print("  OK evaluate")


if __name__ == "__main__":
    print("Testing classical prover...")
    test_tautologies()
    test_contradictions()
    test_contingent()
    test_evaluate()
    print("All classical tests passed!")
