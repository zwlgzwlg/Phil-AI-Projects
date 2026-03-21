"""Hand-curated formulas for testing AI classification.

Organised by expected classification in classical and intuitionistic logic.
Each entry: (name, formula_string, notes).

The most interesting cases are classically valid but intuitionistically
unprovable — these are where we expect AI models to struggle.
"""

# ── Classically valid AND intuitionistically valid ──────────────────────────
# These should be "tautology" in both logics.
BOTH_TAUTOLOGIES = [
    ("modus_ponens_taut", "(p -> q) -> (p -> q)", "Trivial identity"),
    ("explosion", "p & ~p -> q", "Ex falso quodlibet — valid intuitionistically"),
    ("double_neg_intro", "p -> ~~p", "Double negation introduction — intuitionistically valid"),
    ("contraposition_forward", "(p -> q) -> (~q -> ~p)", "Contraposition — valid both ways only classically, but this direction is intuitionistic"),
    ("identity", "p -> p", "Identity"),
    ("and_elim_left", "p & q -> p", "Conjunction elimination"),
    ("and_elim_right", "p & q -> q", "Conjunction elimination"),
    ("or_intro_left", "p -> p | q", "Disjunction introduction"),
    ("or_intro_right", "q -> p | q", "Disjunction introduction"),
    ("hypothetical_syllogism", "(p -> q) -> ((q -> r) -> (p -> r))", "Transitivity of implication"),
    ("and_intro", "p -> (q -> p & q)", "Conjunction introduction"),
    ("disjunctive_syllogism_neg", "p & ~p -> q", "From contradiction, anything"),
    ("currying", "(p & q -> r) -> (p -> (q -> r))", "Currying — intuitionistically valid"),
    ("uncurrying", "(p -> (q -> r)) -> (p & q -> r)", "Uncurrying — intuitionistically valid"),
    ("neg_intro", "(p -> q) -> ((p -> ~q) -> ~p)", "Negation introduction"),
    ("triple_neg", "~~~p -> ~p", "Triple negation reduces to single"),
    ("contraposition_neg", "(p -> ~q) -> (q -> ~p)", "Contraposition with negation target"),
    ("or_distrib", "p & (q | r) -> (p & q) | (p & r)", "Distribution AND over OR"),
    ("or_distrib_rev", "(p & q) | (p & r) -> p & (q | r)", "Reverse distribution"),
    ("de_morgan_and", "~p | ~q -> ~(p & q)", "De Morgan (this direction) — intuitionistically valid"),
    ("imp_reflexive", "p -> p", "Reflexivity of implication"),
    ("or_elim_scheme", "(p -> r) -> ((q -> r) -> (p | q -> r))", "Disjunction elimination"),
]

# ── Classically valid but intuitionistically UNPROVABLE ─────────────────────
# These should be "tautology" classically, "contingent" intuitionistically.
# This is the KEY category for the experiment.
CLASSICAL_ONLY_TAUTOLOGIES = [
    ("excluded_middle", "p | ~p", "Law of excluded middle"),
    ("double_neg_elim", "~~p -> p", "Double negation elimination"),
    ("peirce", "((p -> q) -> p) -> p", "Peirce's law"),
    ("weak_excluded_middle", "~p | ~~p", "Weak law of excluded middle"),
    ("de_morgan_to_or", "~(p & q) -> ~p | ~q", "De Morgan — this direction fails intuitionistically"),
    ("linearity", "(p -> q) | (q -> p)", "Dummett's linearity axiom (LC)"),
    ("contraposition_reverse", "(~q -> ~p) -> (p -> q)", "Reverse contraposition"),
    ("material_implication", "(p -> q) | (q -> r)", "Generalised linearity"),
    ("consequentia_mirabilis", "(~p -> p) -> p", "Consequentia mirabilis / Clavius' law"),
    ("lem_substituted_and", "(p & q) | ~(p & q)", "LEM with compound formula"),
    ("lem_substituted_impl", "(p -> q) | ~(p -> q)", "LEM with implication"),
    ("dne_substituted", "~~(p | q) -> (p | q)", "DNE with compound formula"),
    ("or_not_and", "~(~p & ~q) -> p | q", "Double negated De Morgan"),
    ("impl_as_disj", "(p -> q) -> (~p | q)", "Implication as disjunction — fails intuitionistically"),
    ("material_equiv", "(p -> q) -> (~p | q)", "Material conditional — same as above"),
    ("excluded_middle_q", "q | ~q", "LEM with different variable"),
    ("dne_impl", "~~(p -> q) -> (p -> q)", "DNE for implications"),
    ("classical_contraposition", "(~p -> ~q) -> (q -> p)", "Classical contraposition"),
    ("not_not_lem", "~~(p | ~p)", "Double negation of LEM — actually intuitionistically valid!"),
]

