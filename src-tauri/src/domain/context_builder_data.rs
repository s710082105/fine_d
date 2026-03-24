use super::project_config::ProjectConfig;
use std::io;

pub fn markdown_designer_data_access(_: &ProjectConfig) -> String {
    [
        "- 先读取设计器远端已有数据连接，不再使用项目内本地连接配置。",
        "- 先做真实字段扫描，再设计报表；参考其他模板只看样式和命名，字段以设计器远端返回结果为准。",
        "- 需要验证 SQL 时，优先使用设计器远端数据集预览或 SQL 试跑能力。",
    ]
    .join("\n")
}

pub fn designer_data_access_json(_: &ProjectConfig) -> io::Result<String> {
    serde_json::to_string_pretty(&serde_json::json!({
        "mode": "designer-remote",
        "rules": [
            "先读取设计器远端已有数据连接",
            "先扫字段再设计",
            "字段和 SQL 以设计器远端返回为准"
        ]
    }))
    .map_err(io::Error::other)
}
