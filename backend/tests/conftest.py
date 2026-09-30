import sys
import pytest
from contextlib import ExitStack
from unittest.mock import patch


def pytest_configure(config):
    config.addinivalue_line("markers", "real_doc_auth: use the real document ownership check")


def _fake_load_authorized_document(jwt, **kw):
    return ({"id": kw.get("document_id") or "doc-1",
             "matric_no": kw.get("expected_matric") or "A00XX0000",
             "processing_status": "Pending_Advisor_Approval",
             "extracted_data": {}}, "advisor")


@pytest.fixture(autouse=True)
def _stub_document_ownership(request):
    """Existing endpoint tests mock the database; stub the ownership check for them.
    Tests marked real_doc_auth exercise the real check."""
    if request.node.get_closest_marker("real_doc_auth"):
        yield
        return
    names = [n for n in ("app.v1.endpoints.audit", "backend.app.v1.endpoints.audit") if n in sys.modules]
    with ExitStack() as stack:
        for n in names:
            stack.enter_context(patch(f"{n}._load_authorized_document", side_effect=_fake_load_authorized_document))
        yield
