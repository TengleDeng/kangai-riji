/**
 * 友爱日记 · 社区演示数据层（无服务端，纯 seed + localStorage）
 *
 * ── Schema（以后接真库时可一一对应表）────────────────────────────
 * users      { id, nickname, city, bio, avatarColor, avatar(dataURI),
 *              topicIds[]         关注话题,
 *              followers, following 展示用计数,
 *              joinedDays         加入天数（展示）}
 *              ↳ publicDiaryCount / 获赞数 由 posts 现算，不入库
 * topics     { id, name, emoji, desc }
 * circles    { id, name, intro, rule 圈规一句话, memberCount, todayPostCount,
 *              coverEmoji, coverColor, memberIds[] 成员预览 }
 *              ↳ 圈内帖数 = posts.filter(circleId) 现算
 * posts      { id, userId, circleId|null, topicIds[], title, body, images[],
 *              mood(MOODS.id)|null, weather|null, location|null,
 *              likeCount, hugCount, createdAt(ISO), visibility: public|private,
 *              featured? 首页精选, diaryId? 关联「我」的个人日记 }
 * comments   { id, postId, userId, body, createdAt }
 * diaries    「我」的个人日记 { id, title, body, tags[], images[], mood,
 *              createdAt, visibility, topicIds[] }
 * 可选关系表（demo 存 localStorage）：
 *   likes        { userId, postId }   → likedPostIds[]
 *   hugs         { userId, postId }   → huggedPostIds[]（「抱抱」轻互动）
 *   memberships  { userId, circleId } → joinedCircleIds[]
 *   follows      { userId, targetId } → followedUserIds[]
 *
 * ── 本地存储键（localStorage）───────────────────────────────────
 *   youai_community_v2  — { posts, comments, joinedCircleIds, likedPostIds,
 *                           huggedPostIds, followedUserIds, seenResponseIds }
 *   kangai_diaries      — 个人日记本（原有键，v2 seed 会替换旧演示日记、保留用户自写）
 *   youai_diary_seed_v2 — 标记已写入 v2 个人日记 seed
 *
 * 演示说明：首次进入写入 seed；点赞／抱抱／评论／发帖／加圈／关注写入本机合并保存。
 * 合规：无真实病历号、身份证、手机号；内容不含医疗建议。
 */
