"""Normalization utilities for supplier quote ingestion."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    # QuoteDraft should describe the normalized structure for a supplier quote,
    # including parsed fields like supplier metadata, line items, currency, and dates.
    from backend.models import QuoteDraft


def normalize_quote_input(raw_text: str) -> "QuoteDraft":
    """Parse and normalize unstructured quote text into a ``QuoteDraft``.

    The implementation should clean incoming supplier quote text (e.g., strip
    extra whitespace, standardize casing, normalize currency/number formats,
    and remove boilerplate), extract structured details such as supplier name,
    contact info, quote validity, and line items with quantities, pricing,
    and currency, then construct a ``QuoteDraft`` that captures these fields
    in a consistent shape for downstream processing.
    """

    # Placeholder implementation keeps the demo backend safe while avoiding crashes.
    from models import QuoteDraft

    return QuoteDraft(id=0, deal_id=0, supplier_id=0, tentative_amount=None, notes=None)
