from collections.abc import Iterable

from backend.domain.project.models import CurrentProject
from backend.domain.project.remote_models import RemoteProfile
from backend.domain.remote.models import RemoteDirectoryEntry, RemoteOverview

MANAGED_SKILLS = (
    "fr-create",
    "fr-db",
    "fr-remote-check",
    "fr-remote-pull",
    "fr-remote-fill",
    "fr-sync",
    "fr-verify",
)

SKILL_DESCRIPTIONS = {
    "fr-create": "新建 CPT/FVS 前先确认当前项目上下文和远端目录。",
    "fr-db": "读取远端 overview 中的数据连接并做字段扫描、SQL 试跑。",
    "fr-remote-check": "核对当前项目远端配置、目录根和连接摘要。",
    "fr-remote-pull": "从远端 reportlets 拉取目录或单个文件做对照。",
    "fr-remote-fill": "基于当前 overview 回填模板、SQL 和报表字段。",
    "fr-sync": "把本地 reportlets 变更同步到远端并记录结果。",
    "fr-verify": "在交付前复核远端目录、数据连接和生成文件是否一致。",
}

SKILL_TRIGGERS = {
    "fr-create": "确认需求后，需要新建 CPT/FVS 或从样板派生新报表时。",
    "fr-db": "涉及数据集、SQL、字段口径或库表扫描时。",
    "fr-remote-check": "刚接到需求、准备判断远端现状和可复用资产时。",
    "fr-remote-pull": "远端已有文件，需要先拉取对照或本地缺少样板时。",
    "fr-remote-fill": "已确定参考模板，准备回填 SQL、参数和字段映射时。",
    "fr-sync": "本地改动完成，准备把 reportlets 变更推到远端时。",
    "fr-verify": "同步完成后，准备做浏览器复核和最终交付确认时。",
}

DELIVERY_CHAIN = (
    "先确认需求",
    "检查远端",
    "按需拉取/补全",
    "本地修改",
    "同步推送",
    "浏览器复核",
    "最终准确报告",
)

B_PLAN_BOUNDARIES = (
    "页面不做流程编排",
    "最终报告以 Codex 终端输出为准",
)

DB_HOST_TOOL_RULES = (
    "涉及列出现有连接、试运行 SQL、查看预览结果时，禁止自行调用 shell、python、curl 或 `./.codex/fr-data.*` helper。",
    "必须输出单独一行宿主工具请求，由宿主执行后回写结果。",
    '列连接：`@@FR_TOOL {"id":"req_list_connections","name":"fr.list_connections","args":{}}`',
    '试运行 SQL：`@@FR_TOOL {"id":"req_preview_sql","name":"fr.preview_sql","args":{"connection_name":"FRDemo","sql":"select 1 as ok"}}`',
    "收到 `@@FR_TOOL_RESULT {...}` 后再继续分析，不要在结果返回前自行臆造连接名、字段或 SQL 结果。",
)


def render_agents_markdown(
    project: CurrentProject,
    profile: RemoteProfile,
    overview: RemoteOverview,
) -> str:
    return "\n".join(
        (
            "# Project Agent Rules",
            "",
            f"- 项目名称：`{project.name}`",
            f"- 项目路径：`{project.path}`",
            f"- 远端地址：`{profile.base_url}`",
            f"- Designer Root：`{profile.designer_root}`",
            "- 回复默认使用简体中文。",
            "- 先读取 `.codex/project-context.md` 与 `.codex/project-rules.md` 再行动。",
            "- 修改报表、数据集、SQL 必须走完整链路：",
            _format_markdown_list(DELIVERY_CHAIN),
            "- B 方案边界：",
            _format_markdown_list(B_PLAN_BOUNDARIES),
            "- FineReport 专用 skill 作用与触发时机：",
            _format_markdown_list(_format_skill_guidance_items()),
            "- 试运行 SQL 与连接扫描必须走宿主工具协议：",
            _format_markdown_list(DB_HOST_TOOL_RULES),
            "- 修改报表、数据集、SQL 前必须先核对远端 overview 和数据连接。",
            "- `reportlets/` 相关改动完成后要做远端同步与浏览器复核，不要停在本地文件修改。",
            "- 未命中对应 skill 的触发时机前，不要自行扩展额外动作或跳步执行。",
            "- 已登记数据连接：",
            _format_markdown_list(_format_connections(overview)),
        )
    )


