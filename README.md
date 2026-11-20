# TrainingLog · iOS 侧载壳（TrollStore）

把网页版 v34 打包成一个原生 iOS App 壳，供 TrollStore 永久签名安装。**不需要 Apple Developer 账号、不需要备案、不需要 App Store 审核**。

## 它做了什么

- 全屏 `WKWebView`，用自定义 scheme `traininglog://local/` 提供 `www/` 里的本地文件；无网络依赖，飞行模式可用。
- 注入 `bridge.js`，把 `localStorage` 接管到 App 的 `Documents/storage.json`。数据落在文件里，不会被 WebView 存储清理，且可通过「文件」App 直接导出。
- `UIFileSharingEnabled` 已开，Documents 目录在「文件」App 中可见。
- 深色底 + 浅色状态栏，竖屏，图标不带 alpha 通道。

## 目录

```
Sources/main.m                    ObjC 壳（WKWebView + 存储桥 + scheme handler）
Resources/Info.plist              App 配置（显示名 / Bundle ID / 文件共享）
Resources/bridge.js               localStorage -> Documents 同步桥
Resources/Icon-*.png              图标（1024 / 120 / 180，RGB 无透明）
www/                              网页版 v34 原样拷贝，未改一行
build.sh                          在 macOS 上编译并组装 IPA
repack.py                         在 Windows 上只换 www 重打包（免 Mac）
backup_tool.py                    备份 JSON <-> storage.json 转换
.github/workflows/build-ipa.yml   GitHub Actions 云端构建
```

## 构建（第一次，需要一次 macOS）

`ios/` 目录是自包含的，**把整个目录当作一个独立 GitHub 仓库**推送：

```bash
cd ios
git init
git add .
git commit -m "ios trollstore shell"
git remote add origin https://github.com/<你的账号>/training-log-ios.git
git push -u origin main
```

然后 GitHub → **Actions** → `Build TrollStore IPA` → **Run workflow** → 下载 artifact `TrainingLog-TrollStore-IPA`，解压得到 `TrainingLog-TrollStore.ipa`。

公开仓库的 macOS runner 分钟免费；私有仓库也有免费额度。整个过程你本地不装任何 Apple 工具。

> 如果你手边有 Mac，也可以直接在 `ios/` 下执行 `bash build.sh`，产物同样是 `TrainingLog-TrollStore.ipa`。

## 之后更新（永久免 Mac）

只要改的是 `www/` 里的网页内容，就不需要再编译：

```bash
python repack.py TrainingLog-TrollStore.ipa TrainingLog-updated.ipa
```

脚本只替换 `Payload/TrainingLog.app/www/`，二进制、Info.plist、图标原样保留。TrollStore 安装时会重新签名，所以重打包后无需签名。

改了 `Info.plist`、`main.m`、`bridge.js` 或图标，才需要重新跑一次云端构建。

## 数据

App 把所有 localStorage 键值存在 `Documents/storage.json`：

```json
{"workout_log_v1": "{\"records\":[...]}"}
```

- 导入旧备份：`python backup_tool.py import 备份.json storage.json`
- 导出成通用备份：`python backup_tool.py export storage.json 备份.json`
- 查看内容：`python backup_tool.py show storage.json`

在 iPhone 上打开「文件」App → 我的 iPhone → **某天的训练日志** 即可看到 `storage.json`。

导入前先上划关闭 App，放好文件再重开（App 启动时读取一次到内存，运行中会覆盖文件）。

## 常用改动

| 想改什么 | 改哪里 | 是否要重新编译 |
|---|---|---|
| 页面 / 样式 / 训练逻辑 | `www/` | 否，`repack.py` 即可 |
| App 显示名 | `Resources/Info.plist` → `CFBundleDisplayName` | 是 |
| Bundle ID | `Resources/Info.plist` → `CFBundleIdentifier` | 是 |
| 图标 | `Resources/Icon-*.png` | 是 |
| 最低系统版本 | `Info.plist` 的 `MinimumOSVersion` 与 `build.sh` 的 `-mios-version-min` | 是 |

当前 `MinimumOSVersion = 15.0`，编译参数同为 15.0，覆盖 TrollStore 2 支持的 iOS 15.5–17.0；目标设备 iOS 16.1.1 无需改动。

详细安装步骤见 `docs/iOS 巨魔安装指南.md`。
