# CPT Live Remote Patterns

## Scope

- 取样时间：2026-04-03
- 联调环境：`http://192.168.0.99:8075/webroot/decision`
- 远端顶层报表：`GettingStarted.cpt`、`微信用户列表.cpt`、`订单列表.cpt`
- 用途：给 `fr-cpt` 提供“真实业务 XML 长什么样”的速查手册，避免每次重新逆向

## Sample Map

| 远端样本 | 适用场景 | 可直接参考的块 |
| --- | --- | --- |
| `微信用户列表.cpt` | 业务列表页 | SQL 参数拼接、参数面板布局、条件高亮、合计公式、列表样式 |
| `GettingStarted.cpt` | 官方综合模板 | 图表 XML、tooltip / legend / axis 配置、数据库字典参数 |
| `订单列表.cpt` | 空白骨架 | 最小可运行 `WorkBook`、基础 `StyleList` |

## 1. 业务列表：`微信用户列表.cpt`

### 数据集 + SQL 动态过滤

这个样本使用 `NameDatabaseConnection(test)`，数据集名 `ds_wx_users`，参数直接在 SQL 里通过 `${if(...)}` 拼接。

```xml
<TableData name="ds_wx_users" class="com.fr.data.impl.DBTableData">
  <Parameters>
    <Parameter><Attributes name="nickname"/><O><![CDATA[]]></O></Parameter>
    <Parameter><Attributes name="real_name"/><O><![CDATA[]]></O></Parameter>
    <Parameter><Attributes name="mobile"/><O><![CDATA[]]></O></Parameter>
    <Parameter><Attributes name="status"/><O><![CDATA[]]></O></Parameter>
    <Parameter><Attributes name="is_seller"/><O><![CDATA[]]></O></Parameter>
    <Parameter><Attributes name="created_start"/><O><![CDATA[]]></O></Parameter>
    <Parameter><Attributes name="created_end"/><O><![CDATA[]]></O></Parameter>
  </Parameters>
  <Connection class="com.fr.data.impl.NameDatabaseConnection">
    <DatabaseName><![CDATA[test]]></DatabaseName>
  </Connection>
  <Query><![CDATA[
WHERE u.deleted_at IS NULL
${if(len(nickname) == 0, "", " AND u.nickname LIKE '%" + nickname + "%'")}
${if(len(real_name) == 0, "", " AND u.real_name LIKE '%" + real_name + "%'")}
${if(len(mobile) == 0, "", " AND u.mobile LIKE '%" + mobile + "%'")}
${if(len(status) == 0, "", " AND u.status = " + status)}
${if(len(is_seller) == 0, "", " AND u.is_seller = " + is_seller)}
${if(len(created_start) == 0, "", " AND u.created_at >= '" + created_start + "'")}
${if(len(created_end) == 0, "", " AND u.created_at <= '" + created_end + " 23:59:59'")}
ORDER BY u.created_at DESC
  ]]></Query>
</TableData>
```

适用结论：

- 业务列表优先保留真实中文字段别名，避免额外显示层映射
- 日期范围在 SQL 中直接拼上 `23:59:59`，适合日粒度结束时间
- 下拉参数走数值字典时，SQL 层直接比较原始值

### 参数面板布局

这个样本的参数区是 `WParameterLayout + WAbsoluteLayout$BoundsWidget` 绝对定位，不是流式布局。

```xml
<ReportParameterAttr>
  <Attributes showWindow="true" delayPlaying="true" windowPosition="1" align="0" useParamsTemplate="false" currentIndex="4"/>
  <ParameterUI class="com.fr.form.main.parameter.FormParameterUI">
    <Layout class="com.fr.form.ui.container.WParameterLayout">
      <Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
        <InnerWidget class="com.fr.form.ui.Label">
          <WidgetName name="lb_status"/>
          <LabelAttr verticalcenter="true" textalign="4" autoline="true"/>
        </InnerWidget>
        <BoundsAttr x="550" y="15" width="40" height="21"/>
      </Widget>
      <Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
        <InnerWidget class="com.fr.form.ui.ComboBox">
          <WidgetName name="status"/>
          <Dictionary class="com.fr.data.impl.CustomDictionary">
            <CustomDictAttr>
              <Dict key="1" value="正常"/>
              <Dict key="0" value="禁用"/>
            </CustomDictAttr>
          </Dictionary>
        </InnerWidget>
        <BoundsAttr x="590" y="15" width="80" height="21"/>
      </Widget>
      <Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
        <InnerWidget class="com.fr.form.ui.DateEditor"><WidgetName name="created_start"/></InnerWidget>
        <BoundsAttr x="80" y="45" width="130" height="21"/>
      </Widget>
      <Widget class="com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget">
        <InnerWidget class="com.fr.form.parameter.FormSubmitButton"><WidgetName name="query"/></InnerWidget>
        <BoundsAttr x="400" y="45" width="80" height="21"/>
      </Widget>
    </Layout>
  </ParameterUI>
</ReportParameterAttr>
```

