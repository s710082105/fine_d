# FineReport 远程设计协议与文件桥接

## 文档目的

这份文档用于沉淀当前仓库已经验证过的 FineReport 远程设计协议研究结果，方便后续继续做：

- 远程 `reportlets` 文件列表、下载、上传
- 报表模板自动生成后直接写回服务器
- 协议继续逆向
- 后续评估是否要改成纯 Python 实现

本文只记录已经取证或已经实测通过的内容，不写猜测性结论。

## 当前结论

当前最稳的实现路径不是手写 FineReport 私有协议，而是：

1. Python 作为外部统一入口
2. JVM helper 复用 FineReport 官方 jars
3. JVM helper 内部通过 `FineWorkspaceConnector` 建立远程设计连接
4. 通过 `FileNodes` / `WorkResource` 完成列表、读取、写入

这条链路已经在本地测试服务 `http://localhost:8075/webroot/decision` 上跑通。

## 已确认的接口分层

### 1. Decision 普通 REST

普通登录可以直接走：

- `POST /webroot/decision/login`

当前实例已验证明文 JSON 登录可用：

```json
{
  "username": "admin",
  "password": "admin",
  "validity": -1,
  "sliderToken": "",
  "origin": "",
  "encrypted": false
}
```

成功后会返回 `accessToken`，Bearer token 可访问：

- `GET /webroot/decision/v10/config/login`
- `GET /webroot/decision/v10/templates/all`

`/v10/templates/all` 已实测能列出 `reportlets` 下模板，但它不能替代原始 `.cpt` 上传下载。

### 2. 远程设计私有入口

远程设计实际走的是 `remote/design/*`：

- `/remote/design/version`
- `/remote/design/check`
- `/remote/design/main/version`
- `/remote/design/verify`
- `/remote/design/record`
- `/remote/design/service`
- `/remote/design/channel`
- `/remote/design/logout`

其中真正的 RPC 通道是：

- `POST /remote/design/channel`

服务端会从 header 取 `token`、`username`，请求体是二进制 RPC 包，再直接交给 `WorkContext.handleMessage(bytes)`。

## 协议研究结论

### 1. `/verify` 不是普通表单认证

服务端 `RemoteDesignService.saferGetRemoteToken()` 已确认会做：

1. 读取 `username`
2. 通过 `TransmissionEncryptors` 解密 `password`
3. 校验 `mainVersion`
4. 调 `AuthenticController.doAuthentication(...)`
5. 生成 remote design token

`/check` 返回的关键字段：

- `frontSeed`
- `frontSM4Key`
- `transmissionEncryption`
- `encryptionType`
- `encryptionKey`

当前本地实例返回了 `encryptionKey`，说明客户端不能简单明文提交密码。

### 2. `channel` 请求体是 FineReport 自定义 RPC

客户端内部链路已确认是：

1. 组装 `Invocation`
2. 写入 metadata：`username`、`id`、`token`、`ip`
3. 使用 `SafeInvocationSerializer`
4. 再套 `GZipSerializerWrapper`
5. 发往 `/remote/design/channel`
6. 响应通过 `ResultSerializer` + gzip 反序列化

相关类：

- `com.fr.rpc.Invocation`
- `com.fr.rpc.Result`
- `com.fr.rpc.serialization.InvocationSerializer`
- `com.fr.rpc.serialization.SafeInvocationSerializer`
- `com.fr.rpc.serialization.ResultSerializer`
- `com.fr.serialization.GZipSerializerWrapper`
- `com.fr.workspace.engine.rpc.WorkspaceInvoker`

### 3. 对象流格式不是 JSON

`InvocationSerializer` / `ResultSerializer` 实际格式是 `ObjectOutputStream` 对象流，不是 HTTP JSON。

`Invocation` 部分包含：

- `InvocationPack`
  - `declaringClassName`
  - `methodName`
  - `parameterTypes`
  - `paramsBytes[][]`
- `metadata map`

这意味着纯 Python 要兼容的不只是 URL 和 header，还要兼容 Java 对象流包格式、mark serializer 和安全序列化逻辑。

## 为什么最初 Java 客户端会失败

直接调用 `FineWorkspaceConnector.connect(...)` 时，最初失败过，核心报错有两个：

1. `designer version is null`
2. `SerializerNotFoundException`

根因已经确认：

- `WorkContext.version` 默认没有初始化
- `SerializerSummary.INSTANCE` 默认也没有补全注册

只要在连接前补这两步，官方客户端链路就能打通：

```java
SerializerSummary.getDefault().complete();
WorkContext.setVersion(GeneralUtils.readBuildNO());
```

这是当前桥接实现里最关键的初始化动作。

## 当前已验证通过的官方客户端路径

JVM helper 现在走的是：

1. `WorkspaceConnectionInfo`
2. `FineWorkspaceConnector.connect(info)`
3. `client.getPool().get(FileNodes.class)`
4. `client.getPool().get(WorkResource.class)`

已实测：

