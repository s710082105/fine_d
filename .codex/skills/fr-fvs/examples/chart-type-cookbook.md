# FVS Chart Type Cookbook

## Scope

- 用途：按图表类型而不是按样本文件定位 FVS 配置
- 判断顺序：
  1. 先看 `editor.tpl` / `store.json` 里的 `widgetType`、`type`、`groupName`
  2. 再看 `*.chart` 里的 `Plot class`
  3. 组合图看同一个 `*.chart` 是否同时出现多个 `Plot class`

## Quick Map

| 图表类型 | 主要识别点 | 代表样例 |
| --- | --- | --- |
| 折线图 | `Plot class="com.fr.plugin.chart.line.VanChartLinePlot"` | `微信用户分析.fvs`、`reportlets/demo/Phone/chart/折线图-phone.fvs` |
| 柱状图 | `Plot class="com.fr.plugin.chart.column.VanChartColumnPlot"` | `微信用户分析.fvs`、`reportlets/demo/Phone/chart/柱形图-phone.fvs` |
| 饼图 | `Plot class="com.fr.plugin.chart.PiePlot4VanChart"` | `微信用户分析.fvs`、`reportlets/demo/Phone/chart/饼图-phone.fvs` |
| 条形图 | widget `type="d-chart-BAR"`、`groupName="条形图类"` | `reportlets/doc/fvs/advanced/charts/FVS动态轮播条形图.fvs` |
| 面积图 | `Plot class="com.fr.plugin.chart.area.VanChartAreaPlot"` | `reportlets/demo/Phone/chart/面积图-phone.fvs` |
| 仪表盘 | `Plot class="com.fr.plugin.chart.gauge.VanChartGaugePlot"` | `reportlets/demo/Phone/chart/仪表盘-phone.fvs` |
| 地图 | `Plot class="com.fr.plugin.chart.map.VanChartMapPlot"` 或 `VanChartDrillMapPlot` | `reportlets/demo/Phone/chart/地图-phone.fvs` |
| 组合图 | 同一 `.chart` 同时出现多个 `Plot class` | `reportlets/demo/Phone/chart/组合图-phone.fvs` |

## 1. 折线图

远端业务样本 `微信用户分析.fvs` 的一个图表文件就是标准折线图：

```xml
<Chart class="com.fr.plugin.chart.vanchart.VanChart">
  <ChartAttr isJSDraw="true" isStyleGlobal="false"/>
  <Title4VanChart>
    <Title>
      <O><![CDATA[微信用户添加趋势]]></O>
    </Title>
  </Title4VanChart>
  <Plot class="com.fr.plugin.chart.line.VanChartLinePlot">
```

同类样例：

- `reportlets/demo/Phone/chart/折线图-phone.fvs`
- `reportlets/doc/fvs/basic/日期时间控件.fvs`
- `reportlets/doc/fvs/JS/charts/FVS图表实现动态警戒线.fvs`

定位建议：

- 折线图的轴、legend、tooltip 仍然在同一个 `.chart`
- 要调趋势线、点样式、折线平滑，优先从 `VanChartLinePlot` 周边配置开始

## 2. 柱状图

远端 `微信用户分析.fvs` 的“微信用户下单趋势”是标准柱状图：

```xml
<Chart class="com.fr.plugin.chart.vanchart.VanChart">
  <Title4VanChart>
    <Title>
      <O><![CDATA[微信用户下单趋势]]></O>
    </Title>
  </Title4VanChart>
  <Plot class="com.fr.plugin.chart.column.VanChartColumnPlot">
  <VanChartColumnPlotAttr ... />
```

同类样例：

- `reportlets/demo/Phone/chart/柱形图-phone.fvs`
- `reportlets/doc/fvs/basic/FVS查询按钮示例.fvs`
- `reportlets/doc/fvs/basic/FVS查询面板示例.fvs`

补充观察：

- 百分比堆积柱形图、自定义堆积、瀑布图、多坐标轴，在 `柱形图-phone.fvs` 里仍然是 `VanChartColumnPlot`
- 差异主要体现在 `VanChartColumnPlotAttr` 和系列配置，不是换 `Plot class`

## 3. 饼图

远端 `微信用户分析.fvs` 的“微信用户状态分布”是标准饼图：

```xml
<Chart class="com.fr.plugin.chart.vanchart.VanChart">
  <Title4VanChart>
    <Title>
      <O><![CDATA[微信用户状态分布]]></O>
    </Title>
  </Title4VanChart>
  <Plot class="com.fr.plugin.chart.PiePlot4VanChart">
  <PieAttr ... />
```

同类样例：

- `reportlets/demo/Phone/chart/饼图-phone.fvs`
- `reportlets/doc/fvs/advanced/action/FVS组件联动.fvs`
- `reportlets/doc/fvs/JS/others/JavaScript事件实现切换分页.fvs`

补充观察：

- 多层饼图会出现 `com.fr.plugin.chart.multilayer.VanChartMultiPiePlot`
- 饼图页面常与联动、分页、标题点击切换一起出现，适合去 `doc/fvs/JS` 目录找增强交互

## 4. 条形图

