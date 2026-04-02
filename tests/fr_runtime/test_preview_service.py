from tooling.fr_runtime.preview.service import build_preview_summary


def test_build_preview_summary_is_evidence_first() -> None:
    summary = build_preview_summary(
        "http://127.0.0.1:8075/webroot/decision/view/report",
        True,
        True,
    )
    assert "预览地址" in summary
    assert "是否执行查询：是" in summary
