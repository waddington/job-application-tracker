from jat.openapi import DEFAULT_OUT, render


def test_frontend_openapi_is_up_to_date():
    """The frontend's typed client is generated from frontend/openapi.json. If this fails, run
    `uv run python -m jat.openapi && pnpm --dir frontend gen:api` and commit the result."""
    assert DEFAULT_OUT.read_text() == render()
