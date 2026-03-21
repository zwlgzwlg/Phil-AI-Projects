"""Prompt templates for AI evaluation of propositional logic formulas."""

ONE_WORD_TEMPLATE = """Classify the following propositional logic formula in {logic} logic.

Is it a tautology (true under all interpretations), a contradiction (false under all interpretations), contingent (true under some interpretations, false under others), or are you unable to determine the answer?

Formula: {formula}

Answer with exactly one word: tautology, contradiction, contingent, or undetermined."""

REASONING_TEMPLATE = """Classify the following propositional logic formula in {logic} logic.

Is it a tautology (true under all interpretations), a contradiction (false under all interpretations), contingent (true under some interpretations, false under others), or are you unable to determine the answer?

Formula: {formula}

Show your reasoning step by step, then give your final answer on the last line in this exact format:
Classification: [your answer]

where your answer is one of: tautology, contradiction, contingent, or undetermined."""


def make_prompt(formula_natural: str, logic: str, style: str) -> str:
    """Generate a prompt for evaluating a formula.

    Args:
        formula_natural: The formula in natural language notation.
        logic: 'classical' or 'intuitionistic'.
        style: 'one_word' or 'reasoning'.
    """
    template = ONE_WORD_TEMPLATE if style == "one_word" else REASONING_TEMPLATE
    return template.format(formula=formula_natural, logic=logic)
