# GitHub CI Windows ARM Build Design

## Goal

为 `finereport` 增加一条基于 GitHub Actions 的 Windows ARM64 打包链路，在不影响现有 `origin` 远程和本地构建脚本的前提下，能够在 GitHub 上直接产出可下载的 Tauri 安装包 artifact。

## Scope

- 保留现有 `origin`，新增 `github` 远程指向 `git@github.com:s710082105/fine_d.git`
- 新增 GitHub Actions workflow
- 目标平台限定为 `windows-11-arm`
- 先上传 Actions artifact，不自动创建 release

## Architecture

GitHub 仓库作为独立 CI 执行端，接收当前仓库代码后在 `windows-11-arm` hosted runner 上执行标准 Tauri 构建流程。Workflow 使用现有仓库脚本约定：Node + pnpm、Rust stable、`aarch64-pc-windows-msvc` 目标，然后执行 `pnpm test`、`cargo test` 与 `pnpm tauri build --target aarch64-pc-windows-msvc`。

为降低首版链路复杂度，CI 不接入签名、不创建 release、不做多平台矩阵。构建成功后只上传 `src-tauri/target/aarch64-pc-windows-msvc/release/bundle/**`，保证用户能尽快拿到 Windows ARM 安装包。

## Workflow Design

触发方式：

- `workflow_dispatch`
- `push` 到 `main`

关键步骤：

1. `actions/checkout@v4`
2. `actions/setup-node@v4`，Node 22，pnpm cache
3. `corepack enable`
4. `dtolnay/rust-toolchain@stable`，附带 `aarch64-pc-windows-msvc`
5. `swatinem/rust-cache@v2`
6. `pnpm install --frozen-lockfile`
7. `pnpm test`
8. `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
9. `pnpm tauri build --target aarch64-pc-windows-msvc`
10. `actions/upload-artifact@v4`

## Constraints

- 不改现有阿里云远程
- 不引入 silent fallback
- 构建失败必须在 GitHub Actions 日志中直接暴露
- workflow 文件保持独立，避免和本地 Windows 构建脚本强耦合

## Verification

- 本地验证 workflow YAML 结构和引用路径
- 本地确认远程新增为 `github`
- 真正的构建验证以 GitHub Actions 首次运行结果为准