def render_project_context_markdown(
    project: CurrentProject,
    profile: RemoteProfile,
    overview: RemoteOverview,
) -> str:
    return "\n".join(
        (
            "# 项目上下文",
            "",
            f"- 项目：`{project.name}`",
            f"- 本地路径：`{project.path}`",
            f"- 远端地址：`{profile.base_url}`",
            f"- Designer Root：`{profile.designer_root}`",
            f"- 最近 overview 时间：`{overview.last_loaded_at.isoformat()}`",
            "",
            "## 本地关键目录",
            "- `reportlets/`：项目内实际报表与目录结构，修改后要参与同步推送。",
            "- `templates/`：CPT/FVS 模板和生成参考，不要拿模板当远端真实状态。",
            "- `.codex/skills/`：项目级 FineReport skill 入口，供 Codex 终端按需调用。",
            "",
            "## 数据连接",
            _format_markdown_list(_format_connections(overview)),
            "",
            "## 远端目录样本",
            _format_markdown_list(_format_directory_entries(overview.directory_entries)),
        )
    )


def render_project_rules_markdown(
    project: CurrentProject,
    overview: RemoteOverview,
) -> str:
    return "\n".join(
        (
            "# 当前项目上下文规则",
            "",
            f"- 当前项目固定为：`{project.name}`",
            "- 交付必须遵守完整链路：",
            _format_markdown_list(DELIVERY_CHAIN),
            "- B 方案边界：",
            _format_markdown_list(B_PLAN_BOUNDARIES),
            "- 远端目录默认以 `/reportlets` 为根目录，不要跨根目录猜测路径。",
            "- 设计报表前先看数据连接摘要，再决定是查库、拉模板还是直接改 CPT。",
            "- 如果 overview 已列出连接或目录，优先复用这些真实信息，不要自行编造连接名。",
            "- 当前可见数据连接：",
            _format_markdown_list(_format_connections(overview)),
            "- 当前已生成 FineReport 技能入口：",
            _format_markdown_list(f"`{skill}`" for skill in MANAGED_SKILLS),
        )
    )


def render_skill_markdown(
    skill_name: str,
    project: CurrentProject,
) -> str:
    description = SKILL_DESCRIPTIONS[skill_name]
    extra_lines: tuple[str, ...] = ()
    if skill_name == "fr-db":
        extra_lines = (
            "",
            "## 宿主工具协议",
            *_format_markdown_list(DB_HOST_TOOL_RULES).splitlines(),
        )
    return "\n".join(
        (
            "---",
            f"name: {skill_name}",
            f"description: {description}",
            "---",
            "",
            f"# {skill_name}",
            "",
            description,
            "",
            "## 使用要求",
            "- 先读取 `../../project-context.md`。",
            "- 再读取 `../../project-rules.md`。",
            f"- 当前项目目录：`{project.path}`。",
            "- 仅基于真实远端 overview、真实数据连接和真实 reportlets 路径执行。",
            *extra_lines,
        )
    )


def build_skill_documents(project: CurrentProject) -> dict[str, str]:
    return {
        f".codex/skills/{skill_name}/SKILL.md": render_skill_markdown(
            skill_name,
            project,
        )
        for skill_name in MANAGED_SKILLS
    }


def _format_skill_guidance_items() -> tuple[str, ...]:
    return tuple(
        f"`{skill_name}`：作用：{SKILL_DESCRIPTIONS[skill_name]} 触发时机：{SKILL_TRIGGERS[skill_name]}"
        for skill_name in MANAGED_SKILLS
    )


def _format_connections(overview: RemoteOverview) -> tuple[str, ...]:
    if not overview.data_connections:
        return ("暂无远端数据连接。",)
    return tuple(
        f"{connection.name} ({connection.database_type or 'UNKNOWN'})"
        for connection in overview.data_connections
    )


def _format_directory_entries(
    entries: Iterable[RemoteDirectoryEntry],
) -> tuple[str, ...]:
    values = tuple(
        f"{entry.path} [{'目录' if entry.is_directory else '文件'}]"
        for entry in entries
    )
    if not values:
        return ("暂无远端目录样本。",)
    return values


def _format_markdown_list(items: Iterable[str]) -> str:
    return "\n".join(f"- {item}" for item in items)
