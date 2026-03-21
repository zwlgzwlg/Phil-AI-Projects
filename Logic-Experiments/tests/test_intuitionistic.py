"""Tests for the intuitionistic propositional logic prover."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from formulas.parser import parse
from provers.intuitionistic import classify


def test_intuitionistic_tautologies():
    """Formulas valid in intuitionistic logic."""
    tautologies = [
        "p -> p",                          # identity
        "p -> ~~p",                        # double negation introduction
        "(p -> q) -> (~q -> ~p)",          # contraposition (this direction)
        "p & ~p -> q",                     # ex falso
        "p & q -> p",                      # and elimination
        "p -> p | q",                      # or introduction
        "(p & q -> r) -> (p -> (q -> r))", # currying
        "(p -> (q -> r)) -> (p & q -> r)", # uncurrying
        "~~~p -> ~p",                      # triple negation
        "~~(p | ~p)",                      # double negation of LEM
    ]
    for formula_str in tautologies:
        f = parse(formula_str)
        result = classify(f)
        assert result == "tautology", f"{formula_str} should be intuitionistic tautology, got {result}"
        print(f"  OK tautology: {formula_str}")


def test_classical_only():
    """Formulas valid classically but NOT intuitionistically."""
    classical_only = [
        "p | ~p",               # excluded middle
        "~~p -> p",             # double negation elimination
        "((p -> q) -> p) -> p", # Peirce's law
        "~p | ~~p",            # weak excluded middle
        "(~q -> ~p) -> (p -> q)",  # reverse contraposition
    ]
    for formula_str in classical_only:
        f = parse(formula_str)
        result = classify(f)
        assert result == "contingent", f"{formula_str} should be intuitionistic contingent, got {result}"
        print(f"  OK contingent (classical-only tautology): {formula_str}")


def test_contradictions():
    """Contradictions are the same in both logics."""
    contradictions = [
        "p & ~p",
        "~(p -> p)",
    ]
    for formula_str in contradictions:
        f = parse(formula_str)
        result = classify(f)
        assert result == "contradiction", f"{formula_str} should be contradiction, got {result}"
        print(f"  OK contradiction: {formula_str}")


def test_contingent():
    """Contingent in both logics."""
    contingent = [
        "p",
        "p -> q",
        "(p -> q) -> (q -> p)",
    ]
    for formula_str in contingent:
        f = parse(formula_str)
        result = classify(f)
        assert result == "contingent", f"{formula_str} should be contingent, got {result}"
        print(f"  OK contingent: {formula_str}")


if __name__ == "__main__":
    print("Testing intuitionistic prover...")
    test_intuitionistic_tautologies()
    test_classical_only()
    test_contradictions()
    test_contingent()
    print("All intuitionistic tests passed!")
