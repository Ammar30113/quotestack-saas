"""Pydantic request schemas for the FastAPI backend."""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, constr


class DealCreateRequest(BaseModel):
    """Schema for creating a deal with basic validation."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company_name: constr(min_length=1)
    currency: constr(pattern=r"^[A-Z]{3}$", min_length=3, max_length=3)
    description: Optional[str] = None


class DealUpdate(BaseModel):
    """Schema for updating a deal."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company_name: Optional[constr(min_length=1)] = None
    currency: Optional[constr(pattern=r"^[A-Z]{3}$", min_length=3, max_length=3)] = None
    description: Optional[str] = None


class QuoteCreate(BaseModel):
    """Schema for creating a quote."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    deal_id: int
    amount: Decimal
    supplier: Optional[str] = None
    currency: Optional[str] = None
    lead_time_days: Optional[int] = Field(None, alias="lead_time")
    moq: Optional[int] = None


class QuoteUpdate(BaseModel):
    """Schema for updating a quote."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    deal_id: Optional[int] = None
    amount: Optional[Decimal] = None
    supplier: Optional[str] = None
    currency: Optional[str] = None
    lead_time_days: Optional[int] = Field(None, alias="lead_time")
    moq: Optional[int] = None


class PaginationParams(BaseModel):
    """Shared pagination schema to keep limits consistent across endpoints."""

    model_config = ConfigDict(extra="forbid")

    limit: int = Field(20, ge=1, description="Maximum items to return.")
    offset: int = Field(0, ge=0, description="Items to skip before returning results.")
