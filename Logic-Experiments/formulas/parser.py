"""Parse propositional logic formulas from strings into AST."""

from lark import Lark, Transformer
from .ast_types import Var, Not, And, Or, Implies, Iff, Formula

GRAMMAR = r"""
    ?start: iff

    ?iff: implies
        | iff "<->" implies  -> iff

    ?implies: disjunction
        | disjunction "->" implies  -> implies

    ?disjunction: conjunction
        | disjunction "|" conjunction  -> or_

    ?conjunction: unary
        | conjunction "&" unary  -> and_

    ?unary: "~" unary  -> not_
        | atom

    ?atom: VAR
        | "(" iff ")"

    VAR: /[a-z][a-z0-9]*/

    %import common.WS
    %ignore WS
"""

parser = Lark(GRAMMAR, parser="earley")


class FormulaTransformer(Transformer):
    def VAR(self, token):
        return Var(str(token))

    def not_(self, args):
        return Not(args[0])

    def and_(self, args):
        return And(args[0], args[1])

    def or_(self, args):
        return Or(args[0], args[1])

    def implies(self, args):
        return Implies(args[0], args[1])

    def iff(self, args):
        return Iff(args[0], args[1])


_transformer = FormulaTransformer()


def parse(text: str) -> Formula:
    """Parse a propositional logic formula string into an AST.

    Syntax:
        Variables: lowercase letters (p, q, r, ...)
        Negation:  ~
        And:       &
        Or:        |
        Implies:   ->
        Iff:       <->
        Parens:    ( )

    Precedence (tightest to loosest): ~, &, |, ->, <->
    Implication is right-associative; <-> is left-associative.
    """
    tree = parser.parse(text)
    return _transformer.transform(tree)
