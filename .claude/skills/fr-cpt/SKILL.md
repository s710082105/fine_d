---
name: fr-cpt
description: 编辑 FineReport CPT 普通报表模板。支持设置筛选参数、数据列、列宽、行高、边框、颜色、公式、样式等全部配置。
---

# FineReport CPT 模板编辑

编辑 FineReport CPT 模板文件。CPT 是纯 XML 格式，根元素为 `<WorkBook>`。

## 编辑工作流

1. 用 `Read` 工具读取目标 CPT 文件（XML 纯文本）
2. 分析当前结构，定位需要修改的节点
3. 用 `Edit` 工具进行精确的 XML 修改
4. 修改完成后汇报变更内容

## XML 结构总览

```
<WorkBook>
  ├── <TableDataMap>           — 数据源定义
  ├── <Report name="sheet1">   — 报表 Sheet
  │   ├── <RowHeight>          — 行高（EMU，逗号分隔）
  │   ├── <ColumnWidth>        — 列宽（EMU，逗号分隔）
  │   └── <CellElementList>    — 单元格列表
  ├── <ReportParameterAttr>    — 参数面板
  └── <StyleList>              — 样式列表（按索引引用）
```

## 常见编辑场景

**场景 A：添加一列数据** — 在 `<CellElementList>` 新增表头和数据 `<C>`，`<ColumnWidth>` 追加列宽，需要新样式时在 `<StyleList>` 追加。

**场景 B：添加参数筛选** — SQL 中加 `${参数名}` 条件 → `<Parameters>` 加参数定义 → `<ReportParameterAttr>` 加控件和默认值。

**场景 C：设置行高/列宽** — 修改 `<RowHeight>` 或 `<ColumnWidth>` 的 CDATA 值（EMU 逗号分隔列表）。

**场景 D：修改样式** — 找到单元格 `s` 属性对应的样式索引 → 在 `<StyleList>` 修改或新增 `<Style>`。

**场景 E：条件属性（条件高亮）** — 在 `<C>` 单元格内添加 `<HighlightList>`，根据单元格值动态改变背景色/字体色。详见 `references/cpt-xml-reference.md` 第 5 节。

## 参考资料

详细的 XML 结构、单元格类型、样式属性、参数控件等参考信息，查阅 `references/cpt-xml-reference.md`。

搜索关键词：`单元格` `DSColumn` `StyleList` `参数` `ComboBox` `Border` `FRFont` `颜色` `EMU`

## 注意事项

- CPT 文件是纯文本 XML，直接用 Read/Edit 操作
- 修改单元格前先确认行列索引和样式索引
- 新增列时同步更新 ColumnWidth
- 每个参数控件需同时在 ParameterUI 和 Parameter 节点定义
- 颜色值使用 Java 负整数格式：`-(0xFF000000 | (R << 16) | (G << 8) | B)`
- **禁止公式自引用**：公式单元格不能引用自身坐标（如 O3 单元格不能用 `value(O3)`），否则会导致死循环。需要转换显示的字段（如状态码→中文），优先在 SQL 中用 CASE/IF 完成转换
- **列宽换算**：FineReport 设计器列宽与 EMU 的关系为 `EMU = 1440000 + designer_width × 144000`，详见 `references/cpt-xml-reference.md`
- **样式索引不稳定**：FineReport 设计器保存时会重排 StyleList 顺序。修改样式前必须先读取文件，确认单元格的 `s` 属性实际指向哪个 Style 索引，再修改对应索引的内容。不能假设索引固定不变
