# FineRemote Python Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供 Python API，复用 FineReport 官方远程设计协议实现远程文件列表、下载、上传。

**Architecture:** Python 负责命令编排、编译 JVM helper、解析 JSON 输出。JVM helper 负责做 FineReport 客户端初始化并通过 `FineWorkspaceConnector` 调用 `FileNodes` 和 `WorkResource`。

**Tech Stack:** Python 3、Java、FineReport 自带 jars、`unittest`

---

### Task 1: 定义 Python 集成测试契约

**Files:**
- Create: `tests/__init__.py`
- Create: `tests/test_fine_remote_client.py`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Commit**

### Task 2: 实现 JVM helper

**Files:**
- Create: `java/fine_remote/FrRemoteBridge.java`

- [ ] **Step 1: 补齐官方连接初始化**
- [ ] **Step 2: 实现 `list/read/write` JSON 命令**
- [ ] **Step 3: 用本地测试服务验证**

### Task 3: 实现 Python 封装

**Files:**
- Create: `python/fine_remote/__init__.py`
- Create: `python/fine_remote/client.py`
- Create: `python/fine_remote/jvm.py`

- [ ] **Step 1: 编译并缓存 JVM helper**
- [ ] **Step 2: 封装 `list_files/read_file/write_file`**
- [ ] **Step 3: 运行全部测试并验证通过**
