"""Convert formula ASTs to various string representations."""

from .ast_types import Formula, Var, Not, And, Or, Implies, Iff


def _needs_parens(formula: Formula, parent: Formula, is_right: bool = False) -> bool:
    """Determine if a subformula needs parentheses given its parent."""
    precedence = {Var: 100, Not: 90, And: 70, Or: 60, Implies: 50, Iff: 40}
    p_child = precedence.get(type(formula), 0)
    p_parent = precedence.get(type(parent), 0)
    if p_child < p_parent:
        return True
    if p_child == p_parent:
        # Right-associative implies needs parens on left child at same precedence
        if isinstance(parent, Implies) and not is_right and isinstance(formula, Implies):
            return True
    return False


def to_symbolic(formula: Formula) -> str:
    """Convert to canonical symbolic string: ~, &, |, ->, <->."""
    match formula:
        case Var(name):
            return name
        case Not(operand):
            inner = to_symbolic(operand)
            if isinstance(operand, (And, Or, Implies, Iff)):
                return f"~({inner})"
            return f"~{inner}"
        case And(left, right):
            l = to_symbolic(left)
            r = to_symbolic(right)
            if _needs_parens(left, formula):
                l = f"({l})"
            if _needs_parens(right, formula, is_right=True):
                r = f"({r})"
            return f"{l} & {r}"
        case Or(left, right):
            l = to_symbolic(left)
            r = to_symbolic(right)
            if _needs_parens(left, formula):
                l = f"({l})"
            if _needs_parens(right, formula, is_right=True):
                r = f"({r})"
            return f"{l} | {r}"
        case Implies(left, right):
            l = to_symbolic(left)
            r = to_symbolic(right)
            if _needs_parens(left, formula):
                l = f"({l})"
            if _needs_parens(right, formula, is_right=True):
                r = f"({r})"
            return f"{l} -> {r}"
        case Iff(left, right):
            l = to_symbolic(left)
            r = to_symbolic(right)
            if _needs_parens(left, formula):
                l = f"({l})"
            if _needs_parens(right, formula, is_right=True):
                r = f"({r})"
            return f"{l} <-> {r}"


def to_natural(formula: Formula) -> str:
    """Convert to natural language style: NOT, AND, OR, IMPLIES, IFF."""
    match formula:
        case Var(name):
            return name
        case Not(operand):
            inner = to_natural(operand)
            if isinstance(operand, (And, Or, Implies, Iff)):
                return f"NOT ({inner})"
            return f"NOT {inner}"
        case And(left, right):
            l = to_natural(left)
            r = to_natural(right)
            if isinstance(left, (Or, Implies, Iff)):
                l = f"({l})"
            if isinstance(right, (Or, Implies, Iff)):
                r = f"({r})"
            return f"{l} AND {r}"
        case Or(left, right):
            l = to_natural(left)
            r = to_natural(right)
            if isinstance(left, (Implies, Iff)):
                l = f"({l})"
            if isinstance(right, (Implies, Iff)):
                r = f"({r})"
            return f"{l} OR {r}"
        case Implies(left, right):
            l = to_natural(left)
            r = to_natural(right)
            if isinstance(left, (Implies, Iff)):
                l = f"({l})"
            if isinstance(right, Iff):
                r = f"({r})"
            return f"{l} IMPLIES {r}"
        case Iff(left, right):
            l = to_natural(left)
            r = to_natural(right)
            if isinstance(left, Iff):
                l = f"({l})"
            if isinstance(right, Iff):
                r = f"({r})"
            return f"{l} IFF {r}"


def to_latex(formula: Formula) -> str:
    """Convert to LaTeX notation."""
    match formula:
        case Var(name):
            return name
        case Not(operand):
            inner = to_latex(operand)
            if isinstance(operand, (And, Or, Implies, Iff)):
                return rf"\lnot ({inner})"
            return rf"\lnot {inner}"
        case And(left, right):
            l = to_latex(left)
            r = to_latex(right)
            if isinstance(left, (Or, Implies, Iff)):
                l = f"({l})"
            if isinstance(right, (Or, Implies, Iff)):
                r = f"({r})"
            return rf"{l} \land {r}"
        case Or(left, right):
            l = to_latex(left)
            r = to_latex(right)
            if isinstance(left, (Implies, Iff)):
                l = f"({l})"
            if isinstance(right, (Implies, Iff)):
                r = f"({r})"
            return rf"{l} \lor {r}"
        case Implies(left, right):
            l = to_latex(left)
            r = to_latex(right)
            if isinstance(left, (Implies, Iff)):
                l = f"({l})"
            if isinstance(right, Iff):
                r = f"({r})"
            return rf"{l} \to {r}"
        case Iff(left, right):
            l = to_latex(left)
            r = to_latex(right)
            if isinstance(left, Iff):
                l = f"({l})"
            if isinstance(right, Iff):
                r = f"({r})"
            return rf"{l} \leftrightarrow {r}"
