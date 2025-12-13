"""Pydantic request schemas for the in-memory backend."""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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
    supplier: Optional[str] = None
    currency: Optional[str] = None
    lead_time_days: Optional[int] = Field(None, alias="lead_time")
    moq: Optional[int] = None


class QuoteUpdate(BaseModel):
    """Schema for updating a quote."""

    model_config = ConfigDict(extra="ignore")

    deal_id: Optional[int] = None
    amount: Optional[Decimal] = None
    supplier: Optional[str] = None
    currency: Optional[str] = None
    lead_time_days: Optional[int] = Field(None, alias="lead_time")
    moq: Optional[int] = None
