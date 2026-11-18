# aqua-music

本地网络音乐播放器：Node 服务 + 浏览器 Web UI，LX 音源脚本驱动。

## 功能

- 五平台搜索（wy/tx/kg/kw/mg），字符契合度排序
- LX 音源脚本（`vm` 沙箱运行器）：musicUrl / lyric / pic
- 浏览器 `<audio>` 播放，FLAC 原生支持；防盗链直链走本地流代理
- LRC 歌词滚动对齐，翻译行支持
- 歌单（内置「我喜欢」）、播放历史，服务端 JSON 持久化
- 下载队列（并发可配、重名策略、命名模板）

## 运行

```bash
pnpm install
pnpm build          # 前端 dist + 服务端 tsc
pnpm start          # 默认 http://127.0.0.1:9528，端口占用自动顺延
```

开发模式：`pnpm dev:server`（服务端 watch）+ `pnpm --dir frontend dev`（Vite dev server，/api 代理到 9528）。

## 使用

1. 设置页导入 LX 音源脚本（.js）并启用。
2. 设置下载路径后可用下载功能。
3. 搜索页点播放/下载/收藏。

## 测试

```bash
node --test test/   # 43 个用例：单测 + 集成（真实脚本 + 真实搜索）
```

## 致谢与声明

- [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop)：LX 脚本环境约定与内置平台搜索接口的权威实现，本项目的搜索适配层移植自它。
- [lx-web-music](https://github.com/linjioujiou/lx-web-music)：架构参考。
- 本项目不内置任何音源，播放地址来自用户自行导入的自定义音源脚本。
