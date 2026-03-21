"""Intuitionistic propositional logic: Kripke model checking.

A formula is intuitionistically valid iff it is forced at every world
of every finite Kripke model. We enumerate Kripke frames (finite posets)
up to a bounded size and all monotone valuations, checking the forcing
relation.

For formulas with ≤3 variables and depth ≤5, frames up to 5 worlds
suffice to find all counterexamples (by the finite model property of IPC).
"""

from itertools import product as cartesian_product
from formulas.ast_types import Formula, Var, Not, And, Or, Implies, Iff, get_variables

# Maximum number of worlds to enumerate. 5 is sufficient for formulas
# with up to 3 variables. Increase if needed (but runtime grows fast).
MAX_WORLDS = 5


def _generate_posets(n: int) -> list[list[set[int]]]:
    """Generate all partial orders on {0, ..., n-1}.

    Returns a list of adjacency-set representations where upsets[i]
    is the set of worlds j such that i <= j (the upset of i).
    Each poset is represented as a list of sets.
    """
    worlds = list(range(n))
    # Start with reflexive pairs, then try adding each (i, j) pair
    # and check transitivity.
    pairs = [(i, j) for i in worlds for j in worlds if i != j]

    results = []

    def _search(idx: int, relation: set[tuple[int, int]]):
        if idx == len(pairs):
            # Build upset representation
            upsets = [set() for _ in worlds]
            for i in worlds:
                upsets[i].add(i)  # reflexivity
                for j in worlds:
                    if (i, j) in relation:
                        upsets[i].add(j)
            results.append(upsets)
            return

        i, j = pairs[idx]

        # Option 1: don't include (i, j)
        # But check: is (i, j) forced by transitivity from existing relations?
        forced = False
        for k in worlds:
            if (i, k) in relation and (k, j) in relation:
                forced = True
                break
            if i == j:
                forced = True
                break

        if forced:
            # Must include it
            new_rel = relation | {(i, j)}
            # Add transitive consequences
            to_add = set()
            for a, b in relation:
                if b == i and (a, j) not in new_rel:
                    to_add.add((a, j))
                if a == j and (i, b) not in new_rel:
                    to_add.add((i, b))
            new_rel |= to_add
            # Keep adding transitive consequences until fixed point
            changed = True
            while changed:
                changed = False
                extra = set()
                for a, b in new_rel:
                    for c, d in new_rel:
                        if b == c and (a, d) not in new_rel and (a, d) not in extra:
                            extra.add((a, d))
                            changed = True
                new_rel |= extra
            # Check antisymmetry: if (i,j) and (j,i) both in relation, then i==j
            valid = True
            for a, b in new_rel:
                if a != b and (b, a) in new_rel:
                    valid = False
                    break
            if valid:
                _search(idx + 1, new_rel)
        else:
            # Option 1: skip (i, j)
            _search(idx + 1, relation)

            # Option 2: include (i, j), if antisymmetry allows
            if (j, i) not in relation:
                new_rel = relation | {(i, j)}
                # Transitive closure
                changed = True
                while changed:
                    changed = False
                    extra = set()
                    for a, b in new_rel:
                        for c, d in new_rel:
                            if b == c and (a, d) not in new_rel and (a, d) not in extra:
                                extra.add((a, d))
                                changed = True
                    new_rel |= extra
                # Check antisymmetry
                valid = True
                for a, b in new_rel:
                    if a != b and (b, a) in new_rel:
                        valid = False
                        break
                if valid:
                    _search(idx + 1, new_rel)

    _search(0, set())
    return results


# Cache posets by size
_poset_cache: dict[int, list[list[set[int]]]] = {}


def _get_posets(n: int) -> list[list[set[int]]]:
    if n not in _poset_cache:
        _poset_cache[n] = _generate_posets(n)
    return _poset_cache[n]