(function (global) {
  "use strict";

  const NOW = Date.now();

  function daysAgo(n, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour == null ? 10 : hour, minute || 0, 0, 0);
    // 避免「今天」的帖子落在未来
    if (d.getTime() > NOW - 5 * 60000) {
      d.setTime(NOW - (20 + ((hour || 0) * 7) % 90) * 60000);
    }
    return d.toISOString();
  }

  function avatarDataUri(bg, letter) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
      '<rect width="80" height="80" rx="40" fill="' + bg + '"/>' +
      '<text x="40" y="51" text-anchor="middle" fill="#fff" font-size="32" font-family="sans-serif">' +
      letter + "</text></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function imagePlaceholder(bg1, bg2, emoji) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + bg1 + '"/>' +
      '<stop offset="100%" stop-color="' + bg2 + '"/>' +
      "</linearGradient></defs>" +
      '<rect width="640" height="400" fill="url(#g)"/>' +
      '<circle cx="540" cy="80" r="60" fill="#fff" fill-opacity="0.18"/>' +
      '<circle cx="90" cy="340" r="90" fill="#fff" fill-opacity="0.12"/>' +
      '<text x="320" y="230" text-anchor="middle" font-size="96">' + emoji + "</text>" +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  const ME_ID = "u-me";

  const MOODS = [
    { id: "calm", emoji: "😌", name: "平静" },
    { id: "happy", emoji: "😊", name: "开心" },
    { id: "warm", emoji: "🥰", name: "被温暖" },
    { id: "strong", emoji: "💪", name: "有力气" },
    { id: "tired", emoji: "😮‍💨", name: "有点累" },
    { id: "nervous", emoji: "😟", name: "有点紧张" },
    { id: "low", emoji: "🌧️", name: "低落" },
  ];

  function U(id, nickname, city, bio, color, letter, topicIds, followers, following, joinedDays) {
    return { id, nickname, city, bio, avatarColor: color, avatar: avatarDataUri(color, letter), topicIds, followers, following, joinedDays };
  }

  const users = [
    U(ME_ID, "我", "苏州", "慢慢记录，把这一天留给未来的自己。", "#7A9B76", "我", ["t-daily", "t-family", "t-thanks"], 23, 6, 46),
    U("u-1", "小禾", "苏州", "午后一杯茶，也算把日子过温柔了。", "#A8C4A4", "禾", ["t-daily", "t-suzhou", "t-nature"], 312, 88, 210),
    U("u-2", "阿暖", "上海", "陪家人走路的时光，是我最安心的时刻。", "#E8B4B8", "暖", ["t-family", "t-care", "t-food"], 486, 120, 265),
    U("u-3", "老周", "苏州", "复健打卡第 40 天，腿脚比上周轻快些。", "#8BA888", "周", ["t-rehab", "t-suzhou"], 201, 34, 98),
    U("u-4", "桃子妈", "南京", "家属也需要被接住。我们彼此照亮。", "#C4A484", "桃", ["t-family", "t-care", "t-mood"], 655, 140, 330),
    U("u-5", "林夏", "杭州", "阳光好的日子，就写几句给未来的自己。", "#9BB8D4", "夏", ["t-daily", "t-care", "t-mood"], 278, 76, 150),
    U("u-6", "阿木", "苏州", "同城散步搭子，欢迎温柔的人。", "#B5A8D4", "木", ["t-suzhou", "t-rehab", "t-daily"], 164, 59, 120),
    U("u-7", "青柚", "成都", "一日三餐认真吃，就是给身体的回信。", "#E3B07A", "柚", ["t-food", "t-family"], 397, 102, 180),
    U("u-8", "陈阿姨", "无锡", "退休语文老师，每天写一页字。", "#B9A27E", "陈", ["t-daily", "t-thanks"], 143, 21, 400),
    U("u-9", "小满", "北京", "周末回家陪妈妈，工作日在日记里想她。", "#D49BA6", "满", ["t-family", "t-mood"], 231, 93, 75),
    U("u-10", "远山", "广州", "爱拍云。晨走八千步，看天慢慢亮。", "#7FA6B5", "山", ["t-nature", "t-rehab"], 189, 47, 160),
    U("u-11", "糖糖", "苏州", "刚开始写日记的新人，请多关照～", "#E8A8C8", "糖", ["t-daily", "t-food", "t-suzhou"], 12, 18, 6),
  ];

  const topics = [
    { id: "t-daily", name: "日常点滴", emoji: "🌿", desc: "平凡日子里的小事" },
    { id: "t-family", name: "家人陪伴", emoji: "🤝", desc: "陪伴者与被陪伴者" },
    { id: "t-care", name: "治疗路上", emoji: "🍃", desc: "复查日、等待与安顿自己" },
    { id: "t-rehab", name: "复健打卡", emoji: "✅", desc: "每天一小步" },
    { id: "t-food", name: "好好吃饭", emoji: "🍲", desc: "家常菜与一碗热汤" },
    { id: "t-mood", name: "心情树洞", emoji: "🌙", desc: "说不出口的，写下来" },
    { id: "t-thanks", name: "感谢时刻", emoji: "💌", desc: "谢谢那些接住你的人" },
    { id: "t-nature", name: "窗外风景", emoji: "🌤️", desc: "天空、树和散步的路" },
    { id: "t-suzhou", name: "苏州同城", emoji: "📍", desc: "同城同路人" },
  ];

  const circles = [
    { id: "c-1", name: "苏州友爱小群", intro: "同城同路人，聊聊日常、约慢走、互相打气。", rule: "只聊生活与陪伴，不晒检查单，不推销。", memberCount: 128, todayPostCount: 6, coverEmoji: "📍", coverColor: "#E3EEDF", memberIds: ["u-1", "u-3", "u-6", "u-11", ME_ID] },
    { id: "c-2", name: "午后茶话", intro: "下午三点，泡杯茶，写几句心里话。", rule: "慢慢说，慢慢听，不催促任何人。", memberCount: 86, todayPostCount: 4, coverEmoji: "🍵", coverColor: "#F3EDE3", memberIds: ["u-1", "u-5", "u-8"] },
    { id: "c-3", name: "复健打卡营", intro: "每天一小步，记录身体慢慢回来的感觉。", rule: "只和昨天的自己比，量力而行。", memberCount: 203, todayPostCount: 11, coverEmoji: "✅", coverColor: "#E1EFE9", memberIds: ["u-3", "u-6", "u-10"] },
    { id: "c-4", name: "家属互助角", intro: "照顾别人的人，也值得被好好照顾。", rule: "先抱抱，再说话；不评判别人的选择。", memberCount: 157, todayPostCount: 5, coverEmoji: "💛", coverColor: "#F7ECE4", memberIds: ["u-2", "u-4", "u-9", ME_ID] },
    { id: "c-5", name: "好好吃饭小厨房", intro: "分享家常菜、一碗热汤和厨房里的笑声。", rule: "分享做法和心情，不讨论「吃什么能治病」。", memberCount: 241, todayPostCount: 7, coverEmoji: "🍲", coverColor: "#F8EBDD", memberIds: ["u-7", "u-11", "u-2"] },
    { id: "c-6", name: "深夜树洞", intro: "睡不着的夜里，这里有人醒着陪你。", rule: "只倾听不说教；情绪很重时也请联系身边的人。", memberCount: 119, todayPostCount: 3, coverEmoji: "🌙", coverColor: "#E6E8F2", memberIds: ["u-5", "u-9"] },
  ];

  // [id, userId, circleId, topicIds, title, body, img[c1,c2,emoji]|null, mood, weather, location, likes, hugs, day, hour, min, extra]
  const P = [
    ["p-1", "u-1", "c-1", ["t-daily", "t-suzhou"], "阳台的小太阳",
      "今天苏州阳光很好，把棉被晒了一上午。\n\n中午煮了点青菜粥，吃得很慢。忽然觉得：能把平凡的一天过完整，就已经很了不起了。\n\n写给同路的你们——慢慢来，我们都在。",
      ["#c5d5c2", "#e8dcc8", "☀️"], "calm", "☀️ 晴", "苏州 · 姑苏区", 24, 6, 0, 9, 20, { featured: true }],
    ["p-2", "u-2", "c-4", ["t-family"], "陪爸爸走了两圈",
      "傍晚小区里风有点凉，我给爸爸多加了件外套。\n\n他走得比上周稳一点，还笑着说「明天再多走一圈」。我把这句话记下来了——这比任何励志语都管用。\n\n回家路上他问我累不累，我说不累。其实有点累，但是是那种心里很满的累。",
      ["#d4c4b0", "#e8d5c8", "🚶"], "warm", "⛅ 多云", "上海 · 小区花园", 41, 12, 1, 18, 5, { featured: true }],
    ["p-3", "u-3", "c-3", ["t-rehab", "t-suzhou"], "复健打卡 · 第 40 天",
      "拉伸、慢走、呼吸，一共四十分钟。腿有点酸，但心情很清爽。\n\n打卡不是为了证明什么，只是想告诉身体：我们还在好好对待你。",
      ["#b8d4c8", "#dce8e0", "✅"], "strong", "☀️ 晴", "苏州 · 工业园区", 56, 9, 1, 7, 40],
    ["p-4", "u-4", "c-4", ["t-family", "t-care"], "家属也需要休息",
      "昨晚终于睡了个整觉。白天把照护交接给了妹妹，我去公园坐了一会儿，什么都没想，就看小朋友放风筝。\n\n想对所有家属说：你不是超人。允许自己喘口气，才能陪得更久。\n\n今天回家的时候，我给自己买了一束花。很便宜，但我很喜欢。",
      null, "tired", "☁️ 阴", "南京", 88, 31, 1, 14, 10, { featured: true }],
    ["p-5", "u-5", "c-2", ["t-care", "t-daily"], "复查日的一杯温茶",
      "排队的时候有点紧张，就在心里默念：结果怎样，我都先把自己安顿好。\n\n出来后喝了杯温茶，阳光正好。把这一天轻轻放下，继续往前走。",
      ["#d8c8b8", "#e8e0d0", "🍵"], "nervous", "☀️ 晴", "杭州", 33, 15, 2, 11, 0],
    ["p-6", "u-6", "c-1", ["t-suzhou", "t-nature"], "金鸡湖晚风",
      "约了两位同城朋友沿着湖边慢慢走。不谈病情，只聊晚饭和猫咪。\n\n有时候「什么都不说」也是一种陪伴。苏州的风，今晚很温柔。",
      ["#a8c4d4", "#c8dce8", "🌙"], "calm", "🍃 微风", "苏州 · 金鸡湖", 19, 4, 2, 20, 30],
    ["p-7", "u-1", "c-2", ["t-daily", "t-thanks"], "午后茶话 · 三件小确幸",
      "三点半，泡了茉莉。写下三件小确幸：睡饱了、粥很香、收到一条问候消息。\n\n日子是一点点攒起来的。",
      null, "happy", "☀️ 晴", "苏州", 27, 5, 3, 15, 30],
    ["p-8", "u-3", "c-3", ["t-rehab"], "今天完成了握力练习",
      "按康复师定的量做完了，不多也不少，刚刚好。\n\n记一笔，给明天的自己一个轻轻的点赞。",
      ["#c8d8c0", "#e0e8d8", "💪"], "strong", null, null, 45, 8, 3, 8, 15],
    ["p-9", "u-2", null, ["t-family", "t-food"], "厨房里的笑声",
      "和妈妈一起包饺子，馅料放多了，饺子一个比一个圆。我们笑了很久。\n\n病痛之外，生活还在继续——这本身就是希望。",
      ["#e8d0c0", "#f0e4d8", "🥟"], "happy", "☁️ 阴", "上海", 62, 18, 4, 17, 45],
    ["p-10", "u-5", "c-6", ["t-mood", "t-care"], "把害怕写下来，它就小一点",
      "夜里睡不着，打开日记写下害怕的事。一条一条写，写了七条。\n\n写完后再看一遍，发现很多担心其实还没发生，有两条甚至已经过去了。\n\n感谢这个安静的角落，让我被自己接住。如果你今晚也睡不着，可以在评论里跟我说一句晚安。",
      null, "low", "🌙 夜", "杭州", 71, 40, 5, 23, 10],
    ["p-11", "u-6", "c-1", ["t-suzhou", "t-nature"], "平江路的梧桐",
      "路过平江路，梧桐叶子黄了一半。拍了一张给日记。\n\n城市还是那个城市，人慢慢学会和自己和解。",
      ["#c8b898", "#e0d4b8", "🍂"], "calm", "🍂 秋高", "苏州 · 平江路", 15, 3, 5, 16, 0],
    ["p-12", "u-4", "c-4", ["t-family", "t-thanks"], "互助角的一句谢谢",
      "昨晚有位姐妹私信说「你的分享让我哭了一场，也松了一口气」。\n\n原来被看见，真的能让人喘得过来。家属互助角，谢谢你们在。",
      null, "warm", null, "南京", 94, 37, 6, 9, 50],
    ["p-13", "u-7", "c-5", ["t-food"], "一碗番茄蛋花汤",
      "早上起来煮了一锅番茄蛋花汤，酸酸甜甜。\n\n妈妈喝了小半碗，说「比饭店的好喝」。我知道她是在夸我，但还是开心了一整个上午。",
      ["#f0c8b0", "#f8e4d0", "🍅"], "happy", "🌫️ 薄雾", "成都", 38, 7, 0, 8, 30],
    ["p-14", "u-8", "c-2", ["t-daily", "t-thanks"], "每天一页字 · 第 120 页",
      "今天抄的是「草木蔓发，春山可望」。\n\n写了三十多年板书，退休后才发现，一笔一划写给自己，是另一种安静。手腕有点酸，心里很平。\n\n年轻的朋友们，如果不知道写什么，就抄一句喜欢的话吧，也算记录。",
      ["#e8e0cc", "#f4efe2", "✒️"], "calm", "☀️ 晴", "无锡", 66, 14, 0, 7, 10, { featured: true }],
    ["p-15", "u-9", "c-4", ["t-family"], "周末回家，给妈妈剪了头发",
      "坐了五个小时高铁回家。妈妈说头发长了扎得脖子痒，我就拿出新买的剪刀，在阳台给她剪。\n\n剪得不太齐，她照镜子看了半天，说「挺精神」。我们俩都笑了。\n\n明天又要回北京了。临走前把冰箱塞满，把她爱看的剧下好。下周见，妈妈。",
      ["#e8c4cc", "#f4e0e4", "✂️"], "warm", "☀️ 晴", "北京 → 老家", 79, 26, 1, 21, 0],
    ["p-16", "u-10", null, ["t-nature", "t-mood"], "今天的云像一只猫",
      "下午抬头，一朵云趴在楼顶上，有耳朵有尾巴。\n\n拍下来发给朋友，她回「真的像」。一点点小事，就能让一天变轻。",
      ["#b8d0e0", "#e0ecf4", "☁️"], "happy", "⛅ 多云", "广州 · 珠江边", 52, 6, 2, 17, 20],
    ["p-17", "u-11", "c-1", ["t-daily", "t-mood"], "第一次写日记，有点不好意思",
      "看了大家好多天，今天鼓起勇气发第一篇。\n\n没什么特别的事：早上喝了豆浆，下午睡了个午觉，晚上和室友视频。就是想说一句，谢谢这里的大家，看你们的日记让我觉得不孤单。",
      null, "nervous", "☀️ 晴", "苏州", 31, 22, 0, 10, 40],
    ["p-18", "u-7", "c-5", ["t-food", "t-family"], "给爸爸炖了一锅萝卜排骨",
      "小火炖了两个小时，萝卜都透明了。\n\n爸爸平时不爱说话，今天主动添了一碗。这大概就是他说「好吃」的方式。",
      ["#e8d8c0", "#f4ece0", "🍲"], "warm", "🌧️ 小雨", "成都", 47, 9, 3, 18, 40],
    ["p-19", "u-3", "c-3", ["t-rehab", "t-suzhou"], "复健打卡 · 第 33 天：下雨就在家练",
      "外面下雨，没出门。在客厅铺了瑜伽垫，跟着视频做了二十分钟拉伸。\n\n老伴在旁边给我数数，数着数着她自己也跟着做起来了。",
      ["#c0d0d8", "#dce6ec", "🌧️"], "strong", "🌧️ 雨", "苏州", 36, 5, 8, 9, 0],
    ["p-20", "u-8", null, ["t-thanks", "t-care"], "给护士站送了一张小卡片",
      "陪老伴复查，顺手写了一张卡片给护士站：「谢谢你们每天的耐心」。\n\n小姑娘接过去看了好久，说这是她这周收到最开心的东西。原来一句谢谢，两边都会被温暖。",
      null, "warm", null, "无锡", 58, 16, 4, 11, 20],
    ["p-21", "u-9", "c-6", ["t-mood", "t-family"], "夜里想妈妈",
      "加班到很晚，回到出租屋突然很想家。\n\n给妈妈发了条消息，她秒回「还没睡？早点睡」。我盯着这几个字看了很久，然后就睡着了。",
      null, "low", "🌙 夜", "北京", 64, 33, 6, 1, 30],
    ["p-22", "u-10", "c-3", ["t-rehab", "t-nature"], "晨走八千步，看见了日出",
      "六点出门，沿着江边慢慢走。走到第五千步的时候，太阳刚好出来。\n\n以前总觉得日出要去山顶看，原来家门口也有。",
      ["#f4c8a0", "#f8e4c8", "🌅"], "strong", "🌅 晴", "广州", 43, 4, 7, 6, 40],
    ["p-23", "u-5", "c-6", ["t-mood"], "睡不着的时候我做三件事",
      "一、把手机调暗，写三行日记。\n二、喝几口温水。\n三、对自己说：今天已经过完了，明天的事明天再说。\n\n不一定马上睡着，但心会先安静下来。分享给同样醒着的你。",
      null, "calm", "🌙 夜", "杭州", 82, 29, 8, 23, 40],
    ["p-24", "u-11", "c-5", ["t-food", "t-daily"], "学会了煮小米粥",
      "照着小厨房里青柚姐的做法，小火熬了四十分钟，终于熬出了米油！\n\n给自己拍了张照，感觉今天是个会做饭的大人了。",
      ["#f0e0b0", "#f8f0d8", "🥣"], "happy", "☀️ 晴", "苏州", 29, 3, 9, 9, 10],
    ["p-25", "u-2", "c-4", ["t-family", "t-care"], "陪诊包里我会放的五样东西",
      "陪家人跑医院一年多，包里慢慢固定成这五样：保温杯、充电宝、小毯子、一本薄书、一张写给自己的便签。\n\n便签上写的是「等待的时候，也照顾好你自己」。\n\n分享给刚开始做陪伴者的朋友，不是什么攻略，只是让等待的时间不那么难熬。",
      ["#d8d0c0", "#ece6dc", "🎒"], "calm", null, "上海", 103, 21, 10, 20, 0],
    ["p-26", "u-4", "c-4", ["t-family", "t-mood"], "女儿画了一张全家福",
      "六岁的女儿画了一张全家福，每个人都在笑，外婆戴着一顶粉色帽子。\n\n她说「外婆的帽子最好看」。我把画贴在了冰箱上。",
      ["#f0d0d8", "#f8e8ec", "🖍️"], "warm", null, "南京", 91, 28, 11, 19, 30],
    ["p-27", "u-6", "c-1", ["t-suzhou", "t-daily"], "同城慢走小队 · 第 3 次集合",
      "这次来了五个人，从相门走到耦园，一个小时。\n\n糖糖带了橘子，老周带了保温壶，我们在河边分着吃。下次想去石湖，有人一起吗？",
      ["#c8dcc0", "#e4eedc", "🚶‍♀️"], "happy", "☀️ 晴", "苏州 · 相门", 40, 7, 12, 18, 0],
    ["p-28", "u-1", "c-2", ["t-daily", "t-nature"], "桂花落了一地",
      "楼下桂花落了一地，香味还在。捡了一小把放在茶杯边。\n\n秋天快过完了，我还在，这就很好。",
      ["#f4e4b0", "#faf2d8", "🌼"], "calm", "🍂 秋高", "苏州", 34, 6, 13, 16, 10],
    ["p-29", "u-8", "c-2", ["t-thanks"], "三十年前的学生来看我",
      "下午门铃响，是我第一届的学生，现在自己也当了老师。\n\n她带了一盒点心，说「陈老师，您当年的作文评语我还留着」。我嘴上说没什么，心里高兴了一整天。",
      null, "warm", null, "无锡", 75, 19, 13, 10, 0],
    ["p-me-1", ME_ID, "c-1", ["t-daily"], "第一次把日记分享出来",
      "以前写日记都只给自己看。今天想试试分享出来。\n\n今天和家人去公园走了一圈，桂花还没谢完，风是甜的。\n\n不需要谁给建议，只是想被看见一下。谢谢愿意读到这里的你。",
      ["#c5d5c2", "#e8dcc8", "🌿"], "warm", "☀️ 晴", "苏州", 36, 14, 2, 21, 0, { diaryId: "d-seed-3" }],
    ["p-me-2", ME_ID, "c-4", ["t-thanks", "t-family"], "谢谢那位帮我们推轮椅的陌生人",
      "今天在医院门口的坡道，轮椅卡住了。一位穿灰外套的大哥走过来，什么都没说，帮我们推了上去，然后就走了。\n\n我没来得及说谢谢，就写在这里吧。愿你今天也被好好对待。",
      null, "warm", "☁️ 阴", "苏州", 58, 21, 5, 19, 0, { diaryId: "d-seed-6" }],
  ];

  const posts = P.map((r) => {
    const [id, userId, circleId, topicIds, title, body, img, mood, weather, location, likeCount, hugCount, d, h, m, extra] = r;
    return Object.assign(
      {
        id, userId, circleId, topicIds, title, body,
        images: img ? [imagePlaceholder(img[0], img[1], img[2])] : [],
        mood, weather, location, likeCount, hugCount,
        likedByMe: false,
        createdAt: daysAgo(d, h, m),
        visibility: "public",
      },
      extra || {}
    );
  });
  ["p-3", "p-9"].forEach((id) => { posts.find((p) => p.id === id).likedByMe = true; });

  // [postId, userId, body, hoursAfterPost]
  const C = [
    ["p-1", "u-6", "晒被子的味道，最治愈。", 0.7],
    ["p-1", "u-2", "青菜粥听起来好温暖，我也去煮一碗。", 1.8],
    ["p-1", "u-11", "「能把平凡的一天过完整就很了不起」——抄进我的日记本了。", 2.5],
    ["p-1", "u-8", "阳光照在被子上的样子，我都能想象出来。", 3.5],
    ["p-2", "u-4", "「明天再多走一圈」，这句话太好了。抱抱你们。", 1],
    ["p-2", "u-1", "心里很满的累，我懂。辛苦了。", 1.6],
    ["p-2", "u-5", "风凉记得添衣，你和爸爸都是。", 2],
    ["p-2", "u-9", "看哭了，想起我爸。替我也陪他多走一圈。", 3],
    ["p-3", "u-6", "40 天！向你学习，稳稳的。", 0.4],
    ["p-3", "u-1", "打卡加油，同城有空一起慢走。", 1.5],
    ["p-3", "u-10", "「还在好好对待你」，这句话我也想对自己说。", 4],
    ["p-4", "u-2", "说得太对了。家属也要被接住。", 0.8],
    ["p-4", "u-5", "整觉真的太重要了，你值得那束花。", 2.3],
    ["p-4", "u-9", "我也是家属，今天读到这篇松了一口气。原来不是只有我会累。", 3],
    ["p-4", "u-7", "给你买花的自己点个赞 🌷", 5],
    ["p-4", "u-8", "照顾好自己，也是在照顾家人。", 7],
    ["p-5", "u-1", "温茶 + 阳光，给我也续上勇气。", 1],
    ["p-5", "u-4", "先把自己安顿好——我记下了。不管结果怎样，你都不是一个人。", 2.2],
    ["p-5", "u-11", "排队的时候我也会默念，原来大家都一样。", 5],
    ["p-6", "u-3", "金鸡湖晚上很适合慢慢走，下次喊我。", 0.5],
    ["p-6", "u-1", "不谈病情的陪伴，最舒服。", 1.2],
    ["p-7", "u-5", "三件小确幸，我也学着写。", 0.5],
    ["p-7", "u-8", "收到问候的那一刻，最暖。", 2],
    ["p-8", "u-2", "刚刚好，就是最好的。", 0.7],
    ["p-8", "u-6", "轻轻点赞回给你。", 2],
    ["p-9", "u-4", "饺子圆圆的，日子也圆圆的。", 0.8],
    ["p-9", "u-1", "厨房笑声太治愈了。", 1.2],
    ["p-9", "u-7", "馅多才好吃！下次可以试试白菜猪肉加一点香菇。", 2],
    ["p-10", "u-4", "写下来，恐惧就小一点——同感。晚安。", 0.5],
    ["p-10", "u-2", "晚安。你被接住了，我们都在。", 0.9],
    ["p-10", "u-9", "我也睡不着，晚安，一起等天亮。", 1.2],
    ["p-10", "u-8", "七条写出来就不是一团乱麻了。孩子，晚安。", 8],
    ["p-10", "u-11", "收藏了这个方法，谢谢你愿意说出来。", 10],
    ["p-11", "u-1", "平江路的梧桐，同款秋天。", 1],
    ["p-11", "u-10", "黄了一半的时候最好看。", 3],
    ["p-12", "u-2", "谢谢你愿意分享，抱抱所有家属。", 0.7],
    ["p-12", "u-5", "被看见，真的能让人喘过来。", 1.2],
    ["p-12", "u-9", "我就是被你那篇接住的人之一，谢谢。", 2],
    ["p-13", "u-11", "番茄蛋花汤是我的童年！", 0.6],
    ["p-13", "u-2", "被妈妈夸的开心，能撑好几天。", 1.5],
    ["p-14", "u-1", "「草木蔓发，春山可望」，好美。陈老师的字一定很好看。", 0.8],
    ["p-14", "u-5", "今天就抄一句试试。", 1.5],
    ["p-14", "u-9", "看到第 120 页，觉得坚持也可以很安静。", 3],
    ["p-15", "u-4", "「挺精神」三个字，好温柔。", 0.5],
    ["p-15", "u-2", "把冰箱塞满再走，是我们这代人表达爱的方式吧。", 1],
    ["p-15", "u-7", "抱抱，五个小时高铁辛苦了。", 1.5],
    ["p-15", "u-8", "妈妈一定很骄傲有你这个女儿。", 3],
    ["p-15", "u-6", "下周见，替你说一句。", 6],
    ["p-16", "u-1", "真的像！耳朵都看到了。", 0.5],
    ["p-16", "u-3", "明天我也抬头看看。", 2],
    ["p-17", "u-6", "欢迎糖糖！第一篇写得很好，慢慢来。", 0.3],
    ["p-17", "u-4", "欢迎你，这里不用写特别的事，平常的一天就很好。", 0.6],
    ["p-17", "u-1", "同城的，下次慢走小队一起呀。", 0.9],
    ["p-17", "u-8", "第一篇最珍贵，好好留着。", 1.2],
    ["p-17", "u-2", "看到你说不孤单，我也不孤单了。", 1.6],
    ["p-18", "u-2", "萝卜都透明了，隔着屏幕闻到香味。", 1],
    ["p-18", "u-11", "爸爸添的那一碗，就是五星好评。", 2],
    ["p-19", "u-6", "老伴跟着做，这画面太可爱了。", 1],
    ["p-19", "u-10", "雨天在家练也算数！", 3],
    ["p-20", "u-4", "一句谢谢，两边都被温暖。说得真好。", 1],
    ["p-20", "u-5", "我下次也写一张。", 2],
    ["p-21", "u-4", "「早点睡」就是妈妈版的「我爱你」。", 6],
    ["p-21", "u-5", "我也常常这样，抱抱你。", 7],
    ["p-21", "u-7", "周末就回家啦，再坚持几天。", 9],
    ["p-22", "u-3", "第五千步的日出，值得。", 1],
    ["p-22", "u-1", "家门口的日出，最珍贵。", 3],
    ["p-23", "u-9", "第三条对我最有用，谢谢。", 1],
    ["p-23", "u-4", "收藏了，转给我妹妹看。", 9],
    ["p-23", "u-11", "今晚试试。晚安林夏姐。", 10],
    ["p-24", "u-7", "米油熬出来了！你已经出师了 👏", 0.5],
    ["p-24", "u-6", "会做饭的大人，你好。", 2],
    ["p-25", "u-4", "便签那句话戳到我了。等待的时候，也照顾好你自己。", 0.6],
    ["p-25", "u-9", "下次回家我也准备一个小包。谢谢分享。", 1.2],
    ["p-25", "u-8", "小毯子很重要，候诊区常常有点凉。", 3],
    ["p-26", "u-2", "粉色帽子，外婆一定很喜欢。", 0.7],
    ["p-26", "u-5", "贴在冰箱上，每天都能看到笑脸。", 1.5],
    ["p-27", "u-11", "橘子很甜吧！石湖我报名～", 1],
    ["p-27", "u-3", "石湖算我一个，保温壶继续带。", 2],
    ["p-28", "u-6", "我在，这就很好。", 1],
    ["p-29", "u-1", "被记住，是老师最好的礼物。", 1.5],
    ["p-29", "u-5", "陈阿姨好棒，这样的老师值得被一直记住。", 3],
    // 「我」的分享收到的回应（被接住）
    ["p-me-1", "u-1", "被看见了！欢迎你把日记分享出来，风是甜的这句好喜欢。", 0.4],
    ["p-me-1", "u-4", "不需要建议，只是想被看见——我们都看见你啦，抱抱。", 0.9],
    ["p-me-1", "u-11", "我也是最近才开始分享，一起加油。", 1.5],
    ["p-me-1", "u-6", "同城！下次慢走小队欢迎你和家人一起。", 3],
    ["p-me-1", "u-8", "第一次分享很需要勇气，写得很好。", 12],
    ["p-me-2", "u-2", "穿灰外套的大哥，谢谢你。也谢谢你把这件事写下来。", 0.5],
    ["p-me-2", "u-9", "看完鼻子一酸，世界上还是好人多。", 1],
    ["p-me-2", "u-5", "愿你和家人也一直被好好对待。", 2],
    ["p-me-2", "u-8", "替那位大哥收下你的谢谢。", 5],
  ];

  const postById = {};
  posts.forEach((p) => { postById[p.id] = p; });
  const comments = C.map((r, i) => {
    const [postId, userId, body, hrs] = r;
    let t = new Date(postById[postId].createdAt).getTime() + hrs * 3600000;
    if (t > NOW - 60000) t = NOW - (3 + i % 20) * 60000;
    return { id: "cm-" + (i + 1), postId, userId, body, createdAt: new Date(t).toISOString() };
  });

  // 「我」的个人日记 seed：最近连续 5 天 + 更早两篇（今天留空，引导「今天记一笔」续上连续天数）
  const diaries = [
    { id: "d-seed-1", day: 1, h: 21, title: "阳光里的一小杯水", mood: "calm", tags: ["心情平稳", "小确幸"], visibility: "private",
      body: "阳光很好，喝了一杯温热的柠檬水。\n\n身体慢慢恢复中，心也安静了。没有什么大事，可这一小杯热水，已经足够温暖今天。\n\n慢慢来，我们都在变好。" },
    { id: "d-seed-2", day: 2, h: 10, title: "早上的豆浆", mood: "happy", tags: ["小确幸"], visibility: "private",
      body: "楼下早餐店的阿姨记得我要少糖。\n\n被记住的感觉，真好。" },
    { id: "d-seed-3", day: 2, h: 20, title: "第一次把日记分享出来", mood: "warm", tags: ["家人陪伴", "户外"], visibility: "public", topicIds: ["t-daily"],
      body: "以前写日记都只给自己看。今天想试试分享出来。\n\n今天和家人去公园走了一圈，桂花还没谢完，风是甜的。\n\n不需要谁给建议，只是想被看见一下。谢谢愿意读到这里的你。",
      image: ["#c5d5c2", "#e8dcc8", "🌿"] },
    { id: "d-seed-4", day: 3, h: 22, title: "有点累的一天", mood: "tired", tags: ["需要休息"], visibility: "private",
      body: "今天事情有点多，跑了两趟。\n\n晚上泡了脚，给自己写一句：累了就早点睡，明天再说。" },
    { id: "d-seed-5", day: 4, h: 15, title: "和家人散步", mood: "calm", tags: ["家人陪伴", "户外"], visibility: "private",
      body: "傍晚和家人在公园走了走，聊了聊开心的事。\n\n风有点凉，但身边有人，感觉很踏实。平凡的陪伴，是最安心的时刻。" },
    { id: "d-seed-6", day: 5, h: 19, title: "谢谢那位帮我们推轮椅的陌生人", mood: "warm", tags: ["感恩"], visibility: "public", topicIds: ["t-thanks"],
      body: "今天在医院门口的坡道，轮椅卡住了。一位穿灰外套的大哥走过来，什么都没说，帮我们推了上去，然后就走了。\n\n我没来得及说谢谢，就写在这里吧。愿你今天也被好好对待。" },
    { id: "d-seed-7", day: 8, h: 9, title: "复查前一天", mood: "nervous", tags: ["治疗路上"], visibility: "private",
      body: "明天要去复查，有点紧张。\n\n把要带的东西都放进包里了。今晚早点睡，明天不管怎样，先把自己照顾好。" },
    { id: "d-seed-8", day: 10, h: 16, title: "窗外的云", mood: "happy", tags: ["小确幸"], visibility: "private",
      body: "午睡醒来，窗外的云很低很白。\n\n什么都不做，看了十分钟。" },
  ].map((d) => ({
    id: d.id, title: d.title, body: d.body, tags: d.tags, mood: d.mood,
    images: d.image ? [imagePlaceholder(d.image[0], d.image[1], d.image[2])] : [],
    createdAt: daysAgo(d.day, d.h, 0),
    visibility: d.visibility, topicIds: d.topicIds || [],
  }));

  // 分享后模拟「同路人回应」用的温暖短句（演示）
  const warmReplies = [
    "看见你了，抱抱。谢谢你愿意分享。",
    "读完心里暖暖的，今天辛苦啦。",
    "这一天被你好好记下来了，真好。",
    "慢慢来，我们都在。",
    "我也有过这样的一天，你不是一个人。",
    "谢谢你把平凡的一天写得这么温柔。",
  ];

  // 评论区快捷暖语
  const quickReplies = ["抱抱你 🤗", "看见你了", "谢谢你愿意分享", "我也是", "慢慢来，我们都在", "今天辛苦啦"];

  // 记录页「不知道写什么」提示
  const prompts = [
    "今天让我安心的一件小事是",
    "今天想谢谢",
    "身体今天的感觉是",
    "今天吃到的一口好吃的是",
    "此刻窗外",
    "想对明天的自己说",
  ];

  global.YouaiSeed = {
    ME_ID,
    COMMUNITY_KEY: "youai_community_v2",
    LEGACY_KEYS: ["youai_community_v1"],
    DIARY_SEED_FLAG: "youai_diary_seed_v2",
    MOODS, users, topics, circles, posts, comments, diaries,
    warmReplies, quickReplies, prompts,
    avatarDataUri, imagePlaceholder, daysAgo,
  };
})(typeof window !== "undefined" ? window : globalThis);