# Note: "not_not_lem" is actually intuitionistically valid. It's included to test
# whether AIs know this subtle fact: ~~(A | ~A) is always provable intuitionistically,
# even though (A | ~A) is not. Move it if the prover confirms this.

# ── Contradictions (both logics) ────────────────────────────────────────────
CONTRADICTIONS = [
    ("simple_contradiction", "p & ~p", "Direct contradiction"),
    ("implies_contradiction", "(p -> q) & (p -> ~q) & p", "Contradiction via implication"),
    ("false_identity", "p & ~p & q", "Contradiction with extra conjunct"),
    ("nested_contradiction", "(p -> p & ~p) & p", "Forced contradiction"),
    ("contradict_taut", "~(p -> p)", "Negation of tautology"),
    ("and_not_self", "p <-> ~p", "Self-referential biconditional"),
]

# ── Contingent (both logics) ───────────────────────────────────────────────
# Neither tautologies nor contradictions in either logic.
CONTINGENT_BOTH = [
    ("simple_var", "p", "Just a variable"),
    ("simple_neg", "~p", "Negation of a variable"),
    ("simple_and", "p & q", "Conjunction"),
    ("simple_or", "p | q", "Disjunction"),
    ("simple_impl", "p -> q", "Simple implication"),
    ("converse", "(p -> q) -> (q -> p)", "Converse — NOT a tautology"),
    ("affirming_consequent", "q -> (p -> q) -> p", "Affirming the consequent — fallacy"),
    ("denying_antecedent", "(p -> q) -> (~p -> ~q)", "Denying the antecedent — fallacy"),
    ("biconditional_asym", "(p -> q) -> (q -> p)", "Converse of conditional"),
    ("or_exclusive_ish", "(p | q) -> ~(p & q)", "Exclusive-or-ish — not valid"),
    ("distrib_fail", "(p | q) & r -> p & r", "Fails because q&r case"),
    ("impl_strengthen", "(p -> r) -> (p & q -> r)", "Weakening antecedent — wait, this IS valid"),
]

# Note: "impl_strengthen" is actually a tautology. It's included as a trap —
# it looks like it might fail but doesn't. The prover will reclassify it.

# ── Tricky formulas that look like tautologies but aren't ──────────────────
TRICKY_CONTINGENT = [
    ("fake_lem", "p | q", "Looks simple, not a tautology"),
    ("almost_taut", "(p -> q) -> p", "Looks like Peirce but missing the outer -> p"),
    ("partial_demorgan", "~(p | q) -> ~p", "Only half of De Morgan"),
    ("reverse_explosion", "q -> p & ~p -> q", "Rearranged explosion — actually IS valid due to parsing"),
    ("impl_symmetry", "(p -> q) <-> (q -> p)", "Biconditional of implication and converse"),
    ("or_implies", "(p | q) -> (p -> q)", "Disjunction does not imply conditional"),
    ("and_implies_or", "(p & q) -> (p <-> q)", "This IS valid — trap"),
]


def get_all_cases() -> list[tuple[str, str, str, str]]:
    """Return all cases as (name, formula_string, category, notes).

    Categories:
    - 'tautology_both': tautology in classical and intuitionistic
    - 'tautology_classical_only': tautology classically, contingent intuitionistically
    - 'contradiction': contradiction in both
    - 'contingent_both': contingent in both
    - 'tricky': formulas that may surprise — verify with prover
    """
    cases = []
    for name, formula, notes in BOTH_TAUTOLOGIES:
        cases.append((name, formula, "tautology_both", notes))
    for name, formula, notes in CLASSICAL_ONLY_TAUTOLOGIES:
        cases.append((name, formula, "tautology_classical_only", notes))
    for name, formula, notes in CONTRADICTIONS:
        cases.append((name, formula, "contradiction", notes))
    for name, formula, notes in CONTINGENT_BOTH:
        cases.append((name, formula, "contingent_both", notes))
    for name, formula, notes in TRICKY_CONTINGENT:
        cases.append((name, formula, "tricky", notes))
    return cases
