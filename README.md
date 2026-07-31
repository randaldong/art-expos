# 致敬巨匠 · 36 件作品观展指南

为中国美术馆「致敬巨匠：从达·芬奇到卡拉瓦乔——意大利文艺复兴名作展」制作的移动优先、无构建依赖静态网站。

## 内容边界

- 展览基础信息、重点作品图片：以中国美术馆官方展讯为准。
- 作品解读为辅助观展阅读，不替代现场作品标签、图录或学术出版物。
- 其他公开图像均在页面作品详情内标注来源；有些用作同一题材 / 同一艺术家语汇的视觉提示，未以错图充当现场原作。

## 本地预览

```bash
python3 -m http.server 4173 --directory .
```

浏览器打开 `http://localhost:4173`。

## 目录

- `index.html`：页面结构
- `assets/styles.css`：移动优先样式
- `assets/app.js`：筛选、搜索、收藏与详情交互
- `data/artworks.js`：36 件作品、章节和艺术家资料

## 上线

当前项目已通过妙搭 HTML 应用部署。每次更新后，在仓库根目录执行：

```bash
git add index.html assets data README.md
git commit -m "feat: update exhibition guide"
git push origin sprint/default
lark-cli apps +release-create --app-id app_17b70j8rbnb --as user --branch sprint/default
```

然后用 `lark-cli apps +release-get` 轮询到 `finished` 并取得最新 `online_url`。