def _monotone_valuations(
    upsets: list[set[int]], variables: list[str]
) -> list[dict[int, set[str]]]:
    """Generate all monotone valuations for a Kripke frame.

    A valuation V is monotone if: w <= w' and p in V(w) implies p in V(w').
    """
    n = len(upsets)
    worlds = list(range(n))

    # For each variable, determine which subsets of worlds form an upset
    # (closed upward). A set S is an upset if w in S and w <= w' implies w' in S.
    def is_upset(s: set[int]) -> bool:
        for w in s:
            if not upsets[w].issubset(s | {w}):
                # All worlds >= w must be in s
                for w2 in upsets[w]:
                    if w2 not in s:
                        return False
        return True

    # Find all upsets of the poset
    all_upsets = []
    for bits in range(1 << n):
        s = {w for w in worlds if bits & (1 << w)}
        if is_upset(s):
            all_upsets.append(s)

    # A valuation assigns each variable to an upset
    valuations = []
    for combo in cartesian_product(all_upsets, repeat=len(variables)):
        val = {}
        for w in worlds:
            val[w] = set()
            for var_idx, var in enumerate(variables):
                if w in combo[var_idx]:
                    val[w].add(var)
        valuations.append(val)

    return valuations


def forces(
    formula: Formula,
    world: int,
    upsets: list[set[int]],
    valuation: dict[int, set[str]],
) -> bool:
    """Check if world forces formula in the given Kripke model.

    The forcing relation for intuitionistic propositional logic:
      w ||- p       iff p in V(w)
      w ||- A & B   iff w ||- A and w ||- B
      w ||- A | B   iff w ||- A or w ||- B
      w ||- A -> B  iff for all w' >= w, w' ||- A implies w' ||- B
      w ||- ~A      iff for all w' >= w, not w' ||- A
      w ||- A <-> B iff w ||- A -> B and w ||- B -> A
    """
    match formula:
        case Var(name):
            return name in valuation[world]
        case Not(operand):
            return all(
                not forces(operand, w2, upsets, valuation)
                for w2 in upsets[world]
            )
        case And(left, right):
            return forces(left, world, upsets, valuation) and forces(
                right, world, upsets, valuation
            )
        case Or(left, right):
            return forces(left, world, upsets, valuation) or forces(
                right, world, upsets, valuation
            )
        case Implies(left, right):
            return all(
                not forces(left, w2, upsets, valuation)
                or forces(right, w2, upsets, valuation)
                for w2 in upsets[world]
            )
        case Iff(left, right):
            return forces(
                Implies(left, right), world, upsets, valuation
            ) and forces(Implies(right, left), world, upsets, valuation)


def classify(formula: Formula, max_worlds: int = MAX_WORLDS) -> str:
    """Classify a formula in intuitionistic logic.

    Returns 'tautology', 'contradiction', or 'contingent'.

    A formula is:
    - 'tautology': forced at every world of every Kripke model (up to max_worlds)
    - 'contradiction': forced at no world of any Kripke model
    - 'contingent': otherwise
    """
    variables = sorted(get_variables(formula))
    ever_forced = False

    for n in range(1, max_worlds + 1):
        for upsets in _get_posets(n):
            for valuation in _monotone_valuations(upsets, variables):
                for world in range(n):
                    if forces(formula, world, upsets, valuation):
                        ever_forced = True
                    else:
                        # Found a countermodel — not a tautology.
                        # But is it a contradiction?
                        # A non-tautology that is ever forced is contingent.
                        if ever_forced:
                            return "contingent"
                        # Continue checking to see if it's ever forced
                        # We need to keep looking
                        # Actually, we know it fails somewhere. Check if forced anywhere.
                        # Optimise: check all worlds/models for any forcing
                        return _classify_non_tautology(formula, variables, max_worlds)

    # If we get here, it was forced everywhere
    if ever_forced:
        return "tautology"
    # Empty variable set, formula with no variables — should not happen normally
    return "tautology"


def _classify_non_tautology(formula: Formula, variables: list[str], max_worlds: int) -> str:
    """Given that the formula is not a tautology, determine if it's a contradiction or contingent."""
    for n in range(1, max_worlds + 1):
        for upsets in _get_posets(n):
            for valuation in _monotone_valuations(upsets, variables):
                for world in range(n):
                    if forces(formula, world, upsets, valuation):
                        return "contingent"
    return "contradiction"
