# TLog 官网

TLog 的产品首页与中文文档。基于 VitePress、Vue 3 和原生 WebGL，支持深浅主题、移动端、本地文档搜索和键盘导航。

## 本地运行

需要 Node.js 20.19+，推荐 Node.js 22 LTS 或更新的 LTS 版本。依赖使用 npm 锁文件固定。

```sh
npm ci
npm run dev
```

```sh
npm test         # WebGL 初始化失败、降级与资源回收回归
npm run check    # 校验历史永久链接、文档与资源引用
npm run build    # 校验、生成静态站点，并检查产物链接与 SEO
npm run preview # 预览生产构建
```

构建产物位于 `docs/.vitepress/dist`，包含 `CNAME`、`404.html` 和 `sitemap.xml`。可以交给静态服务器托管，主域名保持 `tlog.dromara.org`。

## 内容维护

- `docs/guide/`：2.0 快速开始、升级指南、配置、兼容矩阵、示例验收和 WebFlux。
- `docs/10.文档/`：接入方式、日志框架、业务标签、HTTP、RPC、异步、消息与任务框架。
- `docs/.vitepress/site-data.ts`：自动读取 frontmatter，生成旧 URL 重写与文档侧栏。
- `scripts/legacy-routes.json`：重构前 53 个永久链接的基线。修改文档时必须保留 `permalink`；不能通过删除基线记录绕过检查。
- `docs/public/`：静态图片与域名文件，沿用旧站资源路径。

每篇文档应包含 `title`、`description` 和一个一级标题。旧文档保留原来的 `permalink`，新文档使用 `/guide/...` 路径。VitePress 构建会检查站内页面链接；本项目额外检查历史 URL、静态资源、产物页面、锚点与 SEO 元数据。

2.0 文档按正式发布的 `2.0.0` 描述依赖坐标，并只陈述已经完成的验证；版本号变化时同步更新快速开始、升级指南及首页安装示例。

## 视觉与交互

首页采用墨黑 / 雾白底色与一条“薄荷 → 天蓝 → 紫罗兰”的渐变线索。首屏由数万个粒子从星云中汇聚成 “TLog 2.0” 字标，一条追踪光带穿过字标流动，周期性冲击波向外扩散；鼠标划过会拨开粒子，向下滚动时粒子向四周爆散。`theme/tokens.css` 集中维护颜色、字体和间距；`theme/base.css`、`theme/home.css`、`theme/docs.css` 分别负责全局元素、首页和文档页。字体为自托管的 Inter（拉丁与数字）与 JetBrains Mono（代码），中文使用各平台系统字体。

`HeroStage.vue` / `particleHero.js` 用 WebGL 绘制首屏：粒子位置全部在顶点着色器中计算，每帧 CPU 只更新少量 uniform；粒子数量按屏幕大小自适应，离开视口或页面进入后台时停止绘制。没有 WebGL 时显示普通的 DOM 字标；系统开启“减少动态效果”时显示静止的字标。`EvolutionSection.vue` 是 2.0 的升级 diff 回放、数字与集成列表。`TraceJourney.vue` 是随滚动推进的链路演示，SpanId 规则与文档一致。`InstallSnippet.vue` 提供可复制的安装片段。字体自托管，不依赖外部字体服务。

链路交互明确标为示意，不连接生产服务，也不采集访问者的日志。文档使用 VitePress 的本地搜索，原站的广告拦截弹窗和外部注入脚本已移除。

## 持续集成

Pull request 执行安装、回归测试、校验和构建，并保留静态产物。合并到 `master` 后，沿用原站的 `dist` 分支部署流程。手动触发工作流只构建，不部署。

## 依赖维护

VitePress 保留稳定的 1.6.4，局部覆盖到兼容的 Vite 6.4.5；gray-matter 的 js-yaml/argparse 也使用修复版本。这些 overrides 用于消除旧传递依赖的已知漏洞，不引入 alpha 版本。升级 VitePress 后应重新检查兼容性，满足上游修复版本时移除对应覆盖。

```sh
npm audit --registry=https://registry.npmjs.org
```

本次改版的验证记录和限制见 [WEBSITE_QA.md](./WEBSITE_QA.md)。
