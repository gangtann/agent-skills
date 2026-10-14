# 分镜元数据（gen_storyboard.py 读取；时长从 timeline.json 自动填入）
# 每个镜头：scene 场景，shot 景别与运镜，picture 画面描述，onscreen 画面文字/数据（含出处），sound 音乐与音效，trans 转场
CHAPTERS = {'S01': '序', 'CH1': '01 第一章标题'}   # 镜头 id → 分镜表里的章节分隔行
STYLE = None   # 视觉系统说明（list[str]）；None 用 gen_storyboard.py 里的默认（深夜冷蓝 + 屏幕暖光那一套）

SHOTS = {
 "S01": dict(scene="城市夜景 · 3D", shot="摇臂：从街面升到高空", picture="三维城市，窗户稀疏亮着", onscreen="凌晨两点", sound="城市深夜白噪音；音乐：低频长音进入", trans="黑场渐显"),
 "TITLE": dict(scene="片名", shot="俯瞰城市的缓慢环绕", picture="城市虚化成光斑，片名浮现", onscreen="片名", sound="音乐一记低音重拍", trans="淡入淡出"),
 "CH1": dict(scene="章节卡", shot="静帧，光斑缓慢漂移", picture="", onscreen="01 第一章标题", sound="音乐过渡", trans="淡入淡出"),
 "S02": dict(scene="数据", shot="正面，条形生长 + 数字滚动", picture="琥珀色条形从左向右生长", onscreen="48.6 小时｜来源 · 年份", sound="数据出现时的轻击声", trans="硬切"),
 "S03": dict(scene="结尾", shot="静帧，光点缓慢呼吸", picture="深色天空，一颗暖色光点", onscreen="金句两行", sound="音乐余韵", trans="黑场"),
}
