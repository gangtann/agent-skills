// 三维城市：程序生成楼群 + 窗灯贴图 + 路灯光点 + 车流
const City = (() => {
  let renderer, scene, camera, bldMat, towerMat, sky, skyCtx, skyTex, lamps, cars, carData, ground, hemi, sun, built = false;
  const R = rng(20261013);
  // 横屏视野更宽：城市铺得更大，竖直视角收窄（各镜头的 fov 按竖屏设计，横屏乘 FOVK），让城市边缘不进画面
  const SP = 34, N = W > H ? 40 : 26, FOVK = W > H ? .72 : 1;

  function winTex(seed, pLit, palette, dark = '#000000', cols = 32, rows = 64) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
    const g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = dark; g.fillRect(0, 0, 512, 1024);
    const cw = 512 / cols, ch = 1024 / rows;
    const dens = []; for (let k = 0; k < 64; k++) dens.push(Math.pow(r(), 1.6) * 2.4);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const lit = r() < pLit * dens[(Math.floor(j / 8) * 8 + Math.floor(i / 4)) % 64];
      g.fillStyle = lit ? palette[Math.floor(r() * palette.length)] : '#020306';
      if (lit) g.globalAlpha = .55 + r() * .45; else g.globalAlpha = 1;
      g.fillRect(i * cw + cw * .18, j * ch + ch * .22, cw * .64, ch * .56);
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8; return t;
  }
  // 手写合并：每栋楼一个盒子，UV 按尺寸缩放，窗户大小统一
  function buildingsGeometry(list) {
    const pos = [], nor = [], uv = [], idx = [];
    let base = 0;
    for (const b of list) {
      const { x, z, w, d, h, off } = b, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      const faces = [
        [[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], w],
        [[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], w],
        [[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], d],
        [[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], d],
      ];
      for (const [a, b2, c, dd, n, len] of faces) {
        pos.push(...a, ...b2, ...c, ...dd); for (let k = 0; k < 4; k++) nor.push(...n);
        const u0 = off[0], v0 = off[1], u1 = u0 + len / 100, v1 = v0 + h / 100;   // 每 64 单位一张贴图（32×64 窗）
        uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3); base += 4;
      }
      // 楼顶
      pos.push(x0, h, z1, x1, h, z1, x1, h, z0, x0, h, z0); for (let k = 0; k < 4; k++) nor.push(0, 1, 0);
      uv.push(0, 0, 0, 0, 0, 0, 0, 0); idx.push(base, base + 1, base + 2, base, base + 2, base + 3); base += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); return g;
  }
  function spriteTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.5; renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, W / H, 1, 30000);
    // 天空
    const sc = document.createElement('canvas'); sc.width = 4; sc.height = 512; skyCtx = sc.getContext('2d');
    skyTex = new THREE.CanvasTexture(sc); skyTex.colorSpace = THREE.SRGBColorSpace; scene.background = skyTex;
    scene.fog = new THREE.FogExp2(0x0a1424, 0.0016);
    hemi = new THREE.HemisphereLight(0x3a5a8a, 0x05070c, 0.5); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffb070, 0); sun.position.set(-600, 120, -400); scene.add(sun);
    // 楼群
    const list = [];
    for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
      if (Math.abs(i) <= 0 && Math.abs(j) <= 0) continue;
      const nb = 1 + Math.floor(R() * 2);
      for (let k = 0; k < nb; k++) {
        const w = 10 + R() * 16, d = 10 + R() * 16;
        const dist = Math.hypot(i, j), hm = Math.exp(-dist / 9);
        const h = 14 + Math.pow(R(), 2.2) * (60 + 220 * hm) + (R() < .04 ? 120 * hm : 0);
        list.push({ x: i * SP + (R() - .5) * 8 + (k ? 9 : 0), z: j * SP + (R() - .5) * 8, w, d, h, off: [Math.floor(R() * 8) / 8, Math.floor(R() * 16) / 16] });
      }
    }
    bldMat = new THREE.MeshStandardMaterial({ color: 0x05080f, roughness: .9, metalness: .05,
      emissive: 0xffffff, emissiveMap: winTex(7, .22, ['#ffd29a', '#ffc27a', '#cfe0ff', '#9fc0ff', '#ffe6c0']), emissiveIntensity: 1.2 });
    bldMat.map = null;
    scene.add(new THREE.Mesh(buildingsGeometry(list), bldMat));
    // 中心写字楼
    towerMat = new THREE.MeshStandardMaterial({ color: 0x0d1626, roughness: .3, metalness: .6, emissive: 0xffffff,
      emissiveMap: winTex(11, .86, ['#e8f1ff', '#d6e6ff', '#fff3dc', '#c9dcff'], '#000000', 24, 64), emissiveIntensity: 1.5 });
    const tower = new THREE.Mesh(buildingsGeometry([{ x: 0, z: 0, w: 26, d: 26, h: 330, off: [0, 0] }]), towerMat);
    scene.add(tower);
    // 地面
    ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ color: 0x070b13, roughness: .6, metalness: .3 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    // 路灯
    const lp = [], spr = spriteTex();
    for (let i = -N; i <= N; i++) for (let s = -N * SP; s <= N * SP; s += 9) {
      lp.push(i * SP + SP / 2, 2.5, s); lp.push(s, 2.5, i * SP + SP / 2);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lamps = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffa24a, size: 3.2, map: spr, alphaTest: .01, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9 }));
    scene.add(lamps);
    // 车流
    carData = []; const cp = [], cc = [];
    for (let k = 0; k < 900; k++) {
      const axis = R() < .5, lane = (Math.floor(R() * (2 * N + 1)) - N) * SP + SP / 2 + (R() < .5 ? -2 : 2), dir = R() < .5 ? 1 : -1;
      carData.push({ axis, lane, dir, s: (R() - .5) * 2 * N * SP, v: 18 + R() * 20 });
      cp.push(0, 1.2, 0); const red = dir > 0; cc.push(red ? 1 : 1, red ? .25 : .92, red ? .2 : .8);
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    cars = new THREE.Points(cg, new THREE.PointsMaterial({ size: 2.2, map: spr, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(cars);
    built = true;
  }
  function setBg(hex) { const col = new THREE.Color(hex); scene.background = col; scene.fog.color.copy(col); }
  function setSky(stops) {
    const g = skyCtx.createLinearGradient(0, 0, 0, 512); stops.forEach(([o, c]) => g.addColorStop(o, c));
    skyCtx.fillStyle = g; skyCtx.fillRect(0, 0, 4, 512); skyTex.needsUpdate = true;
  }
  function updateCars(t) {
    const a = cars.geometry.attributes.position, L = N * SP;
    carData.forEach((c, i) => {
      let s = ((c.s + c.dir * c.v * t + L) % (2 * L)) - L;
      if (c.axis) a.setXYZ(i, s, 1.2, c.lane); else a.setXYZ(i, c.lane, 1.2, s);
    });
    a.needsUpdate = true;
  }
  // mode: night | tower | dawn ；p 为镜头内进度
  function render(mode, lt, p, o = {}) {
    if (!built) return;
    updateCars(lt + (o.carT || 0));
    cars.visible = lamps.visible = mode !== 'tower';
    cars.material.sizeAttenuation = lamps.material.sizeAttenuation = true;
    if (mode === 'night' || mode === 'title') {
      setBg('#0a1424'); scene.fog.density = mode === 'night' ? lerp(.0016, .00055, ease(p)) : .0006;
      hemi.intensity = .18; sun.intensity = 0; bldMat.emissiveIntensity = o.win ?? 2.2; towerMat.emissiveIntensity = .9;
      lamps.material.opacity = .9; cars.material.opacity = 1;
      if (mode === 'night') {           // 摇臂：街面 → 高空
        const e = ease(p);
        camera.position.set(lerp(60, 520, e), lerp(14, 640, e), lerp(260, 900, e));
        camera.lookAt(lerp(-40, 0, e), lerp(90, 120, e), lerp(-200, -700, e));
        camera.fov = 46;
      } else {
        const a = -.6 + p * .25;
        camera.position.set(Math.sin(a) * 900, 420, Math.cos(a) * 900); camera.lookAt(-Math.sin(a) * 300, 90, -Math.cos(a) * 300); camera.fov = 44;
      }
    } else if (mode === 'tower') {      // 仰拍写字楼
      setBg('#0a1426'); scene.fog.density = .0011;
      hemi.intensity = .25; bldMat.emissiveIntensity = 1.8; towerMat.emissiveIntensity = 2.2; sun.intensity = 0;
      const e = ease(p);
      camera.position.set(85, 5, 210); camera.fov = 54;
      camera.lookAt(0, lerp(70, 250, e), 0);
    } else if (mode === 'dawn') {
      const e = ease(p);
      setBg(mix('#2a3550', '#d8a27e', e)); scene.fog.density = .0013;
      hemi.color.set(0x8fa8d0); hemi.intensity = lerp(.6, 1.3, e); sun.intensity = lerp(.2, 2.2, e);
      bldMat.emissiveIntensity = lerp(.7, .08, e); towerMat.emissiveIntensity = lerp(.6, .05, e);
      lamps.material.opacity = lerp(.7, 0, e); cars.material.opacity = lerp(.8, .2, e);
      const a = .9 - p * .3;
      camera.position.set(Math.sin(a) * 820, 260, Math.cos(a) * 820); camera.lookAt(-Math.sin(a) * 200, 110, -Math.cos(a) * 200); camera.fov = 46;
    }
    camera.fov *= FOVK; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  return { init, render };
})();
