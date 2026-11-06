/**
 * 友爱日记 · 社区演示数据层（无服务端）
 *
 * 设计意图（以后接真库时可一一对应表）：
 *   users      — 用户资料
 *   topics     — 话题标签
 *   circles    — 小圈子
 *   posts      — 社区公开动态 / 日记帖（visibility: public | private）
 *   comments   — 帖子评论
 *
 * 本地合并键（localStorage）：
 *   youai_community_v1  — { posts, comments, joinedCircleIds, likedPostIds, seeded: true }
 *   kangai_diaries      — 个人日记本（原有）
 *
 * 演示说明：首次进入写入 seed；点赞／评论／发帖／加圈写入 localStorage 合并保存。
 */
(function (global) {
  "use strict";

  function daysAgo(n, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour || 10, minute || 0, 0, 0);
    return d.toISOString();
  }

  /** SVG 色块头像（不依赖外链图） */
  function avatarDataUri(bg, letter) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
      '<rect width="80" height="80" rx="40" fill="' + bg + '"/>' +
      '<text x="40" y="48" text-anchor="middle" fill="#fff" font-size="32" font-family="sans-serif">' +
      letter +
      "</text></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  /** 帖子配图占位（柔和色块 + 符号） */
  function imagePlaceholder(bg1, bg2, emoji) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + bg1 + '"/>' +
      '<stop offset="100%" stop-color="' + bg2 + '"/>' +
      "</linearGradient></defs>" +
      '<rect width="640" height="400" fill="url(#g)"/>' +
      '<text x="320" y="220" text-anchor="middle" font-size="72">' + emoji + "</text>" +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  const ME_ID = "u-me";

  const users = [
    {
      id: ME_ID,
      nickname: "我",
      city: "苏州",
      bio: "慢慢记录，把这一天留给未来的自己。",
      avatarColor: "#7A9B76",
      avatar: avatarDataUri("#7A9B76", "我"),
      topicIds: ["t-daily", "t-family"],
    },
    {
      id: "u-1",
      nickname: "小禾",
      city: "苏州",
      bio: "午后一杯茶，也算把日子过温柔了。",
      avatarColor: "#A8C4A4",
      avatar: avatarDataUri("#A8C4A4", "禾"),
      topicIds: ["t-daily", "t-suzhou"],
    },
    {
      id: "u-2",
      nickname: "阿暖",
      city: "上海",
      bio: "陪家人走路的时光，是我最安心的药。",
      avatarColor: "#E8B4B8",
      avatar: avatarDataUri("#E8B4B8", "暖"),
      topicIds: ["t-family", "t-rehab"],
    },
    {
      id: "u-3",
      nickname: "老周",
      city: "苏州",
      bio: "复健打卡第 40 天，腿脚比上周轻快些。",
      avatarColor: "#8BA888",
      avatar: avatarDataUri("#8BA888", "周"),
      topicIds: ["t-rehab", "t-suzhou"],
    },
    {
      id: "u-4",
      nickname: "桃子妈",
      city: "南京",
      bio: "家属也需要被接住。我们彼此照亮。",
      avatarColor: "#C4A484",
      avatar: avatarDataUri("#C4A484", "桃"),
      topicIds: ["t-family", "t-care"],
    },
    {
      id: "u-5",
      nickname: "林夏",
      city: "杭州",
      bio: "阳光好的日子，就写几句给未来的自己。",
      avatarColor: "#9BB8D4",
      avatar: avatarDataUri("#9BB8D4", "夏"),
      topicIds: ["t-daily", "t-care"],
    },
    {
      id: "u-6",
      nickname: "阿木",
      city: "苏州",
      bio: "同城散步搭子，欢迎温柔的人。",
      avatarColor: "#B5A8D4",
      avatar: avatarDataUri("#B5A8D4", "木"),
      topicIds: ["t-suzhou", "t-rehab"],
    },
  ];

  const topics = [
    { id: "t-daily", name: "日常点滴", emoji: "🌿" },
    { id: "t-family", name: "家人陪伴", emoji: "🤝" },
    { id: "t-care", name: "治疗路上", emoji: "🍃" },
    { id: "t-suzhou", name: "苏州同城", emoji: "📍" },
    { id: "t-rehab", name: "复健打卡", emoji: "✅" },
  ];

  const circles = [
    {
      id: "c-1",
      name: "苏州友爱小群",
      intro: "同城同路人，聊聊日常与互相打气。",
      memberCount: 128,
      todayPostCount: 6,
      coverEmoji: "📍",
      coverColor: "#E8F0E6",
    },
    {
      id: "c-2",
      name: "午后茶话",
      intro: "下午三点，泡杯茶，写几句心里话。",
      memberCount: 86,
      todayPostCount: 4,
      coverEmoji: "🍵",
      coverColor: "#F3EDE3",
    },
    {
      id: "c-3",
      name: "复健打卡营",
      intro: "每天一小步，记录身体慢慢回来的感觉。",
      memberCount: 203,
      todayPostCount: 11,
      coverEmoji: "✅",
      coverColor: "#E6F0EC",
    },
    {
      id: "c-4",
      name: "家属互助角",
      intro: "照顾别人的人，也值得被好好照顾。",
      memberCount: 157,
      todayPostCount: 5,
      coverEmoji: "💛",
      coverColor: "#F5EDE8",
    },
  ];

  const posts = [
    {
      id: "p-1",
      userId: "u-1",
      circleId: "c-1",
      topicIds: ["t-daily", "t-suzhou"],
      title: "阳台的小太阳",
      body:
        "今天苏州阳光很好，把棉被晒了一上午。\n\n中午煮了点青菜粥，吃得很慢。忽然觉得：能把平凡的一天过完整，就已经很了不起了。\n\n写给同路的你们——慢慢来，我们都在。",
      images: [imagePlaceholder("#c5d5c2", "#e8dcc8", "☀️")],
      likeCount: 24,
      likedByMe: false,
      createdAt: daysAgo(0, 9, 20),
      visibility: "public",
    },
    {
      id: "p-2",
      userId: "u-2",
      circleId: "c-4",
      topicIds: ["t-family"],
      title: "陪爸爸走了两圈",
      body:
        "傍晚小区里风有点凉，我给爸爸多加了件外套。\n\n他走得比上周稳一点，还笑着说「明天再多走一圈」。我把这句话记下来了——这比任何励志语都管用。",
      images: [imagePlaceholder("#d4c4b0", "#e8d5c8", "🚶")],
      likeCount: 41,
      likedByMe: false,
      createdAt: daysAgo(0, 18, 5),
      visibility: "public",
    },
    {
      id: "p-3",
      userId: "u-3",
      circleId: "c-3",
      topicIds: ["t-rehab", "t-suzhou"],
      title: "复健打卡 · 第 40 天",
      body:
        "拉伸、慢走、呼吸，一共四十分钟。腿有点酸，但心情很清爽。\n\n打卡不是为了证明什么，只是想告诉身体：我们还在好好对待你。",
      images: [imagePlaceholder("#b8d4c8", "#dce8e0", "✅")],
      likeCount: 56,
      likedByMe: true,
      createdAt: daysAgo(1, 7, 40),
      visibility: "public",
    },
    {
      id: "p-4",
      userId: "u-4",
      circleId: "c-4",
      topicIds: ["t-family", "t-care"],
      title: "家属也需要休息",
      body:
        "昨晚终于睡了个整觉。白天把照护交接给了妹妹，我去公园坐了一会儿。\n\n想对所有家属说：你不是超人。允许自己喘口气，才能陪得更久。",
      images: [],
      likeCount: 88,
      likedByMe: false,
      createdAt: daysAgo(1, 14, 10),
      visibility: "public",
    },
    {
      id: "p-5",
      userId: "u-5",
      circleId: "c-2",
      topicIds: ["t-daily", "t-care"],
      title: "复查日的一杯温茶",
      body:
        "排队的时候有点紧张，就在心里默念：结果怎样，我都先把自己安顿好。\n\n出来后喝了杯温茶，阳光正好。把这一天轻轻放下，继续往前走。",
      images: [imagePlaceholder("#d8c8b8", "#e8e0d0", "🍵")],
      likeCount: 33,
      likedByMe: false,
      createdAt: daysAgo(2, 11, 0),
      visibility: "public",
    },
    {
      id: "p-6",
      userId: "u-6",
      circleId: "c-1",
      topicIds: ["t-suzhou", "t-rehab"],
      title: "金鸡湖晚风",
      body:
        "约了两位同城朋友沿着湖边慢慢走。不谈病情，只聊晚饭和猫咪。\n\n有时候「什么都不说」也是一种陪伴。苏州的风，今晚很温柔。",
      images: [imagePlaceholder("#a8c4d4", "#c8dce8", "🌙")],
      likeCount: 19,
      likedByMe: false,
      createdAt: daysAgo(2, 20, 30),
      visibility: "public",
    },
    {
      id: "p-7",
      userId: "u-1",
      circleId: "c-2",
      topicIds: ["t-daily"],
      title: "午后茶话 · 写给心情",
      body:
        "三点半，泡了茉莉。写下三件小确幸：睡饱了、粥很香、收到一条问候短信。\n\n日子是一点点攒起来的。",
      images: [],
      likeCount: 27,
      likedByMe: false,
      createdAt: daysAgo(3, 15, 30),
      visibility: "public",
    },
    {
      id: "p-8",
      userId: "u-3",
      circleId: "c-3",
      topicIds: ["t-rehab"],
      title: "今天完成了握力练习",
      body:
        "医生说的「量力而行」，我今天做到了。不多也不少，刚刚好。\n\n记一笔，给明天的自己一个轻轻的点赞。",
      images: [imagePlaceholder("#c8d8c0", "#e0e8d8", "💪")],
      likeCount: 45,
      likedByMe: false,
      createdAt: daysAgo(3, 8, 15),
      visibility: "public",
    },
    {
      id: "p-9",
      userId: "u-2",
      circleId: null,
      topicIds: ["t-family", "t-daily"],
      title: "厨房里的笑声",
      body:
        "和妈妈一起包饺子，馅料放多了，饺子一个比一个圆。我们笑了很久。\n\n病痛之外，生活还在继续——这本身就是希望。",
      images: [imagePlaceholder("#e8d0c0", "#f0e4d8", "🥟")],
      likeCount: 62,
      likedByMe: true,
      createdAt: daysAgo(4, 17, 45),
      visibility: "public",
    },
    {
      id: "p-10",
      userId: "u-5",
      circleId: null,
      topicIds: ["t-care", "t-daily"],
      title: "把恐惧写下来，它就小一点",
      body:
        "夜里睡不着，打开日记写下害怕的事。写完后发现：很多担心其实还没发生。\n\n感谢这个安静的角落，让我被自己接住。",
      images: [],
      likeCount: 71,
      likedByMe: false,
      createdAt: daysAgo(5, 23, 10),
      visibility: "public",
    },
    {
      id: "p-11",
      userId: "u-6",
      circleId: "c-1",
      topicIds: ["t-suzhou"],
      title: "平江路的梧桐",
      body:
        "路过平江路，梧桐叶子黄了一半。拍了一张给日记。\n\n城市还是那个城市，人慢慢学会和自己和解。",
      images: [imagePlaceholder("#c8b898", "#e0d4b8", "🍂")],
      likeCount: 15,
      likedByMe: false,
      createdAt: daysAgo(5, 16, 0),
      visibility: "public",
    },
    {
      id: "p-12",
      userId: "u-4",
      circleId: "c-4",
      topicIds: ["t-family"],
      title: "互助角的一句谢谢",
      body:
        "昨晚有位姐妹私信说「你的分享让我哭了一场，也松了一口气」。\n\n原来被看见，真的能让人喘得过来。家属互助角，谢谢你们在。",
      images: [],
      likeCount: 94,
      likedByMe: false,
      createdAt: daysAgo(6, 9, 50),
      visibility: "public",
    },
  ];

  const comments = [
    { id: "cm-1", postId: "p-1", userId: "u-6", body: "晒被子的味道，最治愈。", createdAt: daysAgo(0, 10, 5) },
    { id: "cm-2", postId: "p-1", userId: "u-2", body: "青菜粥听起来好温暖，我也去煮一碗。", createdAt: daysAgo(0, 11, 20) },
    { id: "cm-3", postId: "p-2", userId: "u-4", body: "多走一圈，这句话太好了。抱抱。", createdAt: daysAgo(0, 19, 0) },
    { id: "cm-4", postId: "p-2", userId: "u-1", body: "陪走本身就是最好的药。", createdAt: daysAgo(0, 19, 40) },
    { id: "cm-5", postId: "p-2", userId: "u-5", body: "风凉记得添衣，你们都辛苦了。", createdAt: daysAgo(0, 20, 10) },
    { id: "cm-6", postId: "p-3", userId: "u-6", body: "40 天！向你学习，稳稳的。", createdAt: daysAgo(1, 8, 0) },
    { id: "cm-7", postId: "p-3", userId: "u-1", body: "打卡加油，同城有空一起慢走。", createdAt: daysAgo(1, 9, 15) },
    { id: "cm-8", postId: "p-4", userId: "u-2", body: "说得太对了。家属也要被接住。", createdAt: daysAgo(1, 15, 0) },
    { id: "cm-9", postId: "p-4", userId: "u-5", body: "整觉真的太重要了，保重。", createdAt: daysAgo(1, 16, 30) },
    { id: "cm-10", postId: "p-5", userId: "u-1", body: "温茶 + 阳光，给我也续上勇气。", createdAt: daysAgo(2, 12, 0) },
    { id: "cm-11", postId: "p-6", userId: "u-3", body: "金鸡湖晚上很适合慢慢走，下次喊我。", createdAt: daysAgo(2, 21, 0) },
    { id: "cm-12", postId: "p-6", userId: "u-1", body: "不谈病情的陪伴，最舒服。", createdAt: daysAgo(2, 21, 40) },
    { id: "cm-13", postId: "p-7", userId: "u-5", body: "三件小确幸，我也学着写。", createdAt: daysAgo(3, 16, 0) },
    { id: "cm-14", postId: "p-8", userId: "u-2", body: "量力而行，记下来了。", createdAt: daysAgo(3, 9, 0) },
    { id: "cm-15", postId: "p-8", userId: "u-6", body: "轻轻点赞回给你。", createdAt: daysAgo(3, 10, 20) },
    { id: "cm-16", postId: "p-9", userId: "u-4", body: "饺子圆圆的，日子也圆圆的。", createdAt: daysAgo(4, 18, 30) },
    { id: "cm-17", postId: "p-9", userId: "u-1", body: "厨房笑声太治愈了。", createdAt: daysAgo(4, 19, 0) },
    { id: "cm-18", postId: "p-10", userId: "u-4", body: "写下来，恐惧就小一点——同感。", createdAt: daysAgo(5, 23, 40) },
    { id: "cm-19", postId: "p-10", userId: "u-2", body: "这个角落接住了好多人。", createdAt: daysAgo(6, 0, 10) },
    { id: "cm-20", postId: "p-11", userId: "u-1", body: "平江路的梧桐，同款秋天。", createdAt: daysAgo(5, 17, 0) },
    { id: "cm-21", postId: "p-12", userId: "u-2", body: "谢谢你愿意分享，抱抱所有家属。", createdAt: daysAgo(6, 10, 30) },
    { id: "cm-22", postId: "p-12", userId: "u-5", body: "被看见，真的能让人喘过来。", createdAt: daysAgo(6, 11, 0) },
  ];

  global.YouaiSeed = {
    ME_ID,
    COMMUNITY_KEY: "youai_community_v1",
    users,
    topics,
    circles,
    posts,
    comments,
    avatarDataUri,
    imagePlaceholder,
    daysAgo,
  };
})(typeof window !== "undefined" ? window : globalThis);
