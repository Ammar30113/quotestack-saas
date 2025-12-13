"""Pydantic request schemas for the in-memory backend."""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DealCreate(BaseModel):
    """Schema for creating a deal."""

    model_config = ConfigDict(extra="ignore")

    name: str
    value: Optional[Decimal] = None


class DealUpdate(BaseModel):
    """Schema for updating a deal."""

    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    value: Optional[Decimal] = None


class QuoteCreate(BaseModel):
    """Schema for creating a quote."""

    model_config = ConfigDict(extra="ignore")

    deal_id: int
    amount: Decimal


class QuoteUpdate(BaseModel):
    """Schema for updating a quote."""

    model_config = ConfigDict(extra="ignore")

    deal_id: Optional[int] = None
    amount: Optional[Decimal] = None
