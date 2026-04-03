from tooling.fr_runtime.preview.service import build_preview_summary, build_preview_url


def test_build_preview_url_uses_report_route_for_cpt() -> None:
    url = build_preview_url(
        "http://127.0.0.1:8075/webroot/decision",
        "reportlets/demo/demo.cpt",
    )
    assert url == "http://127.0.0.1:8075/webroot/decision/view/report?viewlet=demo/demo.cpt"


def test_build_preview_url_uses_duchamp_route_for_fvs() -> None:
    url = build_preview_url(
        "http://127.0.0.1:8075/webroot/decision",
        "reportlets/dashboard/demo.fvs",
    )
    assert url == "http://127.0.0.1:8075/webroot/decision/view/duchamp?page_number=1&viewlet=dashboard/demo.fvs"


def test_build_preview_summary_is_evidence_first() -> None:
    summary = build_preview_summary(
        "http://127.0.0.1:8075/webroot/decision/view/report",
        True,
        True,
    )
    assert "预览地址" in summary
    assert "是否执行查询：是" in summary


def test_build_preview_summary_includes_login_and_target_context() -> None:
    summary = build_preview_summary(
        "http://127.0.0.1:8075/webroot/decision/view/report?viewlet=demo.cpt",
        True,
        True,
        login_url="http://127.0.0.1:8075/webroot/decision",
        username="admin",
        report_path="reportlets/demo/demo.cpt",
        expectation="表头与数据都符合预期",
    )
    assert "登录入口：http://127.0.0.1:8075/webroot/decision" in summary
    assert "登录账号：admin" in summary
    assert "目标报表：reportlets/demo/demo.cpt" in summary
    assert "复核重点：表头与数据都符合预期" in summary


def test_build_preview_summary_notes_duchamp_route_for_fvs() -> None:
    summary = build_preview_summary(
        "http://127.0.0.1:8075/webroot/decision/view/duchamp?page_number=1&viewlet=dashboard/demo.fvs",
        True,
        False,
        report_path="reportlets/dashboard/demo.fvs",
    )
    assert "目标报表：reportlets/dashboard/demo.fvs" in summary
    assert "预览类型：FVS 决策报表" in summary
