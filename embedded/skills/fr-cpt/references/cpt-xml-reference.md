# CPT XML 结构参考

## 1. 数据源（TableDataMap）

**添加数据库查询数据集**：
```xml
<TableData name="ds1" class="com.fr.data.impl.DBTableData">
<Desensitizations desensitizeOpen="false"/>
<Parameters>
<Parameter>
<Attributes name="参数名"/>
<O><![CDATA[默认值]]></O>
</Parameter>
</Parameters>
<Attributes maxMemRowCount="-1"/>
<Connection class="com.fr.data.impl.NameDatabaseConnection">
<DatabaseName><![CDATA[数据连接名]]></DatabaseName>
</Connection>
<Query><![CDATA[SELECT col1, col2 FROM table1 WHERE region = '${参数名}']]></Query>
<PageQuery><![CDATA[]]></PageQuery>
</TableData>
```

**FineReport 参数语法**：
- 普通参数：`${参数名}` — 直接嵌入 SQL
- 多值参数：`${参数名}` 配合 `IN (${参数名})`
- 动态条件：`${if(len(参数名) > 0, "AND col = '" + 参数名 + "'", "")}`

## 2. 单元格（CellElementList）

**单元格属性**：
- `c` — 列索引（0-based）
- `r` — 行索引（0-based）
- `cs` — 列合并数（colspan，默认1可省略）
- `rs` — 行合并数（rowspan，默认1可省略）
- `s` — 样式索引（对应 StyleList 中的顺序，从0开始）

**静态文本单元格**（标题/表头）：
```xml
<C c="0" r="0" cs="6" s="0">
<O><![CDATA[报表标题]]></O>
<PrivilegeControl/>
<Expand/>
</C>
```

**数据列单元格**（绑定数据集字段）：
```xml
<C c="0" r="1" s="1">
<O t="DSColumn">
<Attributes dsName="ds1" columnName="字段名"/>
<Complex/>
<RG class="com.fr.report.cell.cellattr.core.group.FunctionGrouper">
<Attr divideMode="1"/>
</RG>
<Result><![CDATA[$$$]]></Result>
<Parameters/>
</O>
<PrivilegeControl/>
<CellGUIAttr/>
<CellPageAttr/>
<Expand dir="0"/>
</C>
```

**展开方向 Expand**：
- `dir="0"` — 纵向展开（明细报表常用）
- `dir="1"` — 横向展开（交叉报表列维度）
- 无 dir 或 `<Expand/>` — 不展开

**公式单元格**：
```xml
<C c="0" r="2" s="2">
<O t="XMLable" class="com.fr.base.Formula">
<Attributes><![CDATA[=SUM(C2)]]></Attributes>
</O>
<PrivilegeControl/>
<Expand/>
</C>
```

**汇总单元格**（数据集汇总）：
```xml
<C c="2" r="3" s="2">
<O t="DSColumn">
<Attributes dsName="ds1" columnName="销量"/>
<Complex/>
<RG class="com.fr.report.cell.cellattr.core.group.SummaryGrouper">
<FN><![CDATA[com.fr.data.util.function.SumFunction]]></FN>
</RG>
<Result><![CDATA[$$$]]></Result>
<Parameters/>
</O>
<Expand dir="0"/>
</C>
```

汇总函数可选值：
- `com.fr.data.util.function.SumFunction` — 求和
- `com.fr.data.util.function.CountFunction` — 计数
- `com.fr.data.util.function.AverageFunction` — 平均
- `com.fr.data.util.function.MaxFunction` — 最大值
- `com.fr.data.util.function.MinFunction` — 最小值

## 3. 行高和列宽

**单位：EMU（English Metric Unit）**

| 常用尺寸 | EMU 值 |
|----------|--------|
| 1mm | 36000 |
| 1cm | 360000 |
| 1pt | 12700 |
| 1inch | 914400 |
| 默认行高(~20mm) | 723900 |
| 默认列宽(~76mm) | 2743200 |

**FineReport 设计器列宽与 EMU 换算**：

`EMU = 1440000 + designer_width × 144000`（即 `(designer_width + 10) × 144000`）

| 设计器宽度 | EMU 值 | 适用场景 |
|-----------|--------|----------|
| 2.5 | 1800000 | 短文本（商户、渠道、操作员等） |
| ~4.6 | 1100000 | 极短文本（票数） |
| 10 | 2880000 | 中等文本（订单号） |
| 20 | 4320000 | 较长文本（项目名称） |
| 30 | 5760000 | 长文本（场次名称） |
| 40 | 7200000 | 超长文本（时间+描述） |

**实际列宽参考（订单列表报表）**：
- 订单号/ID 类：2880000（设计器宽度10）
- 名称/描述类：4320000-5760000（设计器宽度20-30）
- 日期时间类：7200000（设计器宽度40）
- 短文本（姓名/渠道/商户）：1800000（设计器宽度2.5）
- 手机号：1800000
- 数字（票数/金额）：1100000-1500000
- 状态标签：1500000

