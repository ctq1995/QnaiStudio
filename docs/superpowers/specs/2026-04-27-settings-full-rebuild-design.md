# 设置界面整体重构设计

## 背景
当前设置界面已经具备基础分区能力，但整体视觉仍偏浮层化，存在半透明强调、展示感过强、内容层级不够收敛的问题。现有结构中：[SettingsModal.tsx](src/components/Settings/SettingsModal.tsx) 已实现左右分栏雏形，但左侧导航按钮、右侧头部、内容卡片与状态提示仍带有较明显的透明态与展示型样式；[EngineSettingsPanel.tsx](src/components/Settings/EngineSettingsPanel.tsx)、[ProvidersSettingsPanel.tsx](src/components/Settings/ProvidersSettingsPanel.tsx)、[FloatingWindowSettingsPanel.tsx](src/components/Settings/FloatingWindowSettingsPanel.tsx)、[AboutSettingsPanel.tsx](src/components/Settings/AboutSettingsPanel.tsx) 之间的视觉规则也不完全统一。

用户要求对设置界面进行完整整体重构，目标是：
- 不要有透明状态
- 采用左右布局
- 整体简洁明了
- 美观紧凑
- 风格偏“极简专业”
- 左侧使用“分类导航”

## 目标

### 视觉目标
1. 设置主面板采用纯色、实底、细边框风格，不再依赖半透明高亮、玻璃感、渐变卡片作为主要视觉语言。
2. 左右布局明确、稳定，视觉重心以结构和层级建立，而不是靠装饰效果。
3. 整体信息密度较当前更高，但保持可读性，不做压迫式紧凑。
4. 各个设置分区风格统一，形成同一套设置中心语言。

### 交互目标
1. 左侧固定分类导航，右侧切换对应内容。
2. 保存操作保持固定底栏，确保用户随时可见保存状态与按钮。
3. 未保存状态、错误状态、保存成功状态以规整标签或横幅呈现，不使用透明漂浮提示。
4. 保持现有设置编辑逻辑不变，不改变保存、关闭、脏数据判断等行为。

### 范围
本次只重构设置界面的布局与视觉组织，不改变配置数据结构与业务行为。重点文件包括：
- [SettingsModal.tsx](src/components/Settings/SettingsModal.tsx)
- [SettingsContent.tsx](src/components/Settings/SettingsContent.tsx)
- [EngineSettingsPanel.tsx](src/components/Settings/EngineSettingsPanel.tsx)
- [ProvidersSettingsPanel.tsx](src/components/Settings/ProvidersSettingsPanel.tsx)
- [FloatingWindowSettingsPanel.tsx](src/components/Settings/FloatingWindowSettingsPanel.tsx)
- [AboutSettingsPanel.tsx](src/components/Settings/AboutSettingsPanel.tsx)
- 如有必要，联动微调 [SettingsCardOption.tsx](src/components/Settings/SettingsCardOption.tsx)、[SettingsToggle.tsx](src/components/Settings/SettingsToggle.tsx)、[DirtyBadge.tsx](src/components/Settings/DirtyBadge.tsx)

不包含：
- 配置字段新增或删除
- 设置分类新增或调整信息架构
- 保存逻辑重写
- 与设置无关的全局样式重构

## 设计方案

### 方案对比

#### 方案 A：极简专业分栏（推荐）
- 左侧固定分类导航
- 右侧单列内容区，局部双列表单
- 纯色背景、细边框、弱阴影、无透明主视觉
- 优点：最符合桌面应用设置中心心智，风险最低，统一性最好
- 缺点：视觉表达较克制

#### 方案 B：紧凑控制台分栏
- 左侧更窄，右侧高密度双列表单为主
- 优点：空间利用率高
- 缺点：对于路径输入、模型输入、状态说明等长内容不够友好，容易显得拥挤

#### 方案 C：大卡片分组分栏
- 左侧导航，右侧用较强卡片分组
- 优点：分区感更明显
- 缺点：与“极简专业”目标略有偏差，仍会保留较强展示感

选择方案 A，并在右侧内容区局部吸收方案 B 的紧凑排版优点。

## 信息架构
设置分类保持不变，仍使用 [settingsOptions.ts](src/components/Settings/settingsOptions.ts) 中的四个分区：
- 引擎设置
- 模型服务商
- 悬浮窗
- 关于

