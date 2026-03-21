# Logic Experiments

Testing how well AI models classify propositional logic formulas.

## Conjecture

AI models are basically perfect at classical propositional logic but struggle with non-classical logics (intuitionistic, modal, etc.) where familiar classical principles fail.

## What this project does

1. **Generates** a bank of propositional formulas — hand-curated interesting cases, template-based variants, and random formulas
2. **Verifies** each formula's status (tautology / contradiction / contingent) using machine provers
3. **Evaluates** AI models (Claude, GPT, etc.) by asking them to classify each formula, then scores the results

## Structure

```
formulas/
  ast_types.py         Formula AST: Var, Not, And, Or, Implies, Iff
                       + helpers: get_variables(), depth(), connectives_used()
  parser.py            String -> AST via lark grammar
                       Syntax: ~ & | -> <->  with standard precedence
  printer.py           AST -> string in three formats:
                         to_symbolic()  e.g. "p | ~p"
                         to_natural()   e.g. "p OR NOT p"
                         to_latex()     e.g. "p \lor \lnot p"
  generator.py         Template-based and random formula generation
  known_hard_cases.py  ~70 hand-curated formulas organised by category:
                         - tautology in both classical & intuitionistic
                         - tautology classically only (the interesting ones)
                         - contradictions
                         - contingent formulas
                         - tricky formulas that look like tautologies but aren't

provers/
  classical.py         Truth-table evaluation. Works.
  intuitionistic.py    Kripke model enumeration. Stub — needs a real prover
                       or precomputed posets. NOT currently functional.

bank/
  generate_bank.py     Orchestrates: collect formulas -> verify with provers -> output JSON
  sentence_bank.json   Output file (generated, not checked in)

evaluation/
  prompts.py           Two prompt templates:
                         one_word:   "Answer with one word: tautology, contradiction, or contingent"
                         reasoning:  "Show your reasoning, then Classification: [answer]"
                       Both parameterised by logic type (any string).
  run_eval.py          Sends formulas to AI APIs (Claude + OpenAI), collects responses.
                       Async with rate limiting. Parses responses with regex fallback.
                       CLI: --models, --styles, --logics, --limit
  score.py             Scores results against ground truth. Outputs:
                         - accuracy by model, logic, style, ground truth category
                         - confusion matrices
                         - special focus on the "classically valid, intuitionistically contingent" case
                         - LaTeX table for paper inclusion
  results/             Output directory for evaluation runs

tests/
  test_classical.py    Tests for the classical prover (passing)
  test_intuitionistic.py  Tests for intuitionistic prover (not yet functional)
```

## Usage

```bash
# Setup
cd Logic-Experiments
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Generate the sentence bank (requires working provers)
python bank/generate_bank.py

# Run AI evaluation (requires API keys)
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
python evaluation/run_eval.py --models claude-sonnet,gpt-4o-mini --limit 10

# Score results
python evaluation/score.py
```

## Extending to other logics

The evaluation pipeline is logic-agnostic. The `logic` parameter is a string
that appears in the prompt and is used as a grouping key in scoring.
To add a new logic (e.g. modal S5):

1. **AST**: add new node types (e.g. `Box`, `Diamond`) to `formulas/ast_types.py`
2. **Parser/printer**: extend the grammar and printer for new syntax
3. **Known cases**: add hand-curated formulas for the new logic
4. **Prover**: add a verifier in `provers/` that classifies formulas in the new logic
5. **Evaluation**: no changes needed — just pass `--logics modal_S5` to `run_eval.py`

## Current status

- [x] Formula AST, parser, printer
- [x] Classical prover (truth tables)
- [ ] Intuitionistic prover (needs reimplementation)
- [x] Formula bank generation script
- [x] Hand-curated formula collection (~70 formulas)
- [x] Template + random formula generators
- [x] AI evaluation scaffolding (Claude + OpenAI)
- [x] Scoring + LaTeX table output
- [ ] First evaluation run
