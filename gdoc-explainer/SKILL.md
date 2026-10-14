---
name: gdoc-explainer
description: 写「讲解型」Google Doc 的完整流程与排版风格：源码导读、架构讲解、学习笔记、知识整理、技术方案说明，一个 tab 一个主题。用 Docs API 把受限 markdown 生成为精排版（Noto Sans SC、深蓝标题、斑马纹表格、代码块、提示框），并用字体统计 + PDF 渲染做验收。只要用户想把理解、讲解、笔记、导读写进 Google Docs，或说「按之前的风格/排版写文档」「再写一个 tab」「帮我做笔记到 Google Doc」，就使用这个 skill，即使没有明确提到排版。固定模板的测试报告类文档不适用。
---

# gdoc-explainer

把一块知识讲清楚并写进 Google Doc，排版统一、可复用。流程分三步：**写 markdown → 生成请求并分批写入 → 验收**。

Docs API 的基本规则：索引按 UTF-16 code unit 计；每个 tab 有独立的索引空间；每次 batchUpdate 都带 `writeControl.requiredRevisionId`，防止写到过期的位置。如果环境里有 Google Workspace 相关的 skill 或参考文档，先读它。

## 1. 内容：怎么讲才让人真懂

读者通常「看过代码但没真正理解」。所以文档要帮他们建立模型，不能只罗列事实。

- **一个 tab 一个主题**，一次只写一个 tab。写完先让用户读，讨论过再写下一个。一次写完十个 tab，读者跟不上，也没机会纠偏。
- **动笔前先定 3–5 个核心要点**，作为自己取舍内容的依据，**不写进文档**（不要出现「读完本页，你应该能做到……」这类要点清单）。要点是读者读完后**能做的事**（给任意接口找到 SQL、预测某个改动的后果），不是知识点清单。正文的取舍以要点为准：每个要点的「是什么」和「为什么」都要讲透，与要点无关的细节压缩或删掉。页首提示框只放一两句本页回答什么问题，也可以不放。
- **页首标题不带「Tab」字样**：写成 `@title 2 · Redis 持久化` 或直接 `@title Redis 持久化`，不要写 `@title Tab 2 · …`。
- **先骨架后细节**：讲入口方法时，先给出完整的控制流骨架（伪代码或带 `# 注释` 的代码块，标出 `路径:行号`），再逐段往下讲。小节之间要有衔接句（「知道了 X，下一个问题是 Y」），不要让小节各说各的。
- **跳过的步骤要交代去向**：先给出全景图（比如一条请求的 ①–⑩ 步），再逐步展开时，如果有些步骤不单独讲（前文讲过，或者不重要），要在展开前用一句话写明「第 ② 步只是……，第 ④ 步见上文某某小节，下面不再重复」。否则编号会出现断档，读者会以为内容漏掉了。
- **先举具体例子，再给抽象**。比如先讲「列出最近 10 个会话」这个场景，再讲 Ports & Adapters。
- **每个断言都对照代码核实**。引用写成 `path:line` 的形式，并在副标题里钉住 commit（「基于 main 分支 commit abc1234」），这样行号才有意义。
- **文档和代码不一致时，要明确标出来**：「AGENTS.md 说 X，代码里实际是 Y（`path:line`）」。读者最容易在这里被坑。
- **解释「为什么」**：设计取舍、换一种做法会出什么问题。读者追问「为什么」，通常说明文档少写了这一层。
- 正文用中文；代码、路径、标识符保持原样。

完整样例见 `examples/example-tab.md`。

## 2. Markdown 子集

`scripts/md2gdocs.py` 只认下面这些语法，别的写法会原样变成正文：

| 写法 | 效果 |
|---|---|
| `@title 标题` / `@sub 副标题` | 页首大标题（24pt 深蓝）/ 灰色副标题带底线 |
| `# ` / `## ` / `### ` | H1（16pt 深蓝带底线）/ H2 / H3（12.5pt 蓝） |
| `- ` / `1. ` | 圆点 / 数字列表（只支持单层，连续行合为一组） |
| `> ` | 浅蓝底提示框（连续行合为一个框） |
| ```` ``` ```` 代码块 | 浅灰底 + 左竖线，Roboto Mono 9pt；`# ` 或 `// ` 之后的部分显示为灰色注释 |
| `\|` 表格 | 深蓝表头白字、斑马纹、首列加粗，列宽按内容自动分配 |
| `**粗体**`、`` `代码` `` | 行内样式；行内代码在正文中是 10pt，在表格中是 9.5pt |

规则：
- 一行是一个段落，空行会被忽略。
- **表格前面必须紧跟一个普通段落**（比如「下表对比三种数据源：」）。紧跟标题或列表会报错。
- 单元格里写多个文件名或工具名时，用空格分隔的 `` `a.py` `b.py` `` 会自动变成一个一行；也可以写 `<br>` 手动换行。不要在一行里用空格挤多个名字，读者很难分清。
- 代码块里不要写 markdown，它会原样输出。

## 3. 写入流程

前提：要有 Google Docs 编辑连接器（工具名因环境而异，搜索 "google docs update"），以及 Drive 连接器（新建文档、导出 PDF）。

