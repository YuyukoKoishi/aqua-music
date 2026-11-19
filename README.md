# aqua-music

本地网络音乐播放器：Node 服务 + 浏览器 Web UI，LX 音源脚本驱动。

## 功能

- 五平台搜索（wy/tx/kg/kw/mg），字符契合度排序
- LX 音源脚本（`vm` 沙箱运行器）：musicUrl / lyric
- 浏览器 `<audio>` 播放，FLAC 原生支持；防盗链直链走本地流代理
- LRC 歌词滚动对齐，翻译行支持
- 歌单（内置「我喜欢」）、播放历史，服务端 JSON 持久化
- 下载队列（并发可配、重名策略、命名模板）

## 环境依赖

| 依赖 | 要求 | 说明 |
|---|---|---|
| 操作系统 | Windows 10/11（其他平台未测试） | 启动脚本为 `start.cmd` |
| [Node.js](https://nodejs.org/) | **≥ 20**（推荐 22 LTS+） | 运行服务端与测试；原生支持 TS 类型剥离 |
| [pnpm](https://pnpm.io/) | ≥ 8 | 仅从源码构建时需要；使用 Release zip 则不需要 |
| 浏览器 | Chrome / Edge 任意近版本 | 播放与整个 UI；FLAC 由浏览器原生解码 |
| 音源脚本 | LX Music 自定义音源 .js | **必须自备**，本项目不内置音源 |
| 网络 | 可访问各音乐平台 | 搜索/取链均为直连，无需代理 |

检查版本：

```bash
node -v    # 需 ≥ 20
pnpm -v    # 仅源码方式需要
```

## 两种运行方式

### 方式 A：下载 Release（推荐普通用户）

1. 到 [Releases](https://github.com/YuyukoKoishi/aqua-music/releases) 下载 `aqua-music-v0.1.0.zip` 并解压。
2. 双击 `start.cmd`。终端显示 `aqua-music listening at http://127.0.0.1:9528`（端口被占用自动顺延，以终端打印为准）。
3. 浏览器打开终端打印的地址。
4. 关闭终端即退出服务。

此方式只需 Node.js，不需要 pnpm 或 git。

### 方式 B：从源码运行

```bash
git clone https://github.com/YuyukoKoishi/aqua-music.git
cd aqua-music
pnpm install
pnpm build     # 前端 vite build + 服务端 tsc 编译到 dist/
pnpm start     # 或 node dist/server/index.js
```

开发模式（改代码热更新）：

```bash
pnpm dev:server              # 服务端 watch，端口 9528
pnpm --dir frontend dev      # Vite dev server，/api 自动代理到 9528
```

## 使用步骤

1. **导入音源**：打开网页 → 「设置」页 → 选择本地 LX 音源 .js 文件导入 → 点「启用」。可导入多个，启用的那个参与取链。
2. **搜索**：切到「搜索」页，输入歌名/歌手，可选单平台或全部平台，点「搜索」。
3. **播放**：点结果行的「播放」。底部播放条：暂停/进度拖动/音量/播放模式（顺序、单曲、循环、随机）/歌词滚动/队列。
4. **收藏与歌单**：结果行点「收藏」加入「我喜欢」；「歌单」页可新建歌单、移除曲目、删除歌单。
5. **下载**：先在「设置」页填**下载路径**（如 `D:/Music`），再在搜索结果点「下载」。「下载」页看进度与状态。
6. **歌词**：播放后自动加载 LRC；无歌词显示占位，不影响播放。

数据全部存在运行目录的 `data/` 下（settings.json、playlists.json、history.json、scripts/），删掉即重置。

## 常见问题

| 现象 | 处理 |
|---|---|
| 打不开页面 | 看终端打印的实际端口；确认防火墙放行 node |
| 搜索某平台无结果 | 平台接口偶发限流，稍后重试；tx 已内置自动重试 |
| 播放报「missing scriptId」 | 未导入音源脚本，见使用步骤 1 |
| 播放报 script does not support source | 该音源脚本不支持当前平台，换脚本或换平台 |
| 下载报 downloadDir not configured | 设置页填下载路径并保存 |
| 下载失败 | 音质高于脚本声明会自动降级；仍失败检查磁盘空间与路径权限 |
| FLAC 播放不了 | 换 Chrome/Edge（Chromium 内核原生支持 FLAC） |

## 测试

```bash
node --test test/   # 43 个用例：单测 + 集成（真实脚本 + 真实搜索）
```

## 致谢与声明

- [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop)：LX 脚本环境约定与内置平台搜索接口的权威实现，本项目的搜索适配层移植自它。
- [lx-web-music](https://github.com/linjioujiou/lx-web-music)：架构参考。
- 本项目不内置任何音源，播放地址来自用户自行导入的自定义音源脚本。仅供学习交流。
