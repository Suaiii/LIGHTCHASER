const DEMO_COLORSETS = {
  high: [
    "#3A4A6B",
    "#53607B",
    "#7A6A61",
    "#A87557",
    "#C98557",
    "#E0A060",
    "#D96C5B",
    "#B54F60",
    "#7A436B",
    "#5A3870",
  ],
  mid: [
    "#43536E",
    "#596579",
    "#6F6D72",
    "#8D7568",
    "#A98263",
    "#B78A68",
    "#9C6E67",
    "#7D5D6A",
    "#61556E",
    "#4D4F68",
  ],
  low: [
    "#485565",
    "#4A5664",
    "#515A66",
    "#5B6270",
    "#676A74",
    "#706D75",
    "#6A6570",
    "#5F5969",
    "#534758",
  ],
};

const DEMO_PROFILES = {
  high: {
    score: 87,
    scoreLabel: "值得跑出门",
    peakOffsetMinutes: 6,
    peakDuration: 14,
    timelineColors: DEMO_COLORSETS.high,
    recommendationReason: "现在出发刚好，桥面能吃到晚霞最亮的 10 分钟",
    shootingTips: [
      "站到桥的北侧栏杆边，把苏州河留在画面下三分之一",
      "等一艘游船或一个骑车的人经过，让剪影压住天空",
      "先锁住江面反光，再把镜头微微抬到建筑边线",
    ],
  },
  mid: {
    score: 52,
    scoreLabel: "可以顺路看看",
    peakOffsetMinutes: 4,
    peakDuration: 10,
    timelineColors: DEMO_COLORSETS.mid,
    recommendationReason: "今晚颜色不会爆，但河面和街灯会有一层暖光",
    shootingTips: [
      "别专门跨区，顺路去最近的桥或江边开阔处就够了",
      "把天空少拍一点，多留街灯、栏杆和水面反光",
      "如果云层压住颜色，就拍人物轮廓和城市黄昏感",
    ],
  },
  low: {
    score: 25,
    scoreLabel: "今天歇着",
    peakOffsetMinutes: 2,
    peakDuration: 6,
    timelineColors: DEMO_COLORSETS.low,
    recommendationReason: "厚云会把颜色闷住，今天不值得为晚霞赶路",
    shootingTips: [
      "别特意出门，最多在附近路口抬头看一眼",
      "如果已经在外面，就改拍湿路面、橱窗或路灯反光",
      "把体力留给下一次高分晚霞，今天早点收工",
    ],
  },
};

module.exports = {
  DEMO_PROFILES,
  DEMO_COLORSETS,
};
