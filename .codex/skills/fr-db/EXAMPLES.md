# DB Examples

本文件给 `fr-db` 提供示例索引，不在 `SKILL.md` 展开长说明。

## Example Map

- `references/decision-http.md`
  - 何时看：需要确认登录 payload、连接列表接口、HTTP 边界
  - 重点：哪些探测走 Decision HTTP，哪些不该走 bridge
- `../fr-cpt/examples/live-remote-patterns.md`
  - 何时看：这次探测结果最终要落到 `.cpt` 的数据集、参数或 SQL 片段
  - 重点：CPT 的 `TableDataMap`、参数、公式和展示块长什么样
- `../fr-fvs/examples/live-remote-patterns.md`
  - 何时看：这次探测结果最终要落到 `.fvs` 的 `editor.tpl` 数据集或图表页
  - 重点：FVS 主文件、`store`、图表资源的结构入口

## Usage

- 先看 `decision-http.md`，确认接口和取证范围
- 再按目标文件类型转到 `fr-cpt` 或 `fr-fvs` 示例
- `fr-db` 只负责把数据证据探出来，不在这里展开最终模板结构
