"""Formula AST for propositional logic."""

from __future__ import annotations
from dataclasses import dataclass
from typing import Union


@dataclass(frozen=True)
class Var:
    name: str


@dataclass(frozen=True)
class Not:
    operand: Formula


@dataclass(frozen=True)
class And:
    left: Formula
    right: Formula


@dataclass(frozen=True)
class Or:
    left: Formula
    right: Formula


@dataclass(frozen=True)
class Implies:
    left: Formula
    right: Formula


@dataclass(frozen=True)
class Iff:
    left: Formula
    right: Formula


Formula = Union[Var, Not, And, Or, Implies, Iff]


def get_variables(formula: Formula) -> set[str]:
    """Return the set of variable names in a formula."""
    match formula:
        case Var(name):
            return {name}
        case Not(operand):
            return get_variables(operand)
        case And(left, right) | Or(left, right) | Implies(left, right) | Iff(left, right):
            return get_variables(left) | get_variables(right)


def depth(formula: Formula) -> int:
    """Return the nesting depth of a formula."""
    match formula:
        case Var(_):
            return 0
        case Not(operand):
            return 1 + depth(operand)
        case And(left, right) | Or(left, right) | Implies(left, right) | Iff(left, right):
            return 1 + max(depth(left), depth(right))


def connectives_used(formula: Formula) -> set[str]:
    """Return the set of connective names used in a formula."""
    match formula:
        case Var(_):
            return set()
        case Not(operand):
            return {"NOT"} | connectives_used(operand)
        case And(left, right):
            return {"AND"} | connectives_used(left) | connectives_used(right)
        case Or(left, right):
            return {"OR"} | connectives_used(left) | connectives_used(right)
        case Implies(left, right):
            return {"IMPLIES"} | connectives_used(left) | connectives_used(right)
        case Iff(left, right):
            return {"IFF"} | connectives_used(left) | connectives_used(right)
