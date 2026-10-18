# 参与 awesome-3d-world

欢迎补充地点、场景资源、中文名称、来源证据、失效链接和视觉改进。

## 无需写代码

在 [新增场景 Issue](https://github.com/Enkoic/awesome-3d-world/issues/new?template=scene.yml) 填写名称、分类、范围、来源、浏览或下载链接、作者、许可证以及精度/推定说明。也可在网站“补充场景”中填写后打开 GitHub 草稿。需要你在 GitHub 登录并点击提交；网站不会静默代发，也没有把浏览器本地保存冒充公共数据库。

有模型线索但不能运行的内容可以提交，状态保持“外部项目”。只有地点建议也可以提交，状态为“待收录场景”。请不要上传私有凭据、个人敏感信息、未经许可的扫描数据或商业平台下载文件。

## 使用 Pull Request

1. Fork 仓库。
2. 编辑 `data/curated.json` 的 `entries`，参照 `data/schema.json` 和现有大观园条目。
3. UNESCO 原始索引由导入脚本生成，不直接改 `data/unesco.json`；来源数据有误请提交 Issue，并说明证据。常用别名、标签和主分类更正写在 `data/overrides.json`，以稳定 ID 对应原条目。
4. 自有或有明确授权的小型资源可放 `site/scenes/<id>/`，附作者与许可说明。大型文件使用 GitHub Releases 或有明确许可的数据托管；目录记录稳定链接及校验值。
5. 运行 `python3 scripts/build.py`，同时提交更新后的 `catalog/*.md`；用 `python3 -m http.server 4186 --directory dist` 检查网页。
6. 发起 PR，说明改动、来源、许可、可用性与验证日期。CI 校验元数据和本地文件，不代替人工检查精度和授权。

## 资源状态

新地点用 `planned`；外部线索用 `external`；维护者实际检查后才能用 `ready`。`verified_at` 记录浏览验证日期，不是未经说明的模型采集时间。

不要将 2D 地图、地点官网、视频演示或普通代码仓库写成已可浏览三维模型。下载 HTML、下载 GLB、下载点云和下载工程需要分别标明。

详细约束见 [收录范围](docs/SCOPE.md)、[质量与精度](docs/QUALITY.md)、[许可](docs/LICENSING.md)。