**格式**：逗号分隔的列表，按行/列顺序排列
```xml
<RowHeight defaultValue="723900">
<![CDATA[1080000,900000,723900]]></RowHeight>
<ColumnWidth defaultValue="2743200">
<![CDATA[2880000,4320000,5760000,7200000,1800000]]></ColumnWidth>
```

**像素到 EMU 转换**（96dpi）：像素 × 9525 = EMU

## 4. 样式（StyleList）

样式通过索引被单元格的 `s` 属性引用。新增样式追加到 `<StyleList>` 末尾，索引自动递增。

**注意**：FineReport 设计器保存时会重排样式索引顺序。修改样式前必须先读取文件，确认单元格的 `s` 属性实际指向哪个 Style 索引，再修改对应索引的内容。不能假设索引固定不变。

**完整样式结构**：
```xml
<Style horizontal_alignment="0" imageLayout="1">
<FRFont name="SimSun" style="1" size="120">
<foreground>
<FineColor color="-1" hor="-1" ver="-1"/>
</foreground>
</FRFont>
<Background name="ColorBackground">
<color>
<FineColor color="-1577999" hor="-1" ver="-1"/>
</color>
</Background>
<Border>
<Top style="1" color="-6697729"/>
<Bottom style="1" color="-6697729"/>
<Left style="1" color="-6697729"/>
<Right style="1" color="-6697729"/>
</Border>
</Style>
```

**horizontal_alignment 水平对齐**（Java Swing 常量）：`0`=居中，`2`=左对齐，`4`=右对齐
**FRFont.style 字体样式**：`0`=正常，`1`=粗体，`2`=斜体，`3`=粗斜体
**FRFont.size 字号**：以 1/10 pt 为单位，如 `72`=7.2pt, `120`=12pt, `144`=14.4pt
**Border.style 边框**：`0`=无，`1`=细实线，`2`=双线，`3`=点线，`4`=虚线
**Background.name**：`NullBackground`=透明，`ColorBackground`=纯色

**颜色值**：Java 负整数 RGB 值
- 黑色：`-16777216` (0xFF000000)
- 白色：`-1`
- 红色：`-65536` (0xFFFF0000)
- 蓝色：`-16776961` (0xFF0000FF)
- 浅蓝：`-1577999`
- 灰色边框：`-6697729`
- **转换公式**（已验证正确）：`color = -(0xFF000000 | (R << 16) | (G << 8) | B)`
  等价 Python：`int.from_bytes(bytes([0xFF, R, G, B]), 'big', signed=True)`
  例如 RGB(51,122,183) → `-(0xFF337AB7)` = `-13403977`
  例如 RGB(255,0,0) 红色 → `-65536`，RGB(0,128,0) 绿色 → `-16744448`

## 5. 条件属性（HighlightList）

条件属性用于根据单元格值动态改变样式（背景色、字体色等）。`<HighlightList>` 放在 `<C>` 单元格内部，与 `<Expand>` 同级。

**结构**：
```xml
<C c="0" r="2" s="1">
<O t="DSColumn">...</O>
<PrivilegeControl/>
<HighlightList>
<Highlight class="com.fr.report.cell.cellattr.highlight.DefaultHighlight">
<Name><![CDATA[条件属性1]]></Name>
<Condition class="com.fr.data.condition.ObjectCondition">
<Compare op="0">
<O><![CDATA[匹配值]]></O>
</Compare>
</Condition>
<HighlightAction class="com.fr.report.cell.cellattr.highlight.BackgroundHighlightAction">
<Background name="ColorBackground">
<color>
<FineColor color="-10243346" hor="0" ver="0"/>
</color>
</Background>
</HighlightAction>
</Highlight>
</HighlightList>
<Expand dir="0"/>
</C>
```

**Compare op 比较运算符**：
| op | 含义 |
|----|------|
| `0` | 等于 |
| `1` | 不等于 |
| `2` | 大于 |
| `3` | 大于等于 |
| `4` | 小于 |
| `5` | 小于等于 |

**HighlightAction 可用类型**：

| class | 说明 | 内部结构 |
|-------|------|---------|
| `BackgroundHighlightAction` | 修改背景色 | `<Background name="ColorBackground"><color><FineColor .../></color></Background>` |
| `ForegroundHighlightAction` | 修改字体前景色 | `<Foreground><color><FineColor .../></color></Foreground>` |

> **注意**：`<FineColor>` 必须包裹在 `<color>` 元素内，否则不生效。

**示例：支付状态列字体颜色条件高亮**（已验证生效）：
```xml
<HighlightList>
<!-- 已支付 → 绿色字体 -->
<Highlight class="com.fr.report.cell.cellattr.highlight.DefaultHighlight">
<Name><![CDATA[已支付绿色]]></Name>
<Condition class="com.fr.data.condition.ObjectCondition">
<Compare op="0">
<O><![CDATA[已支付]]></O>
</Compare>
</Condition>
<HighlightAction class="com.fr.report.cell.cellattr.highlight.ForegroundHighlightAction">
<Foreground>
<color>
<FineColor color="-16744448" hor="-1" ver="-1"/>
</color>
</Foreground>
</HighlightAction>
</Highlight>
<!-- 非已支付 → 红色字体 -->
<Highlight class="com.fr.report.cell.cellattr.highlight.DefaultHighlight">
<Name><![CDATA[待支付红色]]></Name>
<Condition class="com.fr.data.condition.ObjectCondition">
<Compare op="1">
<O><![CDATA[已支付]]></O>
</Compare>
</Condition>
<HighlightAction class="com.fr.report.cell.cellattr.highlight.ForegroundHighlightAction">
<Foreground>
<color>
<FineColor color="-65536" hor="-1" ver="-1"/>
</color>
</Foreground>
</HighlightAction>
</Highlight>
</HighlightList>
```