- `FileNodes.list("reportlets")` 可列远程模板
- `WorkResource.readFully(path)` 可下载远程 `.cpt`
- `WorkResource.save(temp, target, bytes)` 可覆盖写回远程 `.cpt`

对应实现文件：

- [Main.java](/Users/wj/data/mcp/finereport/bridge/src/fine/remote/bridge/Main.java)
- [FineRuntime.java](/Users/wj/data/mcp/finereport/bridge/src/fine/remote/bridge/FineRuntime.java)
- [build_bridge.py](/Users/wj/data/mcp/finereport/bridge/scripts/build_bridge.py)
- [runner.py](/Users/wj/data/mcp/finereport/tooling/fr_runtime/bridge/runner.py)

## 当前桥接层职责

### Python 层

Python 只负责：

- 暴露统一 API
- 组装调用参数
- 调用 `java -jar bridge/dist/fr-remote-bridge.jar`
- 读取 bridge 输出的 JSON

### JVM 层

JVM helper 负责：

- 补齐 FineReport 客户端初始化
- 建立远程设计连接
- 调用 `FileNodes` / `WorkResource`
- 将结果转换成稳定 JSON

当前支持命令：

- `list`
- `read`
- `write`

## 当前 Python API

```python
from pathlib import Path
from tooling.fr_runtime.bridge.runner import BridgeRunner, ConfiguredBridgeRunner

runner = ConfiguredBridgeRunner(
    runner=BridgeRunner(
        java_path=Path("/Applications/FineReport/Contents/runtime/Contents/Home/bin/java"),
        jar_path=Path("bridge/dist/fr-remote-bridge.jar"),
    ),
    fine_home=Path("/Applications/FineReport"),
    base_url="http://localhost:8075/webroot/decision",
    username="admin",
    password="admin",
)

entries = runner.invoke("list", {"path": "reportlets"})
content = runner.invoke("read", {"path": "reportlets/微信用户列表.cpt"})
runner.invoke("write", {"path": "reportlets/微信用户列表.cpt", "inputBase64": content["contentBase64"]})
```

主要文件：

- [runner.py](/Users/wj/data/mcp/finereport/tooling/fr_runtime/bridge/runner.py)
- [cli.py](/Users/wj/data/mcp/finereport/tooling/fr_runtime/cli.py)
- [FineRuntime.java](/Users/wj/data/mcp/finereport/bridge/src/fine/remote/bridge/FineRuntime.java)

## 已完成验证

### 1. 集成测试

测试文件：

- [tests/test_fine_remote_client.py](/Users/wj/data/mcp/finereport/tests/test_fine_remote_client.py)

验证命令：

```bash
PYTHONPATH=python python3 -m unittest -v tests.test_fine_remote_client
```

已通过的场景：

- 远程 `reportlets` 列表
- 远程模板下载
- 同内容回写远程模板

### 2. 真实模板修改

已通过桥接层实际修改过远程模板：

- `WorkBook1.cpt`
- `订单详情列表.cpt`

其中 `订单详情列表.cpt` 已基于 `qzcs.t_order_details` 真实库字段生成并写回远程 `reportlets`。

本地模板文件：

- [reportlets/订单详情列表.cpt](/Users/wj/data/mcp/finereport/reportlets/订单详情列表.cpt)

## 纯 Python 方案评估

### 可以做，但当前不建议直接切

原因不是 Python 不行，而是当前还没有一个低成本、低漂移的纯 Python 协议实现。

如果要做纯 Python，需要继续完成：

1. `/check -> /verify` 认证加密分支重写
2. `Invocation` / `Result` 对象流序列化兼容
3. `SafeInvocationSerializer` 兼容
4. `SerializerSummary` mark 体系复刻
5. `GZipSerializerWrapper` 包装兼容
6. 心跳、连接上下文、metadata 注入兼容

### 当前推荐策略

短期推荐：

- 继续保留 `Python + JVM helper`
- 让 Java 完全隐藏在 Python API 后面
- 运维只面对 Python 入口，不直接接触协议细节

中期如果必须去掉 Java，再按下面顺序推进：

1. 先把 `/verify` 纯 Python 跑通
2. 再做 `Invocation` 编码和 `Result` 解码
3. 再替换 `list/read/write`
4. 最后再评估是否移除 JVM helper

## 后续开发建议

后续继续开发远程模板能力时，优先遵循以下顺序：

1. 优先复用现成 `.cpt` 样板生成报表
2. 先用真实库跑 SQL，再写模板
3. 先本地生成 `.cpt`，做 XML 校验
4. 再通过 `FineRemoteClient.write_file()` 写回远程
5. 写回后必须再回读校验关键内容

不要直接重新手写 `remote/design/channel` 协议，除非任务目标就是继续做协议逆向。

## 关联文档

- [README.md](/Users/wj/data/mcp/finereport/README.md)
- [docs/superpowers/plans/2026-03-21-fine-remote-python-bridge.md](/Users/wj/data/mcp/finereport/docs/superpowers/plans/2026-03-21-fine-remote-python-bridge.md)
