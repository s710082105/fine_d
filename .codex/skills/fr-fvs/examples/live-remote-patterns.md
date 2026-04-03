# FVS Live Remote Patterns

## Scope

- 取样时间：2026-04-03
- 联调环境：`http://192.168.0.99:8075/webroot/decision`
- 远端顶层大屏：`微信用户分析.fvs`、`第一张FVS模板.fvs`、`Template1.fvs`
- 目的：把 FVS 的真实落盘结构固定下来，后续改页面、主题、图表、边框时直接照结构定位

## Sample Map

| 远端样本 | 适用场景 | 可直接参考的块 |
| --- | --- | --- |
| `微信用户分析.fvs` | 业务分析大屏 | `editor.tpl` 数据集、story 背景、chart 资源拆分 |
| `第一张FVS模板.fvs` | 花式模板页 | 图片边框、chart + text 混排、`.ec` 组件嵌入 |
| `Template1.fvs` | 纯主题底板 | `store.json`、主题色板、全局图表样式、controller 配置 |

## 1. Archive Anatomy

远端 FVS 都是 zip 包，不是单 XML 文件。常见结构如下：

| 文件 | 作用 |
| --- | --- |
| `editor.tpl` | 主入口，含数据集和 HTML 转义后的 `store` JSON |
| `store.json` | 部分模板额外保存的展开版页面状态 |
| `*.chart` | 图表组件 XML，标题、配色、tooltip、series 都在这里 |
| `*.ec` | 元素案例组件，常见于内嵌表格/明细块 |
| `__from__reuse__/...` | 模板复用的边框图或背景图 |
| `info.json` | 常为空对象 |

实际判断顺序：

1. 先看 `editor.tpl` 里的 `TableDataMap`
2. 再看 `DuchampTemplateAttr store="..."` 里的 story / widget / theme
3. 图表改动去 `*.chart`
4. 内嵌表格或复杂卡片去 `*.ec`

## 2. 业务分析页：`微信用户分析.fvs`

### 数据集都在 `editor.tpl`

这个样本把 3 个业务图表的数据集都放在 `editor.tpl` 的 `TableDataMap` 里：

```xml
<TableData name="ds_user_add_trend" class="com.fr.data.impl.DBTableData">
  <Connection class="com.fr.data.impl.NameDatabaseConnection">
    <DatabaseName><![CDATA[test]]></DatabaseName>
  </Connection>
  <Query><![CDATA[
SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS 日期,
       COUNT(*) AS 数量,
       '新增用户' AS 类别
FROM wx_users
WHERE created_at IS NOT NULL
  AND deleted_at IS NULL
GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d')
  ]]></Query>
</TableData>
```

适用结论：

- FVS 不是只能引用外部数据集，业务 SQL 可以直接内嵌在 `editor.tpl`
- 图表一多时，数据集仍然统一放主文件，图表资源文件只管展示

### story / 背景 / 尺寸

这个样本的 `store` 解析结果如下：

- 画布尺寸：`960 x 680`
- 自适应模式：`WIDTH_HEIGHT_FILL`
- 页面背景：纯色 `#0B1F3A`
- theme：`blue`
- 组件数：3 个 chart

对应的 `store` 片段：

```json
{
  "stories": [
    {
      "name": "微信用户分析",
      "background": {
        "type": "color",
        "value": "#0B1F3A"
      },
      "widgets": [
        {"widgetType": "chart", "name": "微信用户添加趋势", "groupName": "柱形图类"},
        {"widgetType": "chart", "name": "微信用户下单趋势", "groupName": "柱形图类"},
        {"widgetType": "chart", "name": "微信用户状态分布", "groupName": "柱形图类"}
      ]
    }
  ],
  "width": 960,
  "height": 680,
  "adaptiveMode": "WIDTH_HEIGHT_FILL",
  "styleConfig": {
    "theme": "blue"
  }
}
```

### 图表资源拆分

每个图表都被拆成单独的 `*.chart` 文件，例如：

- `7d9d321d-79ce-4942-92cb-a0bfeab5cc4d.chart`
- `71105922-34db-434c-86cd-5c7c992206df.chart`
- `46530d32-3974-49e4-a1d5-8a23b646b7f0.chart`

一个典型 chart 片段如下：

```xml
<Chart class="com.fr.plugin.chart.vanchart.VanChart">
  <GI>
    <AttrBackground>
      <Background name="NullBackground"/>
      <Attr gradientType="normal" shadow="false" autoBackground="false" themed="false">
        <gradientStartColor><FineColor color="-12146441" hor="-1" ver="-1"/></gradientStartColor>
        <gradientEndColor><FineColor color="-9378161" hor="-1" ver="-1"/></gradientEndColor>
      </Attr>
    </AttrBackground>
  </GI>
  <ChartAttr isJSDraw="true" isStyleGlobal="false"/>
  <Title4VanChart>
    <Title>
      <O><![CDATA[微信用户添加趋势]]></O>
      <TextAttr>
        <Attr alignText="0" themed="false">
          <FRFont name="微软雅黑" style="0" size="170">
            <foreground><FineColor color="-1" hor="-1" ver="-1"/></foreground>
          </FRFont>
        </Attr>
      </TextAttr>
    </Title>
  </Title4VanChart>
</Chart>
```