**示例：退款状态列背景色条件高亮**：

一个单元格可包含多个 `<Highlight>`，按顺序匹配，多个条件可同时生效。

## 6. 参数面板（ReportParameterAttr）

**参数面板结构**：
```xml
<ReportParameterAttr>
<Attributes showWindow="true" delayPlaying="true" windowPosition="1" align="0"/>
<PWTitle><![CDATA[参数]]></PWTitle>
<ParameterUI class="com.fr.form.main.parameter.FormParameterUI">
<Parameters/>
<Layout class="com.fr.form.ui.container.WParameterLayout">
<WidgetName name="para"/>
<WidgetAttr description="">
<PrivilegeControl/>
</WidgetAttr>
<Margin top="1" left="1" bottom="1" right="1"/>
<Border>
<border style="0" color="-723724" borderRadius="0" type="0" borderStyle="0"/>
</Border>
<Background name="ColorBackground" color="-526086"/>
<LCAttr vgap="0" hgap="0" compInterval="0"/>

<!-- 控件放这里 -->

<Display display="true"/>
<DelayDisplayContent delay="true"/>
<Position position="0"/>
<Design_Width design_width="960"/>
</Layout>
<DesignAttr width="960" height="80"/>
</ParameterUI>

<!-- 参数默认值定义 -->
<Parameter>
<Attributes name="参数名"/>
<O><![CDATA[默认值]]></O>
</Parameter>
</ReportParameterAttr>
```

**可用控件类型**：

| 类名 | 控件 | 说明 |
|-------|------|------|
| `com.fr.form.ui.TextEditor` | 文本输入框 | 普通文本输入 |
| `com.fr.form.ui.ComboBox` | 下拉框 | 单选下拉 |
| `com.fr.form.ui.ComboCheckBox` | 复选下拉框 | 多选下拉 |
| `com.fr.form.ui.DateEditor` | 日期控件 | 日期选择 |
| `com.fr.form.ui.NumberEditor` | 数值输入框 | 数值输入 |
| `com.fr.form.ui.RadioGroup` | 单选按钮组 | 单选 |
| `com.fr.form.ui.CheckBoxGroup` | 复选按钮组 | 多选 |
| `com.fr.form.ui.Label` | 标签 | 静态文本 |
| `com.fr.form.parameter.FormSubmitButton` | 查询按钮 | 提交参数查询 |

**控件容器格式**：
```xml
<!-- 标签 -->
<Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
<InnerWidget class="com.fr.form.ui.Label">
<WidgetName name="label1"/>
<WidgetAttr description=""/>
<LabelAttr textalign="0" autoline="true" verticalcenter="true"/>
<widgetValue>
<O><![CDATA[地区:]]></O>
</widgetValue>
</InnerWidget>
<BoundsAttr x="50" y="25" width="80" height="21"/>
</Widget>

<!-- 下拉框 -->
<Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
<InnerWidget class="com.fr.form.ui.ComboBox">
<WidgetName name="地区"/>
<WidgetAttr description=""/>
<Dictionary class="com.fr.data.impl.TableDataDictionary">
<FormulaDictAttr ki="0" vi="0"/>
<TableDataDictAttr>
<TableData class="com.fr.data.impl.NameTableData">
<Name><![CDATA[ds1]]></Name>
</TableData>
</TableDataDictAttr>
</Dictionary>
<widgetValue>
<O><![CDATA[华北]]></O>
</widgetValue>
</InnerWidget>
<BoundsAttr x="130" y="25" width="120" height="21"/>
</Widget>

<!-- 日期控件 -->
<Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
<InnerWidget class="com.fr.form.ui.DateEditor">
<WidgetName name="开始日期"/>
<WidgetAttr description=""/>
<DateAttr format="yyyy-MM-dd"/>
<widgetValue>
<O t="XMLable" class="com.fr.base.Formula">
<Attributes><![CDATA[=NOW()]]></Attributes>
</O>
</widgetValue>
</InnerWidget>
<BoundsAttr x="550" y="25" width="120" height="21"/>
</Widget>

<!-- 查询按钮 -->
<Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
<InnerWidget class="com.fr.form.parameter.FormSubmitButton">
<WidgetName name="query"/>
<WidgetAttr description=""/>
<Text><![CDATA[查询]]></Text>
<Hotkeys><![CDATA[enter]]></Hotkeys>
</InnerWidget>
<BoundsAttr x="750" y="25" width="80" height="21"/>
</Widget>
```

**BoundsAttr 定位**：`x` 和 `y` 为像素坐标，`width` 和 `height` 为像素尺寸。
