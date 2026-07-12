#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AGENT_01 机位库校验脚本
用法: python validate_spots.py [spots.v1.json]
退出码: 0 = 无 error(可含 warning) ; 1 = 存在 error
仅用标准库，无外部依赖。
"""
import json
import re
import sys

SCENE_ENUM = {"sunset", "skyline", "exhibition", "cafe"}
COMPOSE_ENUM = {"thirds", "leading", "silhouette", "frame"}
REQUIRED = [
    "id", "name", "scene", "lat", "lng", "stand_desc", "bearing",
    "best_window", "focal", "compose_template", "filters",
    "sample_img", "sample_credit", "consent_ref",
    "walk_steps", "copy_slots", "tags",
]
COPY_KEYS = {"hook", "tip1", "tip2", "tip3"}
# 深圳市域大致范围（含宝安/龙华/大鹏，留余量）
SZ_LAT = (22.40, 22.90)
SZ_LNG = (113.70, 114.70)
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
# 场景最低配比
SCENE_MIN = {"sunset": 14, "skyline": 4, "exhibition": 5, "cafe": 2}


def to_minutes(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "spots.v1.json"
    errors, warnings = [], []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:  # noqa
        print("ERROR 无法读取/解析 JSON: %s" % exc)
        sys.exit(1)

    spots = data.get("spots", [])
    seen_ids = set()
    scene_count = {}

    for i, s in enumerate(spots):
        tag = "spots[%d] id=%s" % (i, s.get("id", "?"))

        # 字段完整性
        for field in REQUIRED:
            if field not in s:
                errors.append("%s 缺字段 %s" % (tag, field))

        # id 唯一
        sid = s.get("id")
        if sid in seen_ids:
            errors.append("%s id 重复" % tag)
        seen_ids.add(sid)

        # scene 枚举 + 计数
        scene = s.get("scene")
        if scene not in SCENE_ENUM:
            errors.append("%s scene 非法: %s" % (tag, scene))
        else:
            scene_count[scene] = scene_count.get(scene, 0) + 1

        # compose_template 枚举
        if s.get("compose_template") not in COMPOSE_ENUM:
            errors.append("%s compose_template 非法: %s" % (tag, s.get("compose_template")))

        # 坐标范围
        lat, lng = s.get("lat"), s.get("lng")
        if not isinstance(lat, (int, float)) or not (SZ_LAT[0] <= lat <= SZ_LAT[1]):
            errors.append("%s lat 越界深圳市域: %s" % (tag, lat))
        if not isinstance(lng, (int, float)) or not (SZ_LNG[0] <= lng <= SZ_LNG[1]):
            errors.append("%s lng 越界深圳市域: %s" % (tag, lng))

        # bearing
        b = s.get("bearing")
        if not isinstance(b, (int, float)) or not (0 <= b < 360):
            errors.append("%s bearing 非 [0,360): %s" % (tag, b))

        # best_window
        bw = s.get("best_window")
        if not isinstance(bw, list) or len(bw) != 2:
            errors.append("%s best_window 需为2元素数组" % tag)
        else:
            if not (isinstance(bw[0], str) and TIME_RE.match(bw[0])):
                errors.append("%s best_window[0] 时间格式错: %s" % (tag, bw[0]))
            if not (isinstance(bw[1], str) and TIME_RE.match(bw[1])):
                errors.append("%s best_window[1] 时间格式错: %s" % (tag, bw[1]))
            if all(isinstance(x, str) and TIME_RE.match(x) for x in bw):
                if to_minutes(bw[0]) >= to_minutes(bw[1]):
                    errors.append("%s best_window 起点须早于终点" % tag)

        # filters
        flt = s.get("filters")
        if not isinstance(flt, list) or len(flt) < 1:
            errors.append("%s filters 至少1个" % tag)

        # walk_steps 3-5
        ws = s.get("walk_steps")
        if not isinstance(ws, list) or not (3 <= len(ws) <= 5):
            errors.append("%s walk_steps 需3-5条, 实际=%s" % (tag, len(ws) if isinstance(ws, list) else "非数组"))

        # copy_slots 四键
        cs = s.get("copy_slots", {})
        if not isinstance(cs, dict) or set(cs.keys()) != COPY_KEYS:
            errors.append("%s copy_slots 键须恰为 {hook,tip1,tip2,tip3}" % tag)
        else:
            if len(cs.get("hook", "")) > 26:
                warnings.append("%s hook 超26字(%d)，待AGENT_03精修" % (tag, len(cs["hook"])))
            for k in ("tip1", "tip2", "tip3"):
                if len(cs.get(k, "")) > 15:
                    warnings.append("%s %s 超15字(%d)" % (tag, k, len(cs[k])))

        # C5: 样张三件套 同空或同非空
        trio = [s.get("sample_img", ""), s.get("sample_credit", ""), s.get("consent_ref", "")]
        n_filled = sum(1 for x in trio if x)
        if n_filled not in (0, 3):
            errors.append("%s 样张三件套须同空或同非空(现填%d/3)" % (tag, n_filled))

        # C4(软): sunset 机位 bearing 应大体朝西 240-300
        if scene == "sunset" and isinstance(b, (int, float)) and not (240 <= b <= 300):
            warnings.append("%s sunset 机位 bearing=%s 不在240-300, 需在readme说明例外" % (tag, b))

    # 总数与配比
    if len(spots) != 25:
        errors.append("记录数=%d, 期望25" % len(spots))
    for sc, mn in SCENE_MIN.items():
        if scene_count.get(sc, 0) < mn:
            errors.append("场景 %s 配比不足: %d < %d" % (sc, scene_count.get(sc, 0), mn))

    # 输出
    print("=== validate_spots 结果 ===")
    print("记录数: %d" % len(spots))
    print("场景计数: %s" % json.dumps(scene_count, ensure_ascii=False))
    print("Errors: %d" % len(errors))
    for e in errors:
        print("  [ERROR] %s" % e)
    print("Warnings: %d" % len(warnings))
    for w in warnings:
        print("  [WARN] %s" % w)
    print("=== %s ===" % ("PASS (0 error)" if not errors else "FAIL"))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
