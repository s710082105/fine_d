from backend.domain.assistant.models import AssistantRouteResult
from backend.domain.project.errors import AppError

ROUTE_RULES = (
    (
        "datasource",
        ("数据源", "连接", "sql", "数据集"),
        ("list_connections", "preview_sql"),
        "推荐走数据源模块。",
    ),
    (
        "reportlet",
        ("报表", "template", "cpt", "fvs", "文件树"),
        ("list_tree", "read"),
        "推荐走报表模块。",
    ),
    (
        "sync",
        ("同步", "发布", "push", "拉取", "校验远端"),
        ("publish_project", "verify_remote_state"),
        "推荐走同步模块。",
    ),
    (
        "preview",
        ("预览", "打开浏览器", "截图", "页面检查"),
        ("open_preview",),
        "推荐走预览模块。",
    ),
)


class AssistantUseCases:
    def route_prompt(self, prompt: str) -> AssistantRouteResult:
        normalized_prompt = self._normalize_prompt(prompt)
        for module, keywords, actions, message in ROUTE_RULES:
            if any(keyword in normalized_prompt for keyword in keywords):
                return AssistantRouteResult(
                    prompt=prompt,
                    status="routed",
                    module=module,
                    actions=actions,
                    message=message,
                )
        return AssistantRouteResult(
            prompt=prompt,
            status="needs_clarification",
            module="assistant",
            actions=(),
            message="未识别明确模块，请补充更具体的任务目标。",
        )

    @staticmethod
    def _normalize_prompt(prompt: str) -> str:
        normalized_prompt = prompt.strip()
        if normalized_prompt:
            return normalized_prompt.lower()
        raise AppError(
            code="assistant.invalid_prompt",
            message="assistant prompt must not be blank",
            detail={"prompt": prompt},
            source="assistant",
        )
