"""
Centralised RASCI enforcement.
ONE function: can_user_act(user, stage_key, action) -> (allowed: bool, rasci_code: str, reason: str)
Every router calls this. No scattered permission checks.
"""
import json
from pathlib import Path
from typing import Tuple

_MATRIX: dict | None = None


def _load_matrix() -> dict:
    global _MATRIX
    if _MATRIX is None:
        path = Path(__file__).parent.parent / "config" / "rasci_matrix.json"
        _MATRIX = json.loads(path.read_text())
    return _MATRIX


# Actions that require AR or A (sign-off / advance the gate)
ADVANCE_ACTIONS = {"advance_stage", "approve", "sign_off", "submit", "decide", "co_approve"}
# Actions that require at least R (do the work)
WORK_ACTIONS = {"create", "edit", "update", "submit_for_review", "raise_exception", "upload"}
# Actions available to S (support)
SUPPORT_ACTIONS = {"comment", "contribute"}
# Actions available to C (consulted)
CONSULT_ACTIONS = {"comment"}
# Actions available to I (informed)
READ_ACTIONS = {"read", "view"}


def get_rasci_code(persona_key: str, stage_key: str) -> str:
    """Return the RASCI code for a persona at a given stage."""
    matrix = _load_matrix()
    stage = matrix.get(stage_key, {})
    return stage.get(persona_key, "-")


def can_user_act(
    persona_key: str,
    stage_key: str,
    action: str,
) -> Tuple[bool, str, str]:
    """
    Returns (allowed, rasci_code, reason).
    Call this in every router before any state-changing operation.
    """
    code = get_rasci_code(persona_key, stage_key)

    if code == "-":
        return False, code, f"You are not engaged at stage '{stage_key}' (RASCI: —). Access denied."

    action_lower = action.lower()

    if action_lower in READ_ACTIONS:
        # Everyone engaged (any code except -) can read
        return True, code, "Read access granted."

    if action_lower in CONSULT_ACTIONS:
        if code in ("AR", "A", "R", "S", "C"):
            return True, code, "Comment access granted."
        return False, code, f"Informed-only access at this stage (RASCI: {code}). Cannot comment."

    if action_lower in SUPPORT_ACTIONS:
        if code in ("AR", "A", "R", "S"):
            return True, code, "Support/contribute access granted."
        return False, code, f"You may only comment or read at this stage (RASCI: {code})."

    if action_lower in WORK_ACTIONS:
        if code in ("AR", "R"):
            return True, code, "Work access granted."
        if code in ("A", "S"):
            return False, code, f"You oversee this stage (RASCI: {code}) but do not perform the work. Use a Responsible user."
        return False, code, f"Insufficient RASCI capacity for '{action}' at stage '{stage_key}' (RASCI: {code})."

    if action_lower in ADVANCE_ACTIONS:
        if code in ("AR", "A"):
            return True, code, "Gate/approval access granted."
        return False, code, f"Only Accountable (A or AR) users may approve or advance this gate. Your RASCI capacity is '{code}'."

    # Unknown action — default to checking for at least R
    if code in ("AR", "A", "R"):
        return True, code, f"Access granted (RASCI: {code})."
    return False, code, f"Access denied for action '{action}' (RASCI: {code})."


def get_user_active_tenders_filter(persona_key: str, stage_key: str) -> bool:
    """True if the user has any engagement (not -) at this stage."""
    code = get_rasci_code(persona_key, stage_key)
    return code != "-"


def personas_with_ar_at_stage(stage_key: str) -> list[str]:
    """Return list of persona keys with AR or A at the given stage."""
    matrix = _load_matrix()
    stage = matrix.get(stage_key, {})
    return [p for p, c in stage.items() if c in ("AR", "A")]