原因：当前信息架构已经足够清晰，本次重构聚焦于界面组织与视觉秩序，而不是分类重排。

## 布局设计

### 外层遮罩
- 保留弹窗遮罩层，继续承担模态语义。
- 遮罩允许维持深色覆盖层，但不将透明效果带入设置主面板本体。
- 主面板改为完整实底。

### 设置主面板
- 主面板为固定宽高范围的大型容器。
- 使用左右两栏结构：左窄右宽。
- 容器背景使用统一实色，不使用渐变。
- 外层只保留轻微阴影，避免“悬浮卡片感”过强。
- 圆角由当前较大的 28px 级别收敛到更中性的尺寸，使整体更稳重。

### 左侧分类导航
- 宽度控制在约 220–240px。
- 结构分为三段：标题区、导航列表、底部提示区。
- 标题区只显示“设置”与简短英文副标题或说明；若英文副标题保留，也需要弱化存在感。
- 导航项改为列表式按钮，而不是大面积浮起卡片：
  - 默认态：实底或与侧栏同色底
  - Hover：轻微背景变化
  - 激活态：使用浅色实底 + 强文本色 + 左侧细强调条或内嵌强调块
- 图标缩小并退为辅助角色，不再用明显色块包裹透明底。
- 导航项副标题压缩为更短的一行描述。

### 右侧内容区
右侧分为三段：
1. 顶部标题栏
2. 中部滚动内容区
3. 底部固定操作栏

#### 顶部标题栏
- 保留当前分类标题与一句说明
- 收紧纵向高度
- 关闭按钮保留在右上角
- 未保存状态改成小型规整状态标签，不使用高对比大胶囊作为主要视觉中心
- 不再使用偏“英雄区”的大标题展示方式

#### 中部内容区
- 以分组表单为核心
- 每个分组都是实底区块或轻边框区块
- 统一标题、描述、字段间距
- 默认单列，针对短字段可在中宽屏下转为两列
- 路径、URL、API Key、模型输入等长字段保持单列全宽

#### 底部固定操作栏
- 固定在内容区底部
- 左侧显示保存状态文案
- 右侧显示“关闭”和“保存更改”按钮
- 使用实底背景与上边框，与中部内容明确分隔
- 保存按钮为唯一主按钮，其它按钮弱化

## 组件级设计

### SettingsModal
[SettingsModal.tsx](src/components/Settings/SettingsModal.tsx) 将承担整体壳层重构。

调整重点：
1. 去掉主面板内部的透明强调、渐变块、大面积高饱和状态色。
2. 收紧导航按钮与头部区域的视觉密度。
3. 重写右侧标题栏与底部栏的样式节奏，确保整体更像桌面设置中心。
4. 保持现有 section 切换、保存、关闭确认逻辑不变。

### SettingsContent
[SettingsContent.tsx](src/components/Settings/SettingsContent.tsx) 不改变分发逻辑，但其承载容器需要与新壳层风格一致：
- 统一内容区的分组节奏
- 避免各面板自带互相冲突的外层容器风格
- 将“页面级布局”与“面板内部结构”职责分离

### EngineSettingsPanel
[EngineSettingsPanel.tsx](src/components/Settings/EngineSettingsPanel.tsx) 是当前最复杂面板，需要重点收敛。

调整目标：
1. 去掉 Overview 区域的渐变背景，改为标准信息分组。
2. 引擎选择卡片从“高强调卡片”改为更稳的实底选项卡或列表网格。
3. 路径、服务商、模型、连接测试、附加参数等分组成统一风格区块。
4. 脏状态提示仍保留，但应嵌入字段标签，不制造额外视觉噪音。
5. 控制每组间距，使长页面在滚动时仍保持紧凑秩序。

建议内部结构：
- 当前引擎摘要
- 引擎选择
- CLI 路径
- 服务商与模型
- 连接测试
- 进阶参数（如存在）

### ProvidersSettingsPanel
[ProvidersSettingsPanel.tsx](src/components/Settings/ProvidersSettingsPanel.tsx) 当前存在较多主色透明底与强调边框，需要改为统一实底系统。

