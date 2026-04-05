# finereport-ai

面向帆软设计器联调的 FineReport skill 运行仓。

## 当前结构

- `.codex/skills/`：项目级 skill 目录，包含 FineReport 业务 skill、内置 `superpowers`、`skill-creator`、`chrome-devtools`
- `tooling/fr_runtime/`：Python 运行时，统一提供 `init`、`doctor`、`db`、`sync`、`preview`
- `bridge/src/`：Java bridge 源码
- `bridge/scripts/build_bridge.py`：本地与 CI 共用的打包脚本
- `bridge/dist/`：打包输出目录，运行时读取这里的 bridge 产物
- `reportlets/`：样例报表与参考产物
- `tests/fr_runtime/`：运行时回归测试
- `docs/`：历史设计、协议分析和实施归档

## 直接使用

- 参考示例配置：`.codex/fr-config.demo.json`
- 项目初始化：`python3 .codex/skills/fr-init/scripts/run.py --config-path .codex/fr-config.json`
- 状态检查：`python3 .codex/skills/fr-status-check/scripts/run.py --config-path .codex/fr-config.json`
- 数据连接：`python3 .codex/skills/fr-db/scripts/run.py list-connections`
- 浏览器复核：`python3 .codex/skills/fr-browser-review/scripts/run.py --config-path .codex/fr-config.json --report-path reportlets/<目标文件>`

## 说明

- 仓库不再保留根目录 `skills/` 镜像，实际发现目录只有 `.codex/skills/`
- 创建报表所需基础模板已内置到 `.codex/skills/fr-create/assets/template/`
- 仓库提供示例配置 `.codex/fr-config.demo.json`，字段名与运行时读取的 `.codex/fr-config.json` 保持一致，可直接作为填写参考
- 示例配置里的 `_comment` 字段仅用于注释说明，运行时不会读取这些字段；真实配置仍建议写到 `.codex/fr-config.json`
- `fr-config.json` 的必填字段是 `decision_url`、`designer_root`、`username`、`password`、`workspace_root`；`remote_root` 默认是 `reportlets`，`task_type` 默认是 `未指定`
- Java bridge 源码保留在 `bridge/src/`，可用 `python3 bridge/scripts/build_bridge.py --project-root .` 本地重建
- `bridge/dist/` 继续作为运行时输入目录，CI 通过 `.github/workflows/build-bridge.yml` 统一产出分发物
- 浏览器复核中，`.cpt` 走 `view/report?viewlet=...`，`.fvs` 走 `view/duchamp?page_number=1&viewlet=...`

## Bridge 授权

- bridge 启动时会先检查 jar 同级目录下的 `fr-remote-bridge.auth`
- 授权文件需要同时满足 MAC 匹配、有效期未过期、签名有效三项条件
- 如果缺少授权文件、MAC 不匹配、授权已过期或签名无效，bridge 会直接返回 `设备 MAC: <当前设备 MAC>，请联系管理员授权`
- 授权文件由 `bridge/scripts/generate_authorization.py` 生成，输入设备 MAC 和授权截止时间，输出固定文件名 `fr-remote-bridge.auth`
- 生成出来的 `fr-remote-bridge.auth` 必须与 `fr-remote-bridge.jar` 放在同一目录
- 如果要使用自己的授权密钥对，构建 bridge 时通过 `--license-public-key-file` 注入公钥，再用对应私钥生成授权文件

```bash
python3 bridge/scripts/build_bridge.py \
  --project-root . \
  --license-public-key-file /path/to/license-public.pem
```

```bash
python3 bridge/scripts/generate_authorization.py \
  --private-key-file /path/to/license-private.pem \
  --output-dir bridge/dist \
  --mac AA:BB:CC:DD:EE:FF \
  --expires-at 2099-01-01T00:00:00Z
```