适用结论：

- 业务参数区要做“紧凑查询栏”时，直接复用绝对定位模式最稳
- 标签常用 `textalign="4"`，查询按钮单独一块，移动端列表通过 `MobileWidgetList` 显式声明
- 字典型枚举参数优先用 `CustomDictionary`

### 条件高亮

状态列通过 `HighlightList` 直接做背景和前景色切换，不需要另建样式列。

```xml
<HighlightList>
  <Highlight class="com.fr.report.cell.cellattr.highlight.DefaultHighlight">
    <Name><![CDATA[状态正常绿色背景]]></Name>
    <Condition class="com.fr.data.condition.ObjectCondition">
      <Compare op="0"><O><![CDATA[正常]]></O></Compare>
    </Condition>
    <HighlightAction class="com.fr.report.cell.cellattr.highlight.BackgroundHighlightAction">
      <Background name="ColorBackground">
        <color><FineColor color="-11751600" hor="-1" ver="-1"/></color>
      </Background>
    </HighlightAction>
  </Highlight>
  <Highlight class="com.fr.report.cell.cellattr.highlight.DefaultHighlight">
    <Name><![CDATA[状态异常红色背景]]></Name>
    <Condition class="com.fr.data.condition.ObjectCondition">
      <Compare op="1"><O><![CDATA[正常]]></O></Compare>
    </Condition>
    <HighlightAction class="com.fr.report.cell.cellattr.highlight.BackgroundHighlightAction">
      <Background name="ColorBackground">
        <color><FineColor color="-769226" hor="-1" ver="-1"/></color>
      </Background>
    </HighlightAction>
  </Highlight>
</HighlightList>
```

适用结论：

- 单值状态列优先用 `ObjectCondition`
- 背景色和字体色拆成两个高亮动作，便于后续单独改色

### 合计公式

底部合计行不是额外数据集，而是直接在单元格里放 `Formula`。

```xml
<C c="8" r="3" s="5">
  <O t="XMLable" class="com.fr.base.Formula">
    <Attributes><![CDATA[=SUM(I3)]]></Attributes>
  </O>
</C>
<C c="10" r="3" s="5">
  <O t="XMLable" class="com.fr.base.Formula">
    <Attributes><![CDATA[=SUM(K3)]]></Attributes>
  </O>
</C>
```

适用结论：

- 列表底部统计优先用单元格公式，避免额外 SQL 聚合
- 扩列时要同步检查合计行 `c` 索引和公式列字母

### 样式表

这个样本覆盖了左对齐、居中、右对齐、标题底色、边框色几种常见模式。

```xml
<Style horizontal_alignment="2" imageLayout="1">
  <FRFont name="SimSun" style="1" size="84">
    <foreground><FineColor color="-1" hor="-1" ver="-1"/></foreground>
  </FRFont>
  <Background name="ColorBackground">
    <color><FineColor color="-13395610" hor="-1" ver="-1"/></color>
  </Background>
  <Border>
    <Top style="1"><color><FineColor color="-1" hor="-1" ver="-1"/></color></Top>
    <Bottom style="1"><color><FineColor color="-1" hor="-1" ver="-1"/></color></Bottom>
    <Left style="1"><color><FineColor color="-1" hor="-1" ver="-1"/></color></Left>
    <Right style="1"><color><FineColor color="-1" hor="-1" ver="-1"/></color></Right>
  </Border>
</Style>
<Style horizontal_alignment="4" imageLayout="1">
  <FRFont name="SimSun" style="0" size="72"/>
  <Background name="NullBackground"/>
  <Border>
    <Top style="1"><color><FineColor color="-4144960" hor="-1" ver="-1"/></color></Top>
    <Bottom style="1"><color><FineColor color="-4144960" hor="-1" ver="-1"/></color></Bottom>
    <Left style="1"><color><FineColor color="-4144960" hor="-1" ver="-1"/></color></Left>
    <Right style="1"><color><FineColor color="-4144960" hor="-1" ver="-1"/></color></Right>
  </Border>
</Style>
```

适用结论：

