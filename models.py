"""Domain models for QuoteStack SaaS.

These dataclasses define the minimal fields needed to represent
core trading and quoting entities without persisting logic.
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Optional


@dataclass
class Company:
    """Represents a trading company using QuoteStack."""

    id: int
    name: str
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Deal:
    """Represents a deal or opportunity associated with a company."""

    id: int
    company_id: int
    name: str
    value: Optional[Decimal] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Supplier:
    """Represents a supplier providing quotes for deals."""

    id: int
    company_id: int
    name: str
    contact_email: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Quote:
    """Represents a finalized quote submitted by a supplier."""

    id: int
    deal_id: int
    supplier_id: int
    amount: Decimal
    currency: str
    submitted_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class QuoteDraft:
    """Represents a draft quote in progress before submission."""

    id: int
    deal_id: int
    supplier_id: int
    tentative_amount: Optional[Decimal] = None
    notes: Optional[str] = None
    updated_at: datetime = field(default_factory=datetime.utcnow)
