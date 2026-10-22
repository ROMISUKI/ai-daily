# Codex 入口集成交接

## 当前状态

- 初次集成只授权“先改本地并交接”，入口放**右上角**；初次交接没有提交、推送或上线。随后用户在日报项目中明确要求审阅源码并更新到GitHub，本次按该后续授权统一提交和验证部署，不改变原有布局。
- 基线提交：`6f6d2b9`。开始时工作区干净；当前未提交改动为本次功能及其生成产物，不应丢弃。
- 原日报模板和三分区内容继续由本仓库维护；观测台的源模板、配色桥接、数据更新和单文件打包以**独立 `codex-reset-monitor` 项目**为准。
- `docs/codex/index.html` 是生成产物，不要直接改它。独立项目的 `public.html` 是经过公开字段投影的输入，不是整个项目的复制。

## 构建顺序

1. 在独立观测台项目运行 `node scripts/build.mjs`，生成本地完整版 `index.html` 和站点公开版 `public.html`。这一步不联网、不调用模型。
2. 在本仓库运行：

   ```sh
   node --test scripts/site.test.mjs
   node scripts/build.mjs --reports-dir <已存在的私有日报目录> --codex-page <独立观测台的public.html>
   node scripts/validate.mjs
   node scripts/preview.mjs
   ```

3. 本地从日报右上角进入 `codex/`，检查返回、手机窄屏、配色一致性。入口路径全部相对化，不使用本机文件链接，也不固定到网站根目录。

## 不要遗漏的外部配套

本机日报自动化目录另有配套修改：

- `publication.config.json`：`codexPage` 指向独立观测台的公开导出。
- `publish-site.mjs`：构建时传递该可选参数。
- `publication-policy.mjs` / 对应测试：只增加 `docs/codex/index.html` 白名单。
- `verify-website-browser.mjs`：补充四种视口的右上角入口、跳转/返回、同色板和默认无 API 请求检查；新增观测台窄屏页面检查。

这些配套在初次交接时只作准备，未执行发布器；正式发布须在审阅并提交后核验发布器兼容性。机器特定路径和测试明细保留在本机 `CODEX_INTEGRATION_HANDOFF.md`，不要提交它们或任何浏览器配置、日志、原始快照。

## 每日更新关系

独立观测台任务仍是北京时间05:00一次，复用同一份快照同时生成两个 HTML，不额外查询。日报发布器以后在其原有发布流程中带入最新公开导出；本任务没有改任何计划任务、日报采集/模型配置或自动发布安全门禁。

源码/配置尚未审阅提交时，发布器会保护性停止网站上传；不要为“让它能发”而关闭干净工作区检查。后续发布授权已明确，接手任务仍须检查并行改动、审阅差异，再正常提交/推送并验证Pages。分支推送成功不等于部署已完成，线上状态以实际验收为准。

## 主要文件

`scripts/site.mjs`、`web/site.css`、`site.config.json`、`scripts/build.mjs`、`scripts/codex-page.mjs`、`scripts/validate.mjs`、`scripts/site.test.mjs`、`docs/codex/index.html`，以及重新生成的共享页头、CSS、站点地图。

公开导出的公告正文最多保留240个字符的节选及原帖链接，不包含原始API响应、整篇长公告、个人账户或日报原始采集材料。页面按需手动同步后获得的完整公开数据只在访问者浏览器内使用。