- `horizontal_alignment="2"` 常用于标题/金额居中
- `horizontal_alignment="4"` 常用于标签或文本左对齐
- 统一边框线色时，优先在 `StyleList` 里抽成独立样式编号

## 2. 图表模板：`GettingStarted.cpt`

### 图表单元格

`GettingStarted.cpt` 证明 CPT 内嵌图表是放在 `<O t="CC">` 中，不是外链资源文件。

```xml
<C c="0" r="6" cs="4" rs="12" s="1">
  <O t="CC">
    <Chart name="默认" chartClass="com.fr.plugin.chart.vanchart.VanChart">
      <Chart class="com.fr.plugin.chart.vanchart.VanChart">
        <ChartAttr isJSDraw="true" isStyleGlobal="false"/>
        <Title4VanChart>
          <Title>
            <O><![CDATA[新建图表标题]]></O>
            <TextAttr>
              <Attr alignText="0">
                <FRFont name="微软雅黑" style="0" size="128" foreground="-13421773"/>
              </Attr>
            </TextAttr>
          </Title>
        </Title4VanChart>
        <Plot class="com.fr.plugin.chart.column.VanChartColumnPlot">
```

### Tooltip / Legend / Axis

这个样本已经覆盖 tooltip 背景、透明度、legend 字体、坐标轴配色。

```xml
<AttrTooltip>
  <Attr enable="true" duration="4" followMouse="false" showMutiSeries="false" isCustom="false"/>
  <GI>
    <AttrBackground>
      <Background name="ColorBackground" color="-16777216"/>
      <Attr shadow="true"/>
    </AttrBackground>
    <AttrBorder>
      <Attr lineStyle="0" isRoundBorder="false" roundRadius="2"/>
      <newColor borderColor="-16777216"/>
    </AttrBorder>
    <AttrAlpha><Attr alpha="0.5"/></AttrAlpha>
  </GI>
</AttrTooltip>
<Legend>
  <Attr position="4" visible="true"/>
  <FRFont name="Microsoft YaHei" style="0" size="88" foreground="-10066330"/>
</Legend>
```

适用结论：

- CPT 图表 tooltip 配置直接写在图表 XML 内，不要去找参数面板
- `isJSDraw="true"` 常见于 VanChart；它不是业务 JS 脚本入口

### 数据库字典参数

`GettingStarted.cpt` 参数区还展示了数据库字典式下拉框绑定方式。

```xml
<InnerWidget class="com.fr.form.ui.ComboBox">
  <WidgetName name="地区"/>
  <Dictionary class="com.fr.data.impl.DatabaseDictionary">
    <FormulaDictAttr ki="0" vi="0"/>
    <DBDictAttr tableName="销量" schemaName="" ki="0" vi="0" kiName="" viName=""/>
    <Connection class="com.fr.data.impl.NameDatabaseConnection">
      <DatabaseName><![CDATA[FRDemo]]></DatabaseName>
    </Connection>
  </Dictionary>
</InnerWidget>
```

## 3. 空白骨架：`订单列表.cpt`

当只需要最小可运行骨架时，参考这个结构即可：

```xml
<WorkBook xmlVersion="20170720" releaseVersion="10.0.0">
  <TableDataMap></TableDataMap>
  <Report class="com.fr.report.worksheet.WorkSheet" name="sheet1">
    <RowHeight defaultValue="723900"><![CDATA[723900,...]]></RowHeight>
    <ColumnWidth defaultValue="2743200"><![CDATA[2743200,...]]></ColumnWidth>
    <CellElementList></CellElementList>
  </Report>
  <StyleList>...</StyleList>
</WorkBook>
```

## 4. JavaScript Supplements

远端业务样本没有显式 `JavaScript` 块，后续遇到脚本需求时直接查这些仓库内样例，不要再从零搜索：

- `reportlets/doc/Primary/FreeReport/JS实现日期控件查询天数控制.cpt`
- `reportlets/doc/Primary/DetailReport/JS实现隐藏行重新编号.cpt`
- `reportlets/doc/Primary/DetailReport/隐藏行后隔行设置背景色-JS.cpt`
- `reportlets/doc/JS/参数界面JS实例/15-JS实现参数控件赋值.cpt`
- `reportlets/doc/JS/工具栏JS实例/07-JS自定义工具栏按钮控制参数栏的显示与隐藏.cpt`

## 5. Editing Notes

- 先确认是改 `TableDataMap`、参数面板还是 `StyleList`，不要三处同时盲改
- 扩列时同时检查 `ColumnWidth`、标题单元格、明细单元格、合计公式
- 改高亮时优先复用现有 `HighlightList`，不要先新增样式编号
