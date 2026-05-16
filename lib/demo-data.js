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
    recommendationReason: "正好能卡住晚霞最亮的 10 分钟",
    shootingTips: [
      "沿着江边栏杆站，给天空留出三分之二画面",
      "等一艘船或一个骑车的人经过，再按快门",
      "优先拍江面反光和建筑剪影，不要把主体顶满画面",
    ],
  },
  mid: {
    score: 52,
    scoreLabel: "可以顺路看看",
    peakOffsetMinutes: 4,
    peakDuration: 10,
    timelineColors: DEMO_COLORSETS.mid,
    recommendationReason: "云层有层次，但颜色爆发不会太久",
    shootingTips: [
      "找能看到西侧天际线的位置，尽量避开高楼遮挡",
      "先拍一张广角江景，再补一张近景细节",
      "如果颜色没起来，就把重点放到街灯和人物轮廓",
    ],
  },
  low: {
    score: 25,
    scoreLabel: "今天歇着",
    peakOffsetMinutes: 2,
    peakDuration: 6,
    timelineColors: DEMO_COLORSETS.low,
    recommendationReason: "厚云和低能见度会把颜色压住",
    shootingTips: [
      "别特意跨区跑，最多在附近路口抬头看一眼",
      "如果一定要拍，改拍路面反光或阴天氛围",
      "今天更适合留体力，等下一次高分场景再出门",
    ],
  },
};

module.exports = {
  DEMO_PROFILES,
  DEMO_COLORSETS,
};
