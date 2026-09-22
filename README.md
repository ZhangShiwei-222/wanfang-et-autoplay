# 万方科研诚信培训 - 后台自动刷课脚本

用于 [万方科研诚信培训系统](https://cx.wanfangdata.com.cn/e-training/) 的浏览器用户脚本，脚本猫（ScriptCat）与 Tampermonkey（油猴）通用，实现课程视频的自动化学习。

## 功能

- **防切页暂停**：切到其他标签页视频照常播放，支持后台挂机
- **自动播放**：进入学习页自动播放（静音兜底起播）
- **自动下一节 / 下一章**：视频播完自动切下一节，基于播放进度轮询，不依赖播放器事件
- **跨课程自动续播**：在活动「课程列表」页自动依次学完所有未完成课程（列表 → 介绍页 → 播放页三页自动流转）
- **倍速 / 静音**：悬浮面板可调 1x~8x 倍速与静音开关
- **悬浮控制面板**：右下角可拖拽，实时看进度、控制开关

## 安装

1. 安装脚本管理器：[脚本猫 ScriptCat](https://docs.scriptcat.org/) 或 [Tampermonkey](https://www.tampermonkey.net/)
2. 打开本仓库 `wanfang-et-autoplay.user.js`，点击右上角 Raw 自动安装；或直接访问：
   `https://raw.githubusercontent.com/ZhangShiwei-222/wanfang-et-autoplay/main/wanfang-et-autoplay.user.js`

## 使用

1. 打开培训系统的活动课程列表页（`/e-training/activity/info?aId=...`）
2. 脚本自动：点「未完成课程」→ 介绍页自动点「立即学习」→ 播放页自动播放并切节
3. 保持页面即可全程自动，右下角面板可查看进度、调整倍速/静音

## 说明

- 系统按「真实学习时长」（约 90%）判定完成，建议 1 倍速后台挂机，倍速可能导致学时不足
- 本脚本仅用于个人学习效率提升，请遵守平台使用规范

## 许可证

MIT
