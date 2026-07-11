/* LIGHTCHASER · 滤镜 manifest
 * 抖音风胶片滤镜选择器 · 5 大品牌 23 套
 *
 * 字段约定:
 *   key            内部 preset key 与 ai-camera-core.js FILTER_PRESETS 对齐
 *   brand          fuji / kodak / agfa / fresh / mono —— UI 分组用
 *   brandLabel     UI 顶部 chip 中文名
 *   name           显示在卡片中下方的滤镜全名(模拟相机/胶卷型号)
 *   label          1-2 字风格副名
 *   description    一句话情绪描述
 *   preset         真实 fallback 调色参数(对应 core 里的 brightness/contrast/saturation/warmth/grayscale)
 *   grain          颗粒强度 0..1 (UI 层叠)
 *   vignette       暗角强度 0..1 (UI 层叠)
 *   scene          出图用的场景描述
 *   ai_prompt      喂给 matrix_generate_image 的实际提示词
 *   demo           demo 图路径 (AI 生成后填)
 *   pack           品牌胶卷包装图(可共用,UI 底部)
 *
 * AI 生成返回的图片用 matrix_upload_to_cdn 下载到本目录后填 demo 字段。
 */

const FILTER_DEMOS_MANIFEST = {
  filters: [
    // ===================== 富士 8 =====================
    {
      key: "F_PROVIA",
      brand: "fuji",
      brandLabel: "富士",
      name: "F PROVIA",
      label: "通用百搭",
      description: "真实准确的色彩还原,风景和日常的基准负片",
      preset: { brightness: 2, contrast: 1.02, saturation: 1.05, warmth: 2, grayscale: false },
      grain: 0.18,
      vignette: 0.18,
      iconColors: ["#ffd400", "#0b3b88"],
      scene: "明亮阳光下蓝天白房子的街道景色,温和自然",
      ai_prompt:
        "A photo-realistic photograph styled as a Fujifilm PROVIA 100F slide film demonstration. " +
        "Bright sunny day, white Mediterranean-style houses on a narrow cobbled street, blue sky, " +
        "natural and accurate color rendering. Subtle natural film grain. Photojournalistic style. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark, no logos.",
      demo: "/assets/filter-demos/f_provia.jpg"
    },
    {
      key: "F_VELVIA",
      brand: "fuji",
      brandLabel: "富士",
      name: "F Velvia",
      label: "鲜艳色彩",
      description: "极致饱和与对比,风景摄影的不二之选",
      preset: { brightness: 4, contrast: 1.12, saturation: 1.28, warmth: 2, grayscale: false },
      grain: 0.20,
      vignette: 0.22,
      iconColors: ["#ffd400", "#1f8f3b"],
      scene: "鲜艳饱和的秋色山峦湖泊风景",
      ai_prompt:
        "A photo-realistic photograph styled as a Fujifilm Velvia 50 vivid color slide film demonstration. " +
        "Autumn mountain landscape with vivid red maple forest reflecting in a still blue lake, " +
        "extreme color saturation, deep contrast, brilliant sky and foliage. Subtle film grain. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark, no logos.",
      demo: "/assets/filter-demos/f_velvia.jpg"
    },
    {
      key: "F_C_CHROME",
      brand: "fuji",
      brandLabel: "富士",
      name: "F C-Chrome",
      label: "街头叙事",
      description: "纪实冷调,街头与人文的胶片质感",
      preset: { brightness: 1, contrast: 1.12, saturation: 0.78, warmth: -2, grayscale: false },
      grain: 0.24,
      vignette: 0.26,
      iconColors: ["#ffd400", "#222222"],
      scene: "城市小巷里戴帽子的青年侧面肖像,自然光",
      ai_prompt:
        "A photo-realistic photograph styled as a Fujifilm Classic Chrome film demonstration. " +
        "Street portrait of a young man wearing a beanie hat standing in a narrow urban alley, " +
        "side daylight, muted cool documentary color, slightly desaturated, deep greens and teals, " +
        "natural film grain. Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/f_c_chrome.jpg"
    },
    {
      key: "F_ASTIA",
      brand: "fuji",
      brandLabel: "富士",
      name: "F ASTIA",
      label: "柔和彩色",
      description: "低反差柔和过渡,人像与肤色的温柔表达",
      preset: { brightness: 5, contrast: 0.92, saturation: 1.04, warmth: 8, grayscale: false },
      grain: 0.14,
      vignette: 0.16,
      iconColors: ["#ffd400", "#f4b3b3"],
      scene: "窗边柔光下的少女半身像,自然肤色",
      ai_prompt:
        "A photo-realistic photograph styled as a Fujifilm ASTIA 100F soft color slide film demonstration. " +
        "Half-body portrait of a young woman standing by a bright window, soft natural skin tones, " +
        "low contrast pastel palette, gentle highlights, light film grain. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/f_astia.jpg"
    },
    {
      key: "F_CLASSIC_NEG",
      brand: "fuji",
      brandLabel: "富士",
      name: "F Classic Neg.",
      label: "经典负片",
      description: "高对比暖调,街头与夜景的复古胶片",
      preset: { brightness: 0, contrast: 1.18, saturation: 0.92, warmth: 4, grayscale: false },
      grain: 0.26,
      vignette: 0.32,
      iconColors: ["#ffd400", "#7d3c14"],
      scene: "暖光下的便利店霓虹街景,夜晚",
      ai_prompt:
        "A photo-realistic photograph styled as a Fujifilm Classic Negative film demonstration. " +
        "Urban night street scene with a warm-lit convenience store and neon signs, " +
        "strong contrast, warm orange and teal shadows, vintage film look, visible grain. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/f_classic_neg.jpg"
    },
    {
      key: "F_ACROS",
      brand: "fuji",
      brandLabel: "富士",
      name: "F ACROS",
      label: "黑白银盐",
      description: "高细节黑白,纹理与人像的银盐美感",
      preset: { brightness: 0, contrast: 1.22, saturation: 0, warmth: 0, grayscale: true },
      grain: 0.30,
      vignette: 0.30,
      iconColors: ["#1a1a1a", "#cccccc"],
      scene: "侧光下老人面部特写,黑白高细节",
      ai_prompt:
        "A photo-realistic black-and-white photograph styled as a Fujifilm ACROS 100 silver halide film demonstration. " +
        "Extreme close-up portrait of an elderly man's face lit from the side, deep smooth tonality, " +
        "high detail in wrinkles, classic silver halide grain. " +
        "Pure aesthetic B&W film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/f_acros.jpg"
    },
    {
      key: "F_NOSTALGIC_NEG",
      brand: "fuji",
      brandLabel: "富士",
      name: "F Nostalgic Neg.",
      label: "怀旧负片",
      description: "复古暖黄,家庭相册式的怀旧情绪",
      preset: { brightness: 4, contrast: 1.06, saturation: 0.86, warmth: 16, grayscale: false },
      grain: 0.28,
      vignette: 0.34,
      iconColors: ["#ffd400", "#d8a264"],
      scene: "午后阳光下的家庭合照,旧物陈列",
      ai_prompt:
        "A photo-realistic photograph styled as a Fujifilm Nostalgic Negative film demonstration. " +
        "Warm afternoon sunlight across a vintage living room with a wooden family photo frame, " +
        "an old brass clock, dried flowers, a family album on the table, golden warm cast, " +
        "soft nostalgic film grain. Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/f_nostalgic_neg.jpg"
    },
    {
      key: "F_BLEACH_BYPASS",
      brand: "fuji",
      brandLabel: "富士",
      name: "F Bleach Bypass",
      label: "漂白旁路",
      description: "低饱和高对比电影感,雨夜与冷峻",
      preset: { brightness: -4, contrast: 1.22, saturation: 0.62, warmth: -4, grayscale: false },
      grain: 0.30,
      vignette: 0.36,
      iconColors: ["#ffd400", "#5d6371"],
      scene: "雨夜街灯下的柏油路反光",
      ai_prompt:
        "A photo-realistic photograph styled as a Fujifilm Bleach Bypass film demonstration. " +
        "Rainy night urban street with reflections of street lamps on wet asphalt, " +
        "low color saturation, high contrast cinematic look, cool steel-blue and slate tonality, " +
        "strong film grain. Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/f_bleach_bypass.jpg"
    },

    // ===================== 柯达 5 =====================
    {
      key: "K_PORTRA_160",
      brand: "kodak",
      brandLabel: "柯达",
      name: "K Portra 160",
      label: "奶白人像",
      description: "极低饱和奶白,柔和到骨子里的肤色",
      preset: { brightness: 6, contrast: 1.0, saturation: 0.78, warmth: 14, grayscale: false },
      grain: 0.18,
      vignette: 0.18,
      iconColors: ["#f5e0b8", "#a86c2c"],
      scene: "逆光下金发女孩人像特写,奶白肤色",
      ai_prompt:
        "A photo-realistic photograph styled as a Kodak Portra 160 film demonstration. " +
        "Backlit close-up portrait of a young woman with blonde hair, soft creamy skin tones, " +
        "gentle pastel palette, classic Portra low-contrast warm pastel look, " +
        "light film grain. Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/k_portra_160.jpg"
    },
    {
      key: "K_PORTRA_400",
      brand: "kodak",
      brandLabel: "柯达",
      name: "K Portra 400",
      label: "米黄人像",
      description: "暖色温柔,日常人像的首选负片",
      preset: { brightness: 4, contrast: 1.04, saturation: 0.92, warmth: 18, grayscale: false },
      grain: 0.22,
      vignette: 0.22,
      iconColors: ["#e8c987", "#3a2820"],
      scene: "公园长椅上的情侣背影,秋天",
      ai_prompt:
        "A photo-realistic photograph styled as a Kodak Portra 400 film demonstration. " +
        "Couple sitting on a park bench seen from behind in golden autumn afternoon, " +
        "soft warm pastel color, gentle skin tones, classic Portra 400 warmth, " +
        "subtle film grain. Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/k_portra_400.jpg"
    },
    {
      key: "K_EKTAR_100",
      brand: "kodak",
      brandLabel: "柯达",
      name: "K Ektar 100",
      label: "风景鲜艳",
      description: "鲜艳冷感,自然风景的高饱和表达",
      preset: { brightness: 2, contrast: 1.14, saturation: 1.22, warmth: -6, grayscale: false },
      grain: 0.16,
      vignette: 0.18,
      iconColors: ["#d75b29", "#1c1c1c"],
      scene: "秋日高山湖泊风景,雪山",
      ai_prompt:
        "A photo-realistic photograph styled as a Kodak Ektar 100 film demonstration. " +
        "Vivid autumn mountain landscape with snow-capped peaks reflecting in a clear alpine lake, " +
        "deep saturated reds oranges and cool blues, high contrast, finest grain. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/k_ektar_100.jpg"
    },
    {
      key: "K_GOLD_200",
      brand: "kodak",
      brandLabel: "柯达",
      name: "K Gold 200",
      label: "暖金日常",
      description: "日光金黄,生活街拍的胶片温度",
      preset: { brightness: 6, contrast: 1.04, saturation: 1.06, warmth: 22, grayscale: false },
      grain: 0.22,
      vignette: 0.24,
      iconColors: ["#e6a91a", "#7c1f10"],
      scene: "咖啡店窗边的报纸咖啡杯,温暖午后",
      ai_prompt:
        "A photo-realistic photograph styled as a Kodak Gold 200 film demonstration. " +
        "Cozy cafe scene by a sunny window with a folded newspaper and a steaming coffee cup on a wooden table, " +
        "warm golden afternoon light, classic warm Kodak everyday color, visible film grain. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/k_gold_200.jpg"
    },
    {
      key: "K_TRI_X_400",
      brand: "kodak",
      brandLabel: "柯达",
      name: "K Tri-X 400",
      label: "黑白经典",
      description: "高对比黑白,街头摄影的传承者",
      preset: { brightness: 0, contrast: 1.32, saturation: 0, warmth: 0, grayscale: true },
      grain: 0.36,
      vignette: 0.32,
      iconColors: ["#1c1c1c", "#e4c5a0"],
      scene: "雨中撑伞的路人,黑白高对比街头",
      ai_prompt:
        "A photo-realistic black-and-white photograph styled as a Kodak Tri-X 400 film demonstration. " +
        "Rainy street scene with a pedestrian holding an umbrella, deep shadows and bright highlights, " +
        "very high contrast, gritty expressive film grain, classic street photojournalism. " +
        "Pure aesthetic B&W film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/k-tri-x-400.jpg"
    },

    // ===================== Agfa 4 =====================
    {
      key: "A_VISTA_PLUS_200",
      brand: "agfa",
      brandLabel: "Agfa",
      name: "A Vista Plus 200",
      label: "清冷通透",
      description: "偏冷淡雅,极简与建筑的冷静表达",
      preset: { brightness: 4, contrast: 1.02, saturation: 0.86, warmth: -14, grayscale: false },
      grain: 0.18,
      vignette: 0.22,
      iconColors: ["#0f6b56", "#e3edec"],
      scene: "极简建筑阴天外景,水泥玻璃",
      ai_prompt:
        "A photo-realistic photograph styled as an Agfa Vista Plus 200 film demonstration. " +
        "Minimalist concrete and glass facade of a modern building under overcast sky, " +
        "cool muted teal and grey palette, calm daylight, slight cool cast, subtle film grain. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/a-vista-plus-200.jpg"
    },
    {
      key: "A_VISTA_200",
      brand: "agfa",
      brandLabel: "Agfa",
      name: "A Vista 200",
      label: "清淡日常",
      description: "鲜艳自然,夏日与生活的清爽",
      preset: { brightness: 4, contrast: 1.04, saturation: 1.08, warmth: -4, grayscale: false },
      grain: 0.20,
      vignette: 0.20,
      iconColors: ["#1f8f7a", "#f6e98a"],
      scene: "海边度假小镇彩色房子,蓝天",
      ai_prompt:
        "A photo-realistic photograph styled as an Agfa Vista 200 film demonstration. " +
        "Bright coastal village with colorful seaside houses under clear blue summer sky, " +
        "fresh natural saturation, clean vivid color, daylight film stock look, " +
        "light film grain. Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/a_vista_200.jpg"
    },
    {
      key: "A_OPTIMA_200",
      brand: "agfa",
      brandLabel: "Agfa",
      name: "A Optima 200",
      label: "柔和鲜艳",
      description: "暖色鲜艳,花园与植物的浓郁",
      preset: { brightness: 4, contrast: 1.06, saturation: 1.16, warmth: 10, grayscale: false },
      grain: 0.20,
      vignette: 0.22,
      iconColors: ["#bf2525", "#f5b830"],
      scene: "阳光下的玫瑰花园,花卉色彩浓郁",
      ai_prompt:
        "A photo-realistic photograph styled as an Agfa Optima 200 film demonstration. " +
        "Sunlit rose garden in full bloom with layered warm reds, oranges and yellow flowers, " +
        "soft contrast, rich warm color rendition, classic Agfa daylight look, " +
        "subtle film grain. Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/a_optima_200.jpg"
    },
    {
      key: "A_ULTRA_100",
      brand: "agfa",
      brandLabel: "Agfa",
      name: "A Ultra 100",
      label: "细腻通透",
      description: "高细节低饱和,城市与建筑的精确纹理",
      preset: { brightness: 2, contrast: 1.04, saturation: 0.88, warmth: -2, grayscale: false },
      grain: 0.12,
      vignette: 0.16,
      iconColors: ["#9aa6a8", "#ffffff"],
      scene: "欧洲老街外墙纹理,几何细节",
      ai_prompt:
        "A photo-realistic photograph styled as an Agfa Ultra 100 film demonstration. " +
        "European old town street corner with detailed brick and stone wall textures and arched doorway, " +
        "fine detail, low saturation muted color, neutral tonality, very fine grain. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/a_ultra_100.jpg"
    },

    // ===================== 清新人像 3 =====================
    {
      key: "FRESH_GLOW",
      brand: "fresh",
      brandLabel: "清新",
      name: "Fresh Glow",
      label: "清新发光",
      description: "柔和高亮通透感,清新日系的皮肤美感",
      preset: { brightness: 10, contrast: 0.96, saturation: 0.96, warmth: 6, grayscale: false },
      grain: 0.10,
      vignette: 0.10,
      iconColors: ["#9be0e8", "#fff7d8"],
      scene: "白T女孩在户外光斑下,清新通透",
      ai_prompt:
        "A photo-realistic photograph styled as a fresh airy portrait filter demonstration. " +
        "Young woman wearing a simple white T-shirt standing in dappled sunlight under trees, " +
        "clean bright skin, soft pastel palette, glowing highlights, fresh Japanese-style airy look. " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/fresh_glow.jpg"
    },
    {
      key: "SOFT_SKIN",
      brand: "fresh",
      brandLabel: "清新",
      name: "Soft Skin",
      label: "柔肤",
      description: "极致柔肤的人像优化,日常也能像写真",
      preset: { brightness: 8, contrast: 0.92, saturation: 0.98, warmth: 8, grayscale: false },
      grain: 0.10,
      vignette: 0.12,
      iconColors: ["#fce0d4", "#f6a89b"],
      scene: "柔光棚里女性侧脸特写,无瑕皮肤",
      ai_prompt:
        "A photo-realistic photograph styled as a soft-skin portrait filter demonstration. " +
        "Studio-lit close-up side portrait of a young woman, exceptionally smooth flawless skin, " +
        "soft warm palette, low contrast, very gentle highlights, " +
        "Pure aesthetic film photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/soft_skin.jpg"
    },
    {
      key: "PORCELAIN_SKIN",
      brand: "fresh",
      brandLabel: "清新",
      name: "Porcelain",
      label: "瓷肌",
      description: "极致干净光滑白皙,瓷器般的肤质",
      preset: { brightness: 12, contrast: 0.9, saturation: 0.86, warmth: 4, grayscale: false },
      grain: 0.08,
      vignette: 0.10,
      iconColors: ["#fff7f3", "#e3c4be"],
      scene: "白底前瓷娃娃般的白皙女肖像",
      ai_prompt:
        "A photo-realistic photograph styled as a porcelain-skin portrait filter demonstration. " +
        "Front-facing portrait of a young woman with porcelain-pale smooth skin on a clean white background, " +
        "very bright airy exposure, ultra-smooth skin texture, soft cool warm palette, " +
        "minimal contrast. Pure aesthetic photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/porcelain_skin.jpg"
    },

    // ===================== 黑白 3 =====================
    {
      key: "MONO_CLASSIC",
      brand: "mono",
      brandLabel: "黑白",
      name: "Mono Classic",
      label: "经典黑白",
      description: "标准黑白,干净中性的人像与风景",
      preset: { brightness: 0, contrast: 1.12, saturation: 0, warmth: 0, grayscale: true },
      grain: 0.16,
      vignette: 0.18,
      iconColors: ["#222222", "#9a9a9a"],
      scene: "西装男子侧脸,标准中性黑白人像",
      ai_prompt:
        "A photo-realistic black-and-white photograph styled as a classic monochrome filter demonstration. " +
        "Side profile portrait of a young man in a suit, clean balanced grayscale tones, " +
        "neutral contrast, fine classic grain. " +
        "Pure aesthetic B&W photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/mono_classic.jpg"
    },
    {
      key: "MONO_FADE",
      brand: "mono",
      brandLabel: "黑白",
      name: "Mono Fade",
      label: "褪色黑白",
      description: "高光轻度褪色的胶片感,复古温情",
      preset: { brightness: 8, contrast: 0.92, saturation: 0, warmth: 0, grayscale: true },
      grain: 0.22,
      vignette: 0.22,
      iconColors: ["#5b5b5b", "#ffffff"],
      scene: "海边老旧小屋,褪色高光",
      ai_prompt:
        "A photo-realistic black-and-white photograph styled as a faded monochrome film demonstration. " +
        "Old weathered seaside wooden cottage by a calm beach, slightly bleached highlights, " +
        "soft contrast, lifted blacks, vintage faded film print look, subtle grain. " +
        "Pure aesthetic B&W photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/mono_fade.jpg"
    },
    {
      key: "MONO_HIGH",
      brand: "mono",
      brandLabel: "黑白",
      name: "Mono High",
      label: "高反差黑白",
      description: "极端高对比,低光街头的张力",
      preset: { brightness: -4, contrast: 1.42, saturation: 0, warmth: 0, grayscale: true },
      grain: 0.34,
      vignette: 0.30,
      iconColors: ["#000000", "#ffffff"],
      scene: "隧道尽头的剪影,深黑哑光",
      ai_prompt:
        "A photo-realistic black-and-white photograph styled as a high-contrast monochrome filter demonstration. " +
        "Silhouette of a walking figure at the end of a dark urban underpass/tunnel, " +
        "extreme contrast between pure black shadows and bright light at the tunnel end, " +
        "dramatic low-key look, heavy expressive grain. " +
        "Pure aesthetic B&W photograph, no text, no UI, no watermark.",
      demo: "/assets/filter-demos/mono_high.jpg"
    },
  ],

  // 品牌胶卷包装 —— 5 个品牌,横图
  packaging: [
    {
      brand: "fuji",
      brandLabel: "富士",
      ai_prompt:
        "A product photograph of a real Fujifilm PROVIA 100F 135/36 35mm color reversal film canister, " +
        "the iconic black plastic 35mm film roll inside its original cardboard box, " +
        "with Fujifilm's signature yellow label, blue and red accent stripes, " +
        "PROVIA 100F branding clearly visible, " +
        "studio product photography, clean white surface, soft directional lighting, " +
        "high resolution, photo-real. No watermark, no overlay text.",
      file: "/assets/film-packaging/fuji.jpg"
    },
    {
      brand: "kodak",
      brandLabel: "柯达",
      ai_prompt:
        "A product photograph of a real Kodak Portra 400 135/36 35mm color negative film canister, " +
        "the iconic Kodak yellow and red film box showing the gold-on-black Portra labeling, " +
        "studio product photography, clean white surface, warm soft directional lighting, " +
        "high resolution, photo-real. No watermark, no overlay text.",
      file: "/assets/film-packaging/kodak.jpg"
    },
    {
      brand: "agfa",
      brandLabel: "Agfa",
      ai_prompt:
        "A product photograph of a real Agfa Vista Plus 200 135/36 35mm color negative film canister, " +
        "with the iconic Agfa dark green and silver packaging design, " +
        "studio product photography, clean white surface, cool soft directional lighting, " +
        "high resolution, photo-real. No watermark, no overlay text.",
      file: "/assets/film-packaging/agfa.jpg"
    },
    {
      brand: "fresh",
      brandLabel: "清新",
      ai_prompt:
        "A product photograph of a real Kodak Professional Portra 400 film canister, " +
        "showing its smooth cream-yellow packaging, presented as the 'fresh portrait' stock, " +
        "studio product photography, clean white surface, soft warm directional lighting, " +
        "high resolution, photo-real. No watermark, no overlay text.",
      file: "/assets/film-packaging/fresh.jpg"
    },
    {
      brand: "mono",
      brandLabel: "黑白",
      ai_prompt:
        "A product photograph of a real Ilford HP5 Plus 400 black-and-white 35mm film canister, " +
        "with the iconic black-and-white packaging with orange accent stripe, " +
        "studio product photography, clean white surface, soft directional lighting, " +
        "high resolution, photo-real. No watermark, no overlay text.",
      file: "/assets/film-packaging/mono.jpg"
    }
  ],

  // 品牌分组顺序(给 UI 用)
  brandOrder: ["fuji", "kodak", "agfa", "fresh", "mono"]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = FILTER_DEMOS_MANIFEST;
}
if (typeof window !== "undefined") {
  window.LightchaserFilterManifest = FILTER_DEMOS_MANIFEST;
}
