# Awesome 3D World · 三维世界图鉴

**从大学校园、自然景区到历史复原与文学空间。让地点可检索、场景可体验、来源可追溯。**

[在线浏览](https://enkoic.github.io/awesome-3d-world/) · [补充场景](https://github.com/Enkoic/awesome-3d-world/issues/new?template=scene.yml) · [贡献指南](CONTRIBUTING.md) · [收录约束](docs/SCOPE.md) · [精度标准](docs/QUALITY.md)

![大观园体素场景实际截图](site/assets/daguanyuan.webp)

## 这是什么

以地点或世界名称组织的三维资源库：**名称 → 浏览 → 下载 → 来源与精度 → 社区补充**。网站支持中英文和常用别名搜索、六类场景筛选、地区/世界属性/资源状态筛选、卡片与列表、条目分享、本机收藏、JSON 导出和 GitHub 投稿草稿。

我们同时维护“地点目录”和“可用资源”。目录广泛收录，模型逐步补全；不会把尚未建模的地点宣传成已有三维场景。

## 数据与资源快照 · 2026-10-19

| 内容 | 数量 / 状态 |
| --- | --- |
| 地点与世界档案 | **1,321** |
| UNESCO 世界遗产事实索引 | **1,273**，其中含中国的登记条目 **61** |
| 手工补充大学 | **40**，不构成学校排名或完整大学清单 |
| 文学世界 | **5**，其中大观园已接入 |
| 历史复原计划 | **3** |
| 已验证可浏览的本地场景 | **4：大观园、复旦大学、西交利物浦大学、北京大学燕园核心区** |
| 关联外部校园项目 | **2：剑桥、UT Austin** |

世界遗产条目可能包含一组跨地点/跨国遗产，不等于一个可开放旅游景区，更不等于一个现成模型。部分遗产中的校园、城市和地标被归入相应类别，因此分类计数与手工补充大学数不同。网页统计从数据计算。没有官方中文名称时保留英文原名。

## 分类目录

| 分类 | 内容 | 浏览清单 |
| --- | --- | --- |
| 大学与校园 | 大学、中小学、书院、校区与建筑群 | [campus](catalog/campus.md) |
| 景区与自然景观 | 园林、山水、保护地、旅游景区与遗产地 | [scenic](catalog/scenic.md) |
| 城市与街区 | 城市片区、古镇、村落与历史街区 | [urban](catalog/urban.md) |
| 地标与公共空间 | 标志建筑、广场、博物馆及可探索室内 | [landmark](catalog/landmark.md) |
| 历史复原 | 有明确时代的真实地点重建 | [historical](catalog/historical.md) |
| 架空与文学世界 | 文学、影视、游戏与原创世界 | [fictional](catalog/fictional.md) |

知名度以可查身份为优先依据，不作主观分数。一个主分类配多个标签；现实、历史和虚构作为独立属性。完整定义见 [SCOPE.md](docs/SCOPE.md)。

## 已收录校园

- [北京大学 · 燕园核心区](https://enkoic.github.io/awesome-3d-world/viewer.html?id=campus-pku)：独立 HTML，未名湖、博雅塔、西校门与图书馆，四季、昼夜、地图和双路线导览。
- [复旦大学三校区](https://enkoic.github.io/awesome-3d-world/viewer.html?id=campus-fudan)：体素与精细双版本，网页运行包及两版 GLB 下载。
- [西交利物浦大学](https://enkoic.github.io/awesome-3d-world/viewer.html?id=campus-xjtlu)：独立 HTML，校区切换、建筑搜索、昼夜与导览。

## 大观园

[进入场景](https://enkoic.github.io/awesome-3d-world/viewer.html?id=daguanyuan) · [原始 HTML 文件](site/scenes/daguanyuan/index.html)

自包含 Three.js / WebGL 体素园林，支持游览、四季、昼夜与章节路线。原始 HTML 原样保存，下载即得到完整网页场景，不是 GLB 文件。

这是一份《红楼梦》文学重构，非现实北京或上海大观园实测模型；尺寸、方位和不可考部分为艺术推定。资产许可单独管理，详见 [许可与署名](docs/LICENSING.md)。

## 本地运行与维护

只需要 Python 3.10+，网站本身不需要 npm、外部 CDN 或后端。

```sh
git clone https://github.com/Enkoic/awesome-3d-world.git
cd awesome-3d-world
python3 scripts/build.py
python3 -m http.server 4186 --directory dist
```

打开 http://localhost:4186/ 。GitHub Pages 部署路径为 `/awesome-3d-world/`，站内资源使用相对路径。

```text
data/curated.json     手工维护的地点与资源
data/unesco.json      官方事实字段快照与来源哈希
data/overrides.json   常用别名、标签及分类更正
data/schema.json      条目格式
site/                静态网站与实际场景文件
catalog/             自动生成的六类 Markdown 清单
docs/                范围、精度、许可与数据来源说明
scripts/             导入、校验与构建
.github/             Issue / PR 模板和 Pages 工作流
```

`python3 scripts/build.py --check` 只校验数据与本地资源。正常构建生成 `dist/` 和 `catalog/`；提交数据修改时一并提交更新后的分类清单。CI 在 PR 上验证，在 main 推送后部署 GitHub Pages。

显式刷新 UNESCO 快照：`python3 scripts/import_unesco.py --date YYYY-MM-DD`，随后构建并审核差异；不在每次部署时请求外部源。原始 XML 缓存位于忽略的 `.work/`，不随仓库发布。

## 社区补充

通过 [Issue](https://github.com/Enkoic/awesome-3d-world/issues/new?template=scene.yml) 或 PR 提交：名称、分类、世界属性、范围、来源、作者与许可、预览/下载链接、重建方法和已知局限。仅有地点建议也欢迎。

网站表单生成 GitHub 草稿，由贡献者在 GitHub 确认提交；不会把本机收藏或草稿当作公共数据。维护者核验后合并。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 来源与许可

目录底座来自 [UNESCO World Heritage Centre](https://whc.unesco.org/en/list/)，只保留事实性元数据与来源链接，不搬运照片和描述全文。学校来源见各条目官网；文学来源见原作品。项目与 UNESCO、所列学校及外部项目无隶属或背书关系。

新编写的网站代码、脚本及说明使用 [MIT](LICENSE)。第三方资源与场景资产不自动受该许可覆盖，参见 [LICENSING.md](docs/LICENSING.md)。
