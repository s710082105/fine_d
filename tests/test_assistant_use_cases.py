import importlib

import pytest

from backend.domain.project.errors import AppError


def _load_assistant_use_cases_module():
    try:
        return importlib.import_module("backend.application.assistant.use_cases")
    except ModuleNotFoundError as error:
        pytest.fail(f"assistant use case module is missing: {error}")


def test_route_prompt_routes_to_sync() -> None:
    module = _load_assistant_use_cases_module()
    use_case = module.AssistantUseCases()

    result = use_case.route_prompt("请帮我同步并发布到远端")

    assert result.prompt == "请帮我同步并发布到远端"
    assert result.status == "routed"
    assert result.module == "sync"
    assert result.actions == ("publish_project", "verify_remote_state")


def test_route_prompt_routes_to_preview() -> None:
    module = _load_assistant_use_cases_module()
    use_case = module.AssistantUseCases()

    result = use_case.route_prompt("打开浏览器预览这个页面")

    assert result.status == "routed"
    assert result.module == "preview"
    assert result.actions == ("open_preview",)


def test_route_prompt_returns_needs_clarification_for_unknown_prompt() -> None:
    module = _load_assistant_use_cases_module()
    use_case = module.AssistantUseCases()

    result = use_case.route_prompt("帮我处理这个事情")

    assert result.status == "needs_clarification"
    assert result.module == "assistant"
    assert result.actions == ()


@pytest.mark.parametrize("prompt", ["", "   "])
def test_route_prompt_rejects_blank_prompt(prompt: str) -> None:
    module = _load_assistant_use_cases_module()
    use_case = module.AssistantUseCases()

    with pytest.raises(AppError) as exc_info:
        use_case.route_prompt(prompt)

    assert exc_info.value.code == "assistant.invalid_prompt"
    assert exc_info.value.detail == {"prompt": prompt}
