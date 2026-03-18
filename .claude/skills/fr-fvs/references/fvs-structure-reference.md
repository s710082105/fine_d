# FVS 结构参考

## editor.tpl 结构

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Duchamp xmlVersion="20211223" releaseVersion="11.0.0">
<TableDataMap>
  <!-- 数据源定义，格式同 CPT -->
</TableDataMap>
<DuchampTemplateAttr store="{JSON布局配置}"/>
<FormMobileAttr>...</FormMobileAttr>
<Parameters/>
<DesignerVersion DesignerVersion="LAA"/>
<PreviewType PreviewType="5"/>
</Duchamp>
```

## DuchampTemplateAttr store JSON 结构

`store` 属性包含转义后的 JSON 字符串（`&quot;` 代替 `"`），是 FVS 的核心布局定义：

```json
{
  "stories": [
    {
      "name": "页面名称",
      "id": "uuid",
      "widgets": [ /* 模块/组件列表 */ ],
      "backgroundFillType": "auto",
      "fillType": "background",
      "transition": { "open": false, "duration": 2000 }
    }
  ],
  "fitType": "widthFirst",
  "layout": { "width": 1920, "height": 1080 },
  "compState": {}
}
```

## Widget 完整结构

```json
{
  "type": "d-chart-BAR",
  "widgetType": "chart",
  "displayName": "条形图",
  "name": "组件名称",
  "id": "uuid",
  "parent": "",
  "children": [],
  "states": {
    "width": 400,
    "height": 300,
    "matrix": [1, 0, 0, 1, 100, 200],
    "animation": {},
    "keepRatio": false,
    "top": 0, "left": 0,
    "opacity": 1,
    "canDragIn": false,
    "draggable": true,
    "rotatable": true,
    "resizable": true
  },
  "props": {
    "stringChartCollection": "chart XML 内容",
    "configFile": "uuid.chart"
  },
  "hide": false,
  "lock": false,
  "opacity": 100,
  "fillType": "background",
  "backgroundFillType": "auto",
  "border": { "type": "empty" },
  "borderLine": {
    "borderStyle": "none",
    "borderWidth": 1,
    "borderColor": "#ADADADFF"
  },
  "borderRadius": {
    "format": "whole",
    "topLeft": { "type": "px", "value": 0 },
    "topRight": { "type": "px", "value": 0 },
    "bottomLeft": { "type": "px", "value": 0 },
    "bottomRight": { "type": "px", "value": 0 }
  },
  "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
  "transform3d": { "perspective": 500, "rotateX": 0, "rotateY": 0, "rotateZ": 0 },
  "actions": [],
  "events": [],
  "widgetEvents": [],
  "$modelType": "duchamp/Widget"
}
```

**states.matrix 含义**：CSS transform matrix `[a, b, c, d, tx, ty]`
- `matrix[0]`=scaleX, `matrix[3]`=scaleY（通常为 1）
- `matrix[4]`=translateX（x 坐标，像素）
- `matrix[5]`=translateY（y 坐标，像素）

## 常用 Widget 类型

| type | widgetType | 说明 |
|------|-----------|------|
| `d-chart-BAR` | chart | 条形图 |
| `d-chart-COLUMN` | chart | 柱状图 |
| `d-chart-LINE` | chart | 折线图 |
| `d-chart-AREA` | chart | 面积图 |
| `d-chart-PIE` | chart | 饼图 |
| `d-chart-GAUGE` | chart | 仪表盘 |
| `d-chart-GAUGE_SLOT` | chart | 百分比槽仪表盘 |
| `d-chart-GAUGE_THERMOMETER` | chart | 试管仪表盘 |
| `d-chart-RADAR` | chart | 雷达图 |
| `d-chart-SCATTER` | chart | 散点图 |
| `d-chart-FUNNEL` | chart | 漏斗图 |
| `d-chart-WORD_CLOUD` | chart | 词云 |
| `d-chart-CUSTOM_MAP` | chart | 组合地图 |
| `d-chart-PIE_DIFFERENT_ARC` | chart | 不等弧度玫瑰图 |
| `d-chart-PARTICLE` | chart | 粒子计数器 |
| `d-image` | multiMedia | 图片 |
| `d-text` | text | 文本 |
| `d-table` | table | 表格(ElementCase) |
| `d-report` | report | 报表组件 |
| `d-tab` | tab | 选项卡容器 |

## 图表配置文件（.chart）

图表 XML 根元素为 `<CC>`，核心结构：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CC xmlVersion="20211223" releaseVersion="11.0.0">
<LayoutAttr selectedIndex="0"/>
<ChangeAttr enable="false" changeType="button" timeInterval="5" showArrow="true"/>
<Chart name="默认" chartClass="com.fr.plugin.chart.vanchart.VanChart">
<Chart class="com.fr.plugin.chart.vanchart.VanChart">
  <GI><!-- 全局样式 --></GI>
  <ChartAttr isJSDraw="true" isStyleGlobal="false"/>
  <Title4VanChart>
    <Title>
      <O><![CDATA[图表标题]]></O>
      <TextAttr>
        <Attr alignText="0" themed="false">
          <FRFont name="微软雅黑" style="1" size="128">
            <foreground><FineColor color="-1" hor="-1" ver="-1"/></foreground>
          </FRFont>
        </Attr>
      </TextAttr>
      <TitleVisible value="true" position="2"/>
    </Title>
  </Title4VanChart>
  <Plot class="com.fr.plugin.chart.column.VanChartColumnPlot">
    <!-- 图表类型配置 -->
  </Plot>
  <ChartDataDefinitionProvider>
    <!-- 数据绑定 -->
    <TableData class="com.fr.data.impl.NameTableData">
      <Name><![CDATA[数据集名称]]></Name>
    </TableData>
  </ChartDataDefinitionProvider>
</Chart>
</Chart>
</CC>
```

## 常用 Plot class

| 图表类型 | Plot class |
|---------|-----------|
| 柱形图 | `com.fr.plugin.chart.column.VanChartColumnPlot` |
| 条形图 | `com.fr.plugin.chart.bar.VanChartBarPlot` |
| 折线图 | `com.fr.plugin.chart.line.VanChartLinePlot` |
| 面积图 | `com.fr.plugin.chart.area.VanChartAreaPlot` |
| 饼图 | `com.fr.plugin.chart.pie.VanChartPiePlot` |
| 雷达图 | `com.fr.plugin.chart.radar.VanChartRadarPlot` |
| 散点图 | `com.fr.plugin.chart.scatter.VanChartScatterPlot` |
| 仪表盘 | `com.fr.plugin.chart.gauge.VanChartGaugePlot` |
| 漏斗图 | `com.fr.plugin.chart.funnel.VanChartFunnelPlot` |
| 词云 | `com.fr.plugin.chart.wordcloud.VanChartWordCloudPlot` |
| 地图 | `com.fr.plugin.chart.map.VanChartMapPlot` |