调整目标：
1. 顶部新增按钮区与列表区分离，但都使用纯色面板。
2. “新增服务商”草稿表单采用标准表单分组，不使用高强调描边卡。
3. 空状态改为简洁说明块 + 操作按钮，取消透明虚线高亮风格。
4. 单个服务商条目改为统一实底编辑区块，删除按钮弱化但仍清晰可见。
5. 类型标签改为低对比实底标签，避免大面积浮层感。

### FloatingWindowSettingsPanel
[FloatingWindowSettingsPanel.tsx](src/components/Settings/FloatingWindowSettingsPanel.tsx) 需要从“选项卡片 + 开关块”的组合，统一到新的分组表单语言。

调整目标：
1. 顶部启用开关采用标准设置行。
2. 悬浮窗模式选项保留可点击项，但改为低装饰、实底边框式选项。
3. 自动模式下的延迟区块改为普通表单分组，不做突出容器。
4. 滑块区域保持清晰，但整体与其它分组风格一致。

### AboutSettingsPanel
[AboutSettingsPanel.tsx](src/components/Settings/AboutSettingsPanel.tsx) 改为最简信息面板：
- 应用信息
- 项目来源
- 如有必要增加版本信息占位

要求：
- 不再使用过强阴影
- 与其它面板统一边框、背景、圆角、标题规则

## 视觉规范

### 背景与边框
- 设置主面板、左栏、右栏、内容分组均使用实底背景。
- 以边框和分隔线建立结构，而不是透明叠层。
- 阴影只用于主模态外层，内部尽量不用或极轻。

### 圆角
- 统一使用中小圆角，避免过多“大圆角大卡片”。
- 按钮、输入框、分组区块、侧栏导航项的圆角规则应统一。

### 色彩
- 主强调色只用于：
  - 当前导航激活态
  - 主按钮
  - 关键状态值
  - 聚焦边框
- 避免在普通信息块、空状态、次级区块中大面积使用主色浅透明底。

### 间距
- 左右布局以清晰分栏为先
- 内容区内部分组间距收紧
- 表单字段上下间距保持统一
- 标题区与底栏压缩高度，给中部内容更多空间

### 图标
- 所有图标缩小一级，只做辅助识别
- 避免图标所在容器单独成为视觉焦点

## 数据流与状态
本次不修改数据流，延续现有 [useSettingsEditor.ts](src/components/Settings/useSettingsEditor.ts) 的编辑模型：
- 读取 store 中 config
- 本地 draft 编辑
- `hasUnsavedChanges` 判断脏状态
- `handleSave` 触发保存
- 关闭时仍沿用现有确认流程

界面层只调整状态展示方式：
- `idle`：显示普通说明
- `saving`：显示保存中状态
- `success`：显示已保存并生效
- `error`：在顶部或内容区上方显示实底错误横幅

## 错误处理
- 顶部或内容区上方保留统一错误提示条
- 样式改为实底警示条，不使用透明红色浅底作为主视觉
- 保存失败不改变当前编辑内容
- 若用户关闭时存在未保存修改，继续使用现有确认对话框逻辑

## 测试与验证

### 功能验证
1. 可正常打开设置界面
2. 左侧分类点击切换正常
3. 所有现有字段仍可编辑
4. 新增服务商、编辑服务商、删除服务商可正常工作
5. 引擎切换、模型选择、路径输入正常
6. 悬浮窗设置各项正常
7. 保存、关闭、未保存拦截逻辑正常

### 视觉验证
1. 设置主面板内部不存在透明主视觉块
2. 左右布局稳定，导航区与内容区层次清晰
3. 不同面板间风格统一
4. 宽屏下紧凑但不拥挤，窄屏下仍可滚动使用
5. 顶部、内容区、底部操作栏节奏明确

### 回归验证
- 检查 [App.tsx](src/App.tsx) 中 settings modal 的打开关闭行为是否受影响
- 检查通用按钮、输入框、确认弹窗是否仍与其它模块兼容

## 实施建议
建议分两层实施：
1. 先改壳层：`SettingsModal`、顶部栏、侧栏、底栏、内容容器
2. 再统一四个具体面板的视觉语言

这样可以先建立整体框架，再做面板收敛，降低一次性大改的风险。

## 决策结论
最终采用：
- 左侧分类导航
- 右侧内容详情
- 极简专业风格
- 去透明、去渐变、去过强展示感
- 保留现有设置分类与业务逻辑
- 统一全部设置子面板的视觉规范
