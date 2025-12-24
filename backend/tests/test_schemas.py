from decimal import Decimal

import pytest
from pydantic import ValidationError

from backend.models.schemas import QuoteCreate, QuoteUpdate


def test_quote_create_rejects_invalid_amount():
    with pytest.raises(ValidationError):
        QuoteCreate(deal_id=1, amount=Decimal("0"), currency="USD")


def test_quote_create_rejects_negative_lead_time():
    with pytest.raises(ValidationError):
        QuoteCreate(deal_id=1, amount=Decimal("10.5"), currency="USD", lead_time=-1)


def test_quote_create_rejects_invalid_currency():
    with pytest.raises(ValidationError):
        QuoteCreate(deal_id=1, amount=Decimal("10.5"), currency="usd")


def test_quote_update_validates_when_fields_provided():
    QuoteUpdate(amount=Decimal("1.25"))
    with pytest.raises(ValidationError):
        QuoteUpdate(amount=Decimal("-1"))
    with pytest.raises(ValidationError):
        QuoteUpdate(deal_id=0)
