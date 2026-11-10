# 云间寺手机版

全屏三维寺庙包含地图拖动、第一和第三人称、自由漫游、蒲团修行、真实木鱼录音、可4倍加速的108拜、在线共修、结缘、敬香、免费献花、虚拟随喜、线上祈愿、公开或私密日记及离寺建议。坐稳蒲团后可展开修行动作，地图上的供香、供花与祈愿入口靠近时才出现。

## 启动

需要 Node.js 22.13 或更新版本。在项目目录依次安装依赖、构建并启动。

```sh
npm ci
npm run build
npm start
```

默认监听 `0.0.0.0:3000`。`PORT` 可设置端口，`HOST` 可设置监听地址。

## 数据

账号、日记、好友、心意和建议记录写入 `data/temple.sqlite`。`TEMPLE_DATA_DIR` 可设置数据目录。云服务器应为该目录挂载持久化磁盘，并定期备份。在线位置采用45秒租期，使用单个服务器实例。

玩家使用账号密码登录。密码经随机盐和scrypt派生后保存，会话使用HttpOnly Cookie。登录同一账号可访问自己的日记与寺友。旧浏览器身份首次设置账号密码时会保留尚存在的记录。

## 容器部署

```sh
docker build -t cloud-temple .
docker run -d -p 3000:3000 -v temple-data:/app/data --name cloud-temple cloud-temple
```

外部访问时由托管平台或反向代理提供 HTTPS。服务健康检查路径为 `/health`。

## Render 免费体验

仓库提供 `render.yaml` 和 Dockerfile，可在Render创建免费Web Service。免费服务闲置后会休眠，首次唤醒需要等待。免费实例的本地存储是临时的，账号、日记与其他记录可能在休眠、重启或重新发布后重置。`TEMPLE_TRIAL_MODE=true` 会在页面显示提示，日记页面提供导出备份。

