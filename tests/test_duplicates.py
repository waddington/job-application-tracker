import pytest

from jat.domain.duplicates import normalize_company, title_match

from .factories import post


@pytest.mark.parametrize(
    ("a", "b", "expected"),
    [
        ("Senior Backend Engineer", "Senior Backend Engineer", "same_role"),
        ("Senior Backend Engineer", "backend engineer, senior", "same_role"),
        ("Sr. Python Developer", "Senior Python Engineer", "same_role"),
        ("Backend Engineer", "Senior Backend Engineer", "similar_title"),
        ("Platform Engineer", "Platfrom Engineer", "similar_title"),
        ("Backend Engineer", "Frontend Engineer", None),
        ("Data Scientist", "Engineering Manager", None),
        ("Engineer", "Senior Staff Platform Engineer", None),
        ("", "Engineer", None),
    ],
)
def test_title_match(a, b, expected):
    assert title_match(a, b) == expected
    assert title_match(b, a) == expected


@pytest.mark.parametrize(
    ("a", "b"),
    [("Contoso Ltd.", "contoso"), ("The Fabrikam Group Inc", "Fabrikam Group"), ("Tailspin & Co", "tailspin and")],
)
def test_normalize_company(a, b):
    assert normalize_company(a) == normalize_company(b)


def test_company_suffix_alone_is_kept():
    assert normalize_company("Ltd") == "ltd"


def dupes(client, **params):
    r = client.get("/api/v1/applications/duplicates", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_warns_about_a_second_route_to_the_same_job(client, seeded):
    direct = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})

    found = dupes(client, company_name="contoso ltd", role_title="Backend Engineer")
    assert [(d["id"], d["match"]) for d in found] == [(direct["id"], "similar_title")]
    assert found[0]["company_name"] == "Contoso"
    assert dupes(client, company_id=seeded["company"]["id"], role_title="Senior Backend Engineer")[0]["match"] == (
        "same_role"
    )
    assert dupes(client, company_name="Contoso", role_title="Frontend Engineer") == []
    assert dupes(client, company_name="Fabrikam", role_title="Senior Backend Engineer") == []

    # A recruiter puts Kai forward for the same job: both applications point at each other.
    via_agency = post(
        client,
        "/api/v1/applications/quick",
        {
            "company_name": "Contoso",
            "role_title": "Backend Engineer (Senior)",
            "route": "agency",
            "agency_id": seeded["agency"]["id"],
        },
    )
    assert [(d["id"], d["route"]) for d in via_agency["duplicates"]] == [(direct["id"], "direct")]
    detail = client.get(f"/api/v1/applications/{direct['id']}").json()
    assert [(d["id"], d["agency_name"]) for d in detail["duplicates"]] == [(via_agency["id"], "Northwind Talent")]


def test_archived_applications_still_count(client, seeded):
    old = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    assert client.patch(f"/api/v1/applications/{old['id']}", json={"archived": True}).status_code == 200
    found = dupes(client, company_name="Contoso", role_title="Senior Backend Engineer")
    assert [(d["id"], d["archived"]) for d in found] == [(old["id"], True)]


def test_needs_a_company(client):
    assert client.get("/api/v1/applications/duplicates", params={"role_title": "x"}).status_code == 422
