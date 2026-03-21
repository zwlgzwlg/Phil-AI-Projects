"""Classical propositional logic: truth-table evaluation."""

from itertools import product
from formulas.ast_types import Formula, Var, Not, And, Or, Implies, Iff, get_variables


def evaluate(formula: Formula, assignment: dict[str, bool]) -> bool:
    """Evaluate a formula under a truth assignment."""
    match formula:
        case Var(name):
            return assignment[name]
        case Not(operand):
            return not evaluate(operand, assignment)
        case And(left, right):
            return evaluate(left, assignment) and evaluate(right, assignment)
        case Or(left, right):
            return evaluate(left, assignment) or evaluate(right, assignment)
        case Implies(left, right):
            return not evaluate(left, assignment) or evaluate(right, assignment)
        case Iff(left, right):
            return evaluate(left, assignment) == evaluate(right, assignment)


def classify(formula: Formula) -> str:
    """Classify a formula as 'tautology', 'contradiction', or 'contingent'."""
    variables = sorted(get_variables(formula))
    all_true = True
    all_false = True

    for values in product([False, True], repeat=len(variables)):
        assignment = dict(zip(variables, values))
        result = evaluate(formula, assignment)
        if result:
            all_false = False
        else:
            all_true = False
        if not all_true and not all_false:
            return "contingent"

    if all_true:
        return "tautology"
    return "contradiction"
