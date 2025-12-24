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

    deal_id: int = Field(..., ge=1)
    amount: Decimal = Field(..., gt=0)
    supplier: Optional[str] = None
    currency: Optional[constr(pattern=r"^[A-Z]{3}$", min_length=3, max_length=3)] = None
    lead_time_days: Optional[int] = Field(None, alias="lead_time", ge=0)
    moq: Optional[int] = Field(None, ge=0)


class QuoteUpdate(BaseModel):
    """Schema for updating a quote."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    deal_id: Optional[int] = Field(None, ge=1)
    amount: Optional[Decimal] = Field(None, gt=0)
    supplier: Optional[str] = None
    currency: Optional[constr(pattern=r"^[A-Z]{3}$", min_length=3, max_length=3)] = None
    lead_time_days: Optional[int] = Field(None, alias="lead_time", ge=0)
    moq: Optional[int] = Field(None, ge=0)


class PaginationParams(BaseModel):
    """Shared pagination schema to keep limits consistent across endpoints."""

    model_config = ConfigDict(extra="forbid")

    limit: int = Field(20, ge=1, description="Maximum items to return.")
    offset: int = Field(0, ge=0, description="Items to skip before returning results.")
