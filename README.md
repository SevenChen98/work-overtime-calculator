# 加班工时计算器

一个基于 React + Vite + Electron 的加班工时记录工具。

支持两种使用方式：

- 网页版：适合本地开发和浏览器里使用
- Windows 桌面版：适合打包成 `.exe` 后分享给别人

## 环境要求

- Node.js 18 及以上
- npm 9 及以上
- Windows

当前项目已在以下环境验证过：

- Node.js `v24.13.0`
- npm `11.6.2`

## 安装依赖

第一次拉下项目后，在项目根目录执行：

```powershell
npm install
```

## 项目目录说明

- [`overtime_tracker_app.jsx`](./overtime_tracker_app.jsx)：主界面逻辑
- [`src`](./src)：网页入口
- [`electron`](./electron)：桌面版入口
- [`server.js`](./server.js)：网页版本地数据读写服务
- [`data/overtime-state.json`](./data/overtime-state.json)：网页版默认数据文件
- [`release`](./release)：桌面版打包产物

## 启动网页版

网页版适合开发和调试，数据保存在项目目录下的 [`data/overtime-state.json`](./data/overtime-state.json)。

启动命令：

```powershell
npm run dev
```

启动后访问：

```text
http://localhost:5173
```

说明：

- 这个命令会同时启动 Vite 前端和本地 Node 服务
- 浏览器里修改的数据会自动保存到项目目录下的 `data/overtime-state.json`

## 构建网页版

如果只想生成前端静态文件，执行：

```powershell
npm run build
```

构建结果在：

- [`dist`](./dist)

## 启动桌面版开发环境

如果你想边改边看 Electron 桌面窗口效果，执行：

```powershell
npm run dev:desktop
```

说明：

- 这个命令会先启动 Vite 开发服务器
- 然后自动打开 Electron 窗口
- 适合调试最终 `.exe` 的运行效果

## 打包 Windows 桌面版 exe

执行：

```powershell
npm run build:desktop
```

打包成功后，产物目录在：

- [`release\加班工时计算器-win32-x64`](./release/加班工时计算器-win32-x64)

主程序是：

- [`release\加班工时计算器-win32-x64\加班工时计算器.exe`](./release/加班工时计算器-win32-x64/加班工时计算器.exe)

分享给别人时：

- 不要只发单独一个 `.exe`
- 要把整个 `release\加班工时计算器-win32-x64` 文件夹一起发
- 更推荐先压缩成 zip，再发给别人

## 网页版和 exe 版数据保存位置

网页版数据保存位置：

- [`data/overtime-state.json`](./data/overtime-state.json)

桌面版 exe 数据保存位置：

- 保存在当前 Windows 用户的应用数据目录
- 默认类似：

```text
C:\Users\你的用户名\AppData\Roaming\overtime-tracker-app\overtime-state.json
```

桌面版界面顶部会直接显示当前数据文件的真实路径。

## 一套完整复现流程

### 1. 从零开始运行网页版

```powershell
npm install
npm run dev
```

然后打开：

```text
http://localhost:5173
```

### 2. 从零开始运行桌面开发版

```powershell
npm install
npm run dev:desktop
```

### 3. 从零开始打包 exe

```powershell
npm install
npm run build:desktop
```

打包完成后，去这个目录拿程序：

- [`release\加班工时计算器-win32-x64`](./release/加班工时计算器-win32-x64)
