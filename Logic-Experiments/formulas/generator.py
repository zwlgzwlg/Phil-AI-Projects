"""Generate propositional logic formulas via templates and random construction."""

import random
from .ast_types import (
    Formula, Var, Not, And, Or, Implies, Iff,
    get_variables, depth as formula_depth,
)
from .printer import to_symbolic


# ── Template-based generation ───────────────────────────────────────────────

def _substitution_instances(
    template: Formula, var_pools: list[list[Formula]]
) -> list[Formula]:
    """Generate substitution instances of a template.

    Replace variables in the template with formulas from var_pools.
    """
    vars_in_template = sorted(get_variables(template))
    results = []
    # Generate one instance per pool entry
    for pool in var_pools:
        mapping = {}
        for i, v in enumerate(vars_in_template):
            mapping[v] = pool[i % len(pool)]
        results.append(_substitute(template, mapping))
    return results


def _substitute(formula: Formula, mapping: dict[str, Formula]) -> Formula:
    match formula:
        case Var(name):
            return mapping.get(name, formula)
        case Not(operand):
            return Not(_substitute(operand, mapping))
        case And(left, right):
            return And(_substitute(left, mapping), _substitute(right, mapping))
        case Or(left, right):
            return Or(_substitute(left, mapping), _substitute(right, mapping))
        case Implies(left, right):
            return Implies(_substitute(left, mapping), _substitute(right, mapping))
        case Iff(left, right):
            return Iff(_substitute(left, mapping), _substitute(right, mapping))


def generate_templates() -> list[Formula]:
    """Generate formulas from structural templates.

    These explore interesting logical patterns: distribution,
    contraposition variants, import-export, etc.
    """
    p, q, r = Var("p"), Var("q"), Var("r")
    templates = []

    # Distribution variants
    templates.append(And(p, Or(q, r)))                          # p & (q | r)
    templates.append(Or(And(p, q), And(p, r)))                  # (p & q) | (p & r)
    templates.append(Or(p, And(q, r)))                          # p | (q & r)
    templates.append(And(Or(p, q), Or(p, r)))                   # (p | q) & (p | r)

    # Biconditional distribution equivalences (as formulas to classify)
    templates.append(Iff(And(p, Or(q, r)), Or(And(p, q), And(p, r))))
    templates.append(Iff(Or(p, And(q, r)), And(Or(p, q), Or(p, r))))

    # Contraposition variants
    templates.append(Implies(Implies(p, q), Implies(Not(q), Not(p))))  # valid both
    templates.append(Implies(Implies(Not(q), Not(p)), Implies(p, q)))  # classical only
    templates.append(Implies(Implies(Not(p), Not(q)), Implies(q, p)))  # classical only
    templates.append(Implies(Implies(p, Not(q)), Implies(q, Not(p))))  # valid both

    # Import-export
    templates.append(Iff(Implies(And(p, q), r), Implies(p, Implies(q, r))))

    # Absorption
    templates.append(Iff(Or(p, And(p, q)), p))
    templates.append(Iff(And(p, Or(p, q)), p))

    # De Morgan variants
    templates.append(Iff(Not(And(p, q)), Or(Not(p), Not(q))))   # classical only (one dir)
    templates.append(Iff(Not(Or(p, q)), And(Not(p), Not(q))))   # valid both
    templates.append(Implies(Not(Or(p, q)), And(Not(p), Not(q))))  # valid both
    templates.append(Implies(And(Not(p), Not(q)), Not(Or(p, q))))  # valid both
    templates.append(Implies(Or(Not(p), Not(q)), Not(And(p, q))))  # valid both
    templates.append(Implies(Not(And(p, q)), Or(Not(p), Not(q))))  # classical only

    # Negation patterns
    templates.append(Implies(Not(Not(p)), p))                    # DNE — classical only
    templates.append(Implies(p, Not(Not(p))))                    # DN intro — valid both
    templates.append(Iff(Not(Not(Not(p))), Not(p)))              # triple neg — valid both

    # Modus tollens
    templates.append(Implies(And(Implies(p, q), Not(q)), Not(p)))

    # Constructive dilemma
    templates.append(Implies(
        And(Implies(p, q), Implies(r, q)),
        Implies(Or(p, r), q)
    ))

    # Peirce variants
    templates.append(Implies(Implies(Implies(p, q), p), p))  # Peirce
    templates.append(Implies(Implies(Implies(p, q), q), q))  # not Peirce

    # Excluded middle variants
    templates.append(Or(p, Not(p)))
    templates.append(Or(Not(p), Not(Not(p))))                   # weak EM
    templates.append(Or(Implies(p, q), Implies(q, p)))          # linearity

    # Mixed connective interactions
    templates.append(Implies(Implies(p, Implies(q, r)), Implies(And(p, q), r)))
    templates.append(Implies(Implies(And(p, q), r), Implies(p, Implies(q, r))))
    templates.append(Iff(Implies(p, And(q, r)), And(Implies(p, q), Implies(p, r))))
    templates.append(Implies(Or(Implies(p, q), Implies(p, r)), Implies(p, Or(q, r))))
    templates.append(Implies(Implies(p, Or(q, r)), Or(Implies(p, q), Implies(p, r))))  # classical only

    return templates


# ── Random generation ───────────────────────────────────────────────────────

def random_formula(
    variables: list[str],
    max_depth: int = 4,
    rng: random.Random | None = None,
) -> Formula:
    """Generate a random formula with bounded depth."""
    if rng is None:
        rng = random.Random()

    def _gen(d: int) -> Formula:
        if d <= 0 or (d < max_depth and rng.random() < 0.3):
            return Var(rng.choice(variables))

        connective = rng.choice(["not", "and", "or", "implies", "iff"])
        if connective == "not":
            return Not(_gen(d - 1))
        elif connective == "and":
            return And(_gen(d - 1), _gen(d - 1))
        elif connective == "or":
            return Or(_gen(d - 1), _gen(d - 1))
        elif connective == "implies":
            return Implies(_gen(d - 1), _gen(d - 1))
        else:
            return Iff(_gen(d - 1), _gen(d - 1))

    return _gen(max_depth)


def generate_random(
    count: int = 200,
    variables: list[str] | None = None,
    max_depth: int = 4,
    seed: int = 42,
) -> list[Formula]:
    """Generate random formulas, deduplicated by canonical string."""
    if variables is None:
        variables = ["p", "q", "r"]

    rng = random.Random(seed)
    seen = set()
    results = []

    attempts = 0
    while len(results) < count and attempts < count * 20:
        attempts += 1
        f = random_formula(variables, max_depth=max_depth, rng=rng)
        canonical = to_symbolic(f)
        d = formula_depth(f)
        # Filter: depth >= 2, not too deep, reasonable size
        if d < 2 or d > 5 or len(canonical) > 80:
            continue
        if canonical in seen:
            continue
        seen.add(canonical)
        results.append(f)

    return results
