"""Tests verifying tzdata is installed and provides IANA time zones across OSs."""

from __future__ import annotations

import zoneinfo


def test_iana_timezones_available(tzdata_only):
    """Verify IANA time zones resolve exclusively via tzdata."""
    zone = zoneinfo.ZoneInfo("Europe/London")
    assert zone.key == "Europe/London"
    assert "Europe/London" in zoneinfo.available_timezones()