适用结论：

- FVS 图表标题、渐变、边框、tooltip 等都在 `.chart`
- `isJSDraw="true"` 依旧只是绘制方式标记，不是业务脚本入口

## 3. 模板页：`第一张FVS模板.fvs`

### 图片边框

这个样本证明 FVS 可以把边框图直接包进 zip：

```json
{
  "stories": [
    {
      "name": "页面1",
      "border": {
        "type": "internal",
        "value": {
          "imageSource": "__from__reuse__/eaf50410-897c-4670-9e67-5218ee2baf37.jpg",
          "imageSlice": [360, 639, 360, 639]
        }
      }
    }
  ]
}
```

适用结论：

- 做带边框的大屏模板时，先找 `__from__reuse__`
- 切图留白由 `imageSlice` 控制，不要只看背景色

### 组件混排

通过 `editor.tpl` 中的 `widgetType` 可以看到这个样本混用了 chart 和 text：

- `chart fadeInUp`
- `chart 饼图`
- `text 区域总销量`
- `chart 条形图`
- `text 销售人员销量信息`
- `text 表格2`
- `text 区域销售详情`
- `chart 柱形图`
- `text 区域各产品销量`
- `text FVS详情链接`
- `text 华北指标数据`
- `text 华东指标数据`

适用结论：

- 排查大屏布局时，先数 `widgetType`，能快速判断是单图页还是混排页
- 文本卡片、链接卡片并不在 `.chart`，通常直接存在 story 的 widget JSON 里

### `.ec` 组件嵌入

这个样本还带了一个 `.ec` 文件，里面是嵌入式表格组件：

```xml
<DuchampElementCaseWidget xmlVersion="20211223" releaseVersion="11.0.0">
  <ElementCaseEditor applyWithPXUnit="true">
    <FormElementCase>
      <ReportPageAttr>
        <USE REPEAT="false" PAGE="false" WRITE="false"/>
      </ReportPageAttr>
      <CellElementList>
        <C c="0" r="0" s="0"><O><![CDATA[地区]]></O></C>
        <C c="1" r="0" s="0"><O><![CDATA[销售员]]></O></C>
        <C c="2" r="0" s="0"><O><![CDATA[销量]]></O></C>
        <C c="0" r="1" s="1">
          <O t="DSColumn"><Attributes dsName="ds2" columnName="地区"/></O>
        </C>
      </CellElementList>
```

适用结论：

- 如果 FVS 页面里的某块内容看起来像 CPT 表格，优先检查是否落在 `.ec`
- `.ec` 里仍然是熟悉的 `CellElementList` / `StyleList` 模型

## 4. 主题底板：`Template1.fvs`

这个样本最适合做“主题速查”，因为它直接给了展开版 `store.json`。

### 全局主题

```json
{
  "width": 1280,
  "height": 720,
  "adaptiveMode": "AUTO",
  "styleConfig": {
    "theme": "dark-blue",
    "theme_config": {
      "title": "暮海深蓝",
      "backgroundColor": "#00142E",
      "textColor": "#F5F9FF",
      "groupColor": {
        "colors": [
          "#4E92DF",
          "#144582",
          "#C0A64D",
          "#6B759E",
          "#2E6099",
          "#2B83CE",
          "#408D9C",
          "#15638E"
        ],
        "palette": "custom"
      }
    }
  }
}
```

### 全局图表样式

```json
{
  "widget": {
    "chart": {
      "content": {
        "axis": {
          "lineColor": "#36485F",
          "title": {"fontFamily": "微软雅黑", "color": "#9FA5BF"},
          "label": {"fontFamily": "微软雅黑", "color": "#9FA5BF"}
        },
        "legend": {"fontFamily": "微软雅黑", "color": "#9fadbf"},
        "tooltip": {
          "background": {
            "type": "singleColor",
            "value": "#1B3D67",
            "opacity": 60,
            "boxShadow": true
          },
          "fontFamily": "微软雅黑",
          "color": "#FFFFFFD9"
        }
      }
    }
  }
}
```

适用结论：

- FVS 想做统一换肤时，优先改 `store.json` / `store` 里的 `styleConfig`
- 全局主题优先于单图局部改色，特别适合新建页面时先定底板

## 5. Preview Notes

- FVS 浏览器复核地址格式固定为：
  - `/webroot/decision/view/duchamp?page number=1&viewlet=<目标文件>.fvs`
- 页面结构判断顺序：
  - 先看是否有 story 背景色
  - 再看是否有 `__from__reuse__` 边框资源
  - 图表问题进 `*.chart`
  - 明细块问题进 `*.ec`

## 6. Editing Notes

- 改 FVS 时先判断是改 `editor.tpl`、`store.json` 还是 `*.chart`，不要直接全量解包后盲搜
- 改主题优先 `styleConfig`，改单图优先 `*.chart`
- 看到 zip 里有 `.ec` 就默认存在复合组件，不要把所有内容都归到 story widget JSON
