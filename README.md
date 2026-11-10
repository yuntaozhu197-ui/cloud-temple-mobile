# 云间寺手机版

三维寺庙包含自由漫游、蒲团入座、合掌、礼拜、转珠、木鱼、108 次自动礼拜、在线共修、结缘交友和敬香。前端资源均随项目提供，手机浏览器通过服务器网址进入。

## 启动

需要 Node.js 22.13 或更新版本。在项目目录依次安装依赖、构建并启动。

```sh
npm ci
npm run build
npm start
```

默认监听 `0.0.0.0:3000`。`PORT` 可设置端口，`HOST` 可设置监听地址。

## 数据

好友、邀请、问候和敬香记录写入 `data/temple.sqlite`。`TEMPLE_DATA_DIR` 可设置数据目录。云服务器应为该目录挂载持久化磁盘，并定期备份。在线位置采用 45 秒租期，使用单个服务器实例。

玩家身份由当前浏览器的匿名 Cookie 保存。更换浏览器或清除 Cookie 会生成新的身份。

## 容器部署

```sh
docker build -t cloud-temple .
docker run -d -p 3000:3000 -v temple-data:/app/data --name cloud-temple cloud-temple
```

外部访问时由托管平台或反向代理提供 HTTPS。服务健康检查路径为 `/health`。

## Render 免费体验

仓库提供 `render.yaml` 和 Dockerfile，可在 Render 创建免费 Web Service。免费服务闲置后会休眠，首次唤醒需要等待。免费实例的本地存储是临时的，好友和香火记录可能在休眠、重启或重新发布后重置。`TEMPLE_TRIAL_MODE=true` 会在页面中显示相应提示。