1. **准备 tab**。新文档用 Drive `create_file`（`application/vnd.google-apps.document`）创建。要加 tab 就发 `addDocumentTab` 请求，然后 read 一次拿到 tabId。生成器假设目标 tab **是空的**（从索引 1 开始写）。所以写之前先 read 确认一遍，用户可能已经改过。
2. **生成请求**：
   ```bash
   python3 <skill>/scripts/md2gdocs.py tab3.md <tabId> reqs.json
   python3 <skill>/scripts/chunk.py reqs.json reqs   # 默认每批 ≤28KB → reqs_0.json, reqs_1.json…
   ```
3. **按顺序发送每一批**，每批只发一次。每批前都要重新 read 拿到最新的 `revisionId`，填进 `writeControl.requiredRevisionId`。为了省事，可以只读一个很小的 tab，或者在 read 里加字段掩码。
   - 分批之间**不能重叠，也不能重发已经成功的批次**：曾经因为重发导致整段内容重复。如果某批失败，整批都不会生效（batchUpdate 是原子的），重新 read 之后只重发这一批。
   - 后一批的索引默认前一批已经写进去了，所以顺序不能乱。
4. 如果中途出错、需要清空重写：用 `deleteContentRange` 删掉 [1, endIndex-1)，再从第 2 步开始。

### 修改已有 tab（插入一节、替换一节）

不要整页重写。先 read 一次，找到目标段落的索引，然后用生成器的后两个参数：

```bash
# 在某个段落后面插入新内容：start = 该段落的 endIndex
python3 md2gdocs.py new.md <tabId> a.json <段落endIndex> split
# 替换一节：先删掉 [节内第一段的 startIndex, tab 的 endIndex-1)，留下一个空段落，再从它开始写
python3 md2gdocs.py new.md <tabId> b.json <被删范围的 startIndex>
```

- 替换时，把 `deleteContentRange` 放在同一批请求的最前面。
- 生成器会清掉插入段落从相邻段落继承来的列表、缩进、边框和底色。
- 不要在某个标题的末尾用 split 方式插入，新段落会继承标题的样式。应该接在一个正文段落后面。
- 同一个 tab 有多处改动时，**按从后往前的顺序**放进同一批请求，这样前面位置的索引不会被后面的改动挪动。

## 4. 验收（不要跳过）

API 返回成功，不等于排版正确。按顺序做下面两步：

1. **字体统计**：用 read_doc 读目标 tab（结果通常会被存成文件），然后运行：
   ```bash
   python3 <skill>/scripts/verify_fonts.py <saved_read.json> <tabId>
   ```
   预期结果：正文、标题、提示框、表格都是 Noto Sans SC，代码块和行内代码是 Roboto Mono。`SUSPECT runs` 应为 0。如果出现 Arial 或 None，说明有一段文字样式被段落样式覆盖了，要补发 `updateTextStyle`（见第 5 节）。
2. **看渲染效果**：用 Drive `download_file_content` 导出，参数 `exportMimeType: application/pdf`，然后运行：
   ```bash
   python3 <skill>/scripts/render_pdf.py <saved_export.json> out/ 110 1 4
   ```
   用 Read 打开几张 PNG 检查：表格列宽是否合理（路径列有没有被挤窄）、长代码有没有溢出、提示框和代码块的边线是否连续、有没有重复的段落。
   需要 PyMuPDF。如果 `import fitz` 失败，先找项目的 venv 或者 `pip install pymupdf`。

发现问题时直接对文档做局部修正（调列宽、改字号、删除重复区间），不要整页重写。修完以后再统计一次字体。

## 5. 设计与 API 的坑

| 现象 | 原因 / 做法 |
|---|---|
| 正文退回 Arial 11 | `updateParagraphStyle` 里带了 `namedStyleType`，会把文字样式重置。生成器已经保证段落样式先发、文字样式后发。手写请求时也要按这个顺序 |
| 表格首列被挤得很窄 | 列宽按内容比例分配，最小 72pt，总宽 468pt。如果还是不理想，单独发 `updateTableColumnProperties`（FIXED_WIDTH）调整 |
| 表格行在跨页处被拆开 | 生成器已经设置了 `preventOverflow`，并且固定了表头行 |
| 段落重复 | 分批时有重叠，或者重发了已成功的批次。删除重复区间，再检查列表编号是否连续 |
| 单元格内要换行 | 在单元格文本里插入 `\n`，它会成为该单元格内的新段落 |

设计 token（在 `md2gdocs.py` 顶部修改）：正文 Noto Sans SC 10.5pt、#2F3437、行距 150；标题 #1F4E79；H2 #2E6DA4；行内代码 Roboto Mono #8A2C2C；代码块底色 #F5F7FA、左线 #9DB4CC；提示框底色 #EEF5FC、左线 #2E6DA4；表格网格线 #D0D7DE、表头 #1F4E79、斑马纹 #F7F9FB、行距 130。如果用户想调整风格，改这些常量，不要逐个请求去改。

## 6. 交付

- 回复时给出文档链接（可以带上 tab 锚点 `?tab=<tabId>`），并用一两句话说明这一页讲了什么、建议读者先读哪一节。
- 文档 ID、tab ID 和写作进度记在项目 memory 里，方便下次续写，不要写进这个 skill。