条形图和柱状图不要混为一谈。当前仓库里最直接的识别证据在 `editor.tpl` 的 widget JSON：

```json
{
  "type": "d-chart-BAR",
  "displayName": "条形图",
  "widgetType": "chart",
  "groupName": "条形图类",
  "icon": "/assets/widget/BAR.png",
  "props": {
    "stringChartCollection": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>..."
  }
}
```

代表样例：

- `reportlets/doc/fvs/advanced/charts/FVS动态轮播条形图.fvs`
- `reportlets/doc/fvs/JS/charts/FVS图表排序接口.fvs`

当前可确认的结论：

- 条形图在 story/widget 层会明确标记为 `d-chart-BAR`
- 实际图表 XML 被塞在 `props.stringChartCollection` 中
- 也就是说，条形图除了看 `*.chart`，还要看 widget JSON 本身

这里的“条形图通过 widget type 定义方向”是基于样例推断，不是 FineReport 官方声明。

## 5. 面积图

面积图的核心识别点是：

```xml
<Plot class="com.fr.plugin.chart.area.VanChartAreaPlot">
```

代表样例：

- `reportlets/demo/Phone/chart/面积图-phone.fvs`
- `reportlets/demo/Newtheme/销售考勤.fvs`
- `reportlets/demo/analytics/sales/TOP10 员工分析.fvs`

适用结论：

- 面积图和折线图经常在组合图里一起出现
- 若一个页面里同时看到 `VanChartAreaPlot` 和 `VanChartLinePlot`，优先按组合图处理

## 6. 仪表盘

仪表盘识别点：

```xml
<Plot class="com.fr.plugin.chart.gauge.VanChartGaugePlot">
```

代表样例：

- `reportlets/demo/Phone/chart/仪表盘-phone.fvs`
- `reportlets/doc/fvs/phone/银行CEO面板.fvs`
- `reportlets/demo/analytics/financial/应收应付账款图表联动.fvs`

适用结论：

- 仪表盘常与指标卡、数字卡联动出现
- 需要统一主题时，优先联动 `store.json` / `styleConfig`

## 7. 地图

地图常见两种：

```xml
<Plot class="com.fr.plugin.chart.map.VanChartMapPlot">
<Plot class="com.fr.plugin.chart.drillmap.VanChartDrillMapPlot">
```

代表样例：

- `reportlets/demo/Phone/chart/地图-phone.fvs`
- `reportlets/doc/Chart/FVS实现地图钻取与联动.fvs`
- `reportlets/demo/chart/map/巡展地图.fvs`

适用结论：

- 普通地图和钻取地图的区别，先看 `MapPlot` 还是 `DrillMapPlot`
- 地图相关联动和钻取，优先去 `doc/fvs/JS/charts` 和 `doc/Chart`

## 8. 组合图

组合图最容易误判。真正的判断标准不是标题，而是一个 `.chart` 里同时出现多个 `Plot class`。

例如 `reportlets/demo/Phone/chart/组合图-phone.fvs`：

```xml
<Plot class="com.fr.plugin.chart.area.VanChartAreaPlot">
<Plot class="com.fr.plugin.chart.column.VanChartColumnPlot">
<Plot class="com.fr.plugin.chart.custom.VanChartCustomPlot">
```

另一个组合样例：

```xml
<Plot class="com.fr.plugin.chart.column.VanChartColumnPlot">
<Plot class="com.fr.plugin.chart.custom.VanChartCustomPlot">
<Plot class="com.fr.plugin.chart.line.VanChartLinePlot">
```

代表样例：

- `reportlets/demo/Phone/chart/组合图-phone.fvs`
- `reportlets/demo/analytics/financial/01财务：发展能力.fvs`
- `reportlets/demo/analytics/保险数据大屏.fvs`

适用结论：

- 组合图不要只改第一段 `Plot`
- 一定要先数清楚同一 chart 文件里一共有几种 plot

## 9. Common Blocks

无论哪一类图表，下面这些块几乎都会反复出现：

- `Title4VanChart`
- `Legend4VanChart`
- `VanChartAxis`
- `ChartAttr isJSDraw="true" isStyleGlobal="false"`
- `GI / AttrBackground / AttrBorder / AttrAlpha`

所以改图表时建议顺序：

1. 先确认 `Plot class`
2. 再确认标题、背景、边框是不是公共样式问题
3. 最后再进 plot 私有配置

## 10. Search Tips

需要继续扩充图表类型时，用这些关键词搜索最稳：

- `Plot class="com.fr.plugin.chart.line.VanChartLinePlot"`
- `Plot class="com.fr.plugin.chart.column.VanChartColumnPlot"`
- `Plot class="com.fr.plugin.chart.PiePlot4VanChart"`
- `Plot class="com.fr.plugin.chart.area.VanChartAreaPlot"`
- `Plot class="com.fr.plugin.chart.gauge.VanChartGaugePlot"`
- `Plot class="com.fr.plugin.chart.map.VanChartMapPlot"`
- `Plot class="com.fr.plugin.chart.drillmap.VanChartDrillMapPlot"`
- `type":"d-chart-BAR"`
