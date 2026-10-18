# 复旦大学 · 一校三区

收录邯郸、江湾与枫林三校区的交互场景，保留精细体块版与体素版。

- [精细体块版](index.html)
- [体素版](voxel.html)
- [原项目与建模说明](https://github.com/Enkoic/fudan-voxel-campus)
- [参考影像署名与许可](references/README.md)
- [精细版三校区 GLB](https://enkoic.github.io/fudan-voxel-campus/models/fudan-three-campuses.glb)
- [体素版三校区 GLB](https://enkoic.github.io/fudan-voxel-campus/models/fudan-voxel-three-campuses.glb)

运行包解压后在此目录执行 `python3 -m http.server 8000`，浏览器打开 `http://127.0.0.1:8000/`。运行包包含网页、JavaScript、CSS、校园数据与参考影像。GLB 通过原项目单独下载。

建筑轮廓与道路来自 OpenStreetMap，© OpenStreetMap contributors，ODbL 1.0。地标依据公开照片建模，树木、立面与景观采用程序化表达。场景为示意重建，体素版采用 4 m 网格；该网格不代表测量误差。

Three.js 使用 MIT 许可，完整文本见 [vendor/LICENSE](vendor/LICENSE)。参考照片作者、来源与许可保留在 [credits.json](references/credits.json) 中。代码和模型的使用说明见原项目，本站根目录 MIT 不替代原资源及第三方数据许可。
