---
name: fr-fvs
description: 编辑 FineReport FVS 决策报表（数据大屏）模板。支持新增/编辑/删除模块，修改图表配置、模块内容、大小、位置、层级等信息。
---

# FineReport FVS 模板编辑

编辑 FineReport FVS 决策报表模板。FVS 是 ZIP 格式的打包文件。

## 编辑工作流

FVS 是 ZIP 包，所有编辑必须遵循 **解压 → 修改 → 重新打包** 流程。

在开始编辑前，必须先在项目目录执行：

```bash
./.codex/project-sync.sh prepare-edit reportlets/<名称>.fvs
```

这个步骤会先检查远端文件是否存在、是否锁定，并把远端最新内容拉回项目目录。失败时必须立即停止，不能跳过。

使用 `scripts/fvs_helper.py` 提供的辅助函数简化操作：

```python
import sys
sys.path.insert(0, '<skill_dir>/scripts')
from fvs_helper import fvs_extract, fvs_read_store, fvs_write_store, fvs_pack, fvs_list_widgets

# 1. 解压
content_dir = fvs_extract('<原始FVS路径>', '/tmp/fvs_work')

# 2. 读取 store JSON
data, original_content = fvs_read_store(content_dir)

# 3. 查看当前模块
widgets = fvs_list_widgets(data)

# 4. 修改 data（新增/编辑/删除 widget、修改页面等）

# 5. 写回
fvs_write_store(content_dir, data, original_content)

# 6. 打包
fvs_pack(content_dir, '<目标FVS路径>')
```

> `<skill_dir>` 为 `./.codex/skills/fr-fvs`

## FVS 文件结构

```
<name>.fvs (ZIP 压缩包)
├── editor.tpl          — 主模板文件（XML + 内嵌 JSON 布局）
├── info.json           — 资源元数据清单
├── *.chart             — 图表配置文件（XML）
├── *.ec                — 表格组件文件
└── *.png / *.jpg       — 图片资源
```

## 核心编辑操作

### 新增模块（Widget）

```python
import uuid

new_widget = {
    "type": "d-chart-COLUMN",  # 见 references/ 中的类型表
    "widgetType": "chart",
    "displayName": "柱状图",
    "name": "销售柱状图",
    "id": str(uuid.uuid4()),
    "parent": "", "children": [],
    "states": {
        "width": 400, "height": 300,
        "matrix": [1, 0, 0, 1, 100, 100],  # matrix[4]=x, matrix[5]=y
        "animation": {}, "keepRatio": False,
        "top": 0, "left": 0, "opacity": 1,
        "canDragIn": False, "draggable": True,
        "rotatable": True, "resizable": True
    },
    "props": {"configFile": "<uuid>.chart"},
    "hide": False, "lock": False, "opacity": 100,
    "fillType": "background", "backgroundFillType": "auto",
    "border": {"type": "empty"},
    "borderLine": {"borderStyle": "none", "borderWidth": 1, "borderColor": "#ADADADFF"},
    "padding": {"top": 0, "right": 0, "bottom": 0, "left": 0},
    "actions": [], "events": [],
    "$modelType": "duchamp/Widget"
}
data["stories"][0]["widgets"].append(new_widget)
```

同时创建对应的 `.chart` 文件（如果是图表模块）。

### 修改模块位置和大小

```python
for story in data["stories"]:
    for widget in story["widgets"]:
        if widget["name"] == "目标组件名":
            widget["states"]["width"] = 500
            widget["states"]["height"] = 400
            widget["states"]["matrix"][4] = 200  # x
            widget["states"]["matrix"][5] = 150  # y
```

### 修改模块层级

层级由 widgets 数组顺序决定（后面的在上层）：

```python
for story in data["stories"]:
    widgets = story["widgets"]
    for i, w in enumerate(widgets):
        if w["name"] == "目标组件名":
            widgets.append(widgets.pop(i))  # 移到最上层
            break
```

### 删除模块

```python
for story in data["stories"]:
    story["widgets"] = [w for w in story["widgets"] if w["name"] != "要删除的组件名"]
```

### 修改图表配置

图表配置存储在独立的 `.chart` 文件（由 `props.configFile` 引用），直接编辑 XML：
- **图表标题**：`<Title>` → `<O><![CDATA[新标题]]></O>`
- **数据源**：`<TableData>` → `<Name><![CDATA[数据集名]]></Name>`
- **字段绑定**：`<ColumnField>` → `<attr fieldName="字段名"/>`

### 管理页面（Story）

```python
import uuid

# 新增页面
new_story = {
    "name": "新页面", "id": str(uuid.uuid4()),
    "widgets": [], "backgroundFillType": "auto",
    "fillType": "background",
    "transition": {"open": False, "duration": 2000}
}
data["stories"].append(new_story)

# 删除页面
data["stories"] = [s for s in data["stories"] if s["name"] != "要删除的页面"]
```

### 修改数据源

与 CPT 相同，编辑 editor.tpl 中 `<TableDataMap>` 的 `<TableData>` 节点。

## 参考资料

详细的 Widget 类型表、图表 Plot class 映射、.chart XML 结构等，查阅 `references/fvs-structure-reference.md`。

搜索关键词：`Widget` `chart` `Plot` `story` `matrix` `d-chart` `VanChart`

## 注意事项

- **必须先解压再编辑，编辑完重新打包**
- 修改完成后必须在项目目录执行 `git add`、`git commit`，然后等待宿主完成同步与自动浏览器复核
- 进入预览页后如果存在查询按钮、参数面板或其他查询触发条件，必须先执行查询，并确认页面出现实际数据结果，再检查列名、数据和样式
- store JSON 在 XML 属性中用 `&quot;` 转义双引号
- 新增图表模块时需要同时创建 `.chart` 文件和更新 `info.json`
- Widget ID 使用 UUID v4 格式
- 坐标系统：左上角为原点，向右为 x 正方向，向下为 y 正方向
- 默认画布尺寸 1920×1080（可在 `layout` 中修改）
