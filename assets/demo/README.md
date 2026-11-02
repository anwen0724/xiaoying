# 本地演示模板与素材

本目录用于开发题目的模板浏览、素材上传及模拟制作，不依赖网络下载、真实 AI、付费服务或公司内部素材。

## 内容

- `templates.json`：4 个模板，分为旅行记忆和创意设计两个分类，覆盖 1、2、3 张图片要求。
- `covers/*.svg`：模板封面，800 × 1400，包含本地嵌入摄影或几何设计。
- `results/*.svg`：模板对应的预置模拟结果，800 × 1400。页面说明模拟行为。
- `inputs/mountain.png`、`inputs/coast.png`、`inputs/sunset.jpg`：800 × 600 的实际上传文件，供正常流程演示。

所有模板接受 JPEG、PNG，单文件不超过 5 MiB。SVG 仅作为随项目打包的可信展示资源，不开放用户 SVG 上传。

## 来源与复用范围

当前封面及结果使用 Unsplash 摄影与本项目制作的 SVG 排版、几何设计，来源和许可见 [SOURCES.md](SOURCES.md)。输入示例仍为本项目制作的几何示意图片。摄影已嵌入本地 SVG，页面运行不依赖外链图片、字体或付费服务。

原题 `assets/` 中的四张截图仅用于界面布局参考，不作为产品模板、用户上传或生成结果发布。

预置结果不读取或合成用户上传图片；后台仍需执行素材检查、模拟生成和结果整理三个步骤。页面和 README 应明确说明模拟行为。

## 数据和路径约定

`templates.json` 是演示模板初始数据来源，Java 启动初始化程序将缺失模板导入 MySQL，正常模板接口读取数据库。`coverPath` 和 `resultPresetPath` 相对于本目录，不包含宿主机绝对路径。

`coverPath` 映射为 `/demo/{coverPath}`。模拟制作成功前，Java 将 `resultPresetPath` 对应文件复制到任务专属存储目录；浏览器通过带用户归属检查的 `/api/tasks/{id}/result` 读取结果。

输入示例供演示者选择上传，不预先作为用户资产写入数据库。服务端接受上传后才能获得素材 ID。

## 再生成

当前素材已保存到项目目录，容器构建和运行不需要执行素材脚本。`scripts/prepare-demo-assets.ps1` 仅保留旧版几何素材的生成记录，不能用于生成当前摄影版封面。需要研究旧版时可指定临时输出目录：

```powershell
pwsh -NoProfile -File scripts/prepare-demo-assets.ps1 -OutputDirectory artifacts/legacy-demo-assets
```

脚本使用 Windows 的 `System.Drawing`，默认输出到 `artifacts/legacy-demo-assets`，不会覆盖当前素材。它不是 Linux 容器或应用运行依赖。替换当前素材时，必须同步来源说明及实际文件；现有任务保存的结果文件不随模板修改而覆盖。
