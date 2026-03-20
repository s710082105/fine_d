# Runtime Resources (Deprecated)

`bundled runtime` 方案已被 `system runtime installer` 方案替代。

当前产品主流程不再依赖本目录中的 `node/python/codex` 资源，软件会直接检查系统环境，并要求用户手动执行：

- `scripts/install-runtime-macos.sh`
- `scripts/install-runtime-windows.cmd`
- `scripts/install-runtime-windows.ps1`

其中 Windows 正式入口是 `.cmd` 包装脚本，`.ps1` 由 `.cmd` 以 `ExecutionPolicy Bypass` 方式调用。

保留此目录仅用于历史文档兼容，不再作为正式运行时入口。
