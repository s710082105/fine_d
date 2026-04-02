from tooling.fr_runtime.init.service import merge_answers


def test_merge_answers_marks_invalid_fields_for_retry() -> None:
    result = merge_answers(
        {"project_name": "demo"},
        {
            "designer_root": "",
            "decision_url": "http://127.0.0.1:8075/webroot/decision",
        },
    )
    assert result.retry_fields == ["designer_root"]
    assert result.status["decision_url"] == "passed"
