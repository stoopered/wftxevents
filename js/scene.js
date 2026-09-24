// Low-poly zombies shambling toward the camera, getting tagged with glow
// paint, and falling apart. Pure procedural geometry -- no model files.
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas || !window.THREE) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  } catch {
    return;
  }

  const isMobile = innerWidth < 720;
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1 : 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060a);
  scene.fog = new THREE.Fog(0x07060a, 12, 40);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  camera.position.set(0, 2.4, 10);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x0d0b10, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  scene.add(new THREE.AmbientLight(0x4a5e4a, 1.2));
  const moon = new THREE.DirectionalLight(0x8090b8, 1.1);
  moon.position.set(-6, 12, -4);
  scene.add(moon);
  const blacklight = new THREE.PointLight(0x39ff14, 2.2, 28);
  blacklight.position.set(0, 3.5, 7);
  scene.add(blacklight);

  // Shared geometry, per-zombie materials (so each can glow on its own).
  const G = {
    head: new THREE.BoxGeometry(0.46, 0.46, 0.46),
    torso: new THREE.BoxGeometry(0.72, 0.9, 0.42),
    arm: new THREE.BoxGeometry(0.2, 0.82, 0.2).translate(0, -0.41, 0),
    leg: new THREE.BoxGeometry(0.26, 0.9, 0.26).translate(0, -0.45, 0),
    eye: new THREE.BoxGeometry(0.08, 0.08, 0.06),
    splat: new THREE.SphereGeometry(0.12, 6, 5),
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  function makeZombie() {
    const skin = new THREE.MeshStandardMaterial({ color: 0x5c7a4c, roughness: 0.95, emissive: 0x0a1f08, emissiveIntensity: 0.5 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x2b2632, roughness: 1 });
    const eye = new THREE.MeshStandardMaterial({ color: 0x39ff14, emissive: 0x39ff14, emissiveIntensity: 2.5 });

    const group = new THREE.Group();
    const mesh = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };

    const parts = {
      torso: mesh(G.torso, cloth, 0, 1.4, 0),
      head: mesh(G.head, skin, 0, 2.1, 0),
      lArm: mesh(G.arm, skin, -0.48, 1.78, 0),
      rArm: mesh(G.arm, skin, 0.48, 1.78, 0),
      lLeg: mesh(G.leg, cloth, -0.2, 0.95, 0),
      rLeg: mesh(G.leg, cloth, 0.2, 0.95, 0),
    };
    const eyeL = new THREE.Mesh(G.eye, eye);
    eyeL.position.set(-0.11, 0.05, 0.24);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.11;
    parts.head.add(eyeL, eyeR);

    // Arms out front, classic.
    parts.lArm.rotation.x = -1.35 + rand(-0.2, 0.2);
    parts.rArm.rotation.x = -1.35 + rand(-0.2, 0.2);
    parts.head.rotation.z = rand(-0.25, 0.25);

    scene.add(group);
    const z = { group, parts, mats: [skin, cloth, eye], state: 'walk', t: rand(0, 10), speed: rand(0.55, 1.05), debris: [] };
    respawn(z, true);
    return z;
  }

  function respawn(z, initial = false) {
    for (const p of Object.values(z.parts)) {
      z.group.add(p);
      p.rotation.set(0, 0, 0);
    }
    const P = z.parts;
    P.torso.position.set(0, 1.4, 0);
    P.head.position.set(0, 2.1, 0);
    P.lArm.position.set(-0.48, 1.78, 0);
    P.rArm.position.set(0.48, 1.78, 0);
    P.lLeg.position.set(-0.2, 0.95, 0);
    P.rLeg.position.set(0.2, 0.95, 0);
    P.lArm.rotation.x = P.rArm.rotation.x = -1.35 + rand(-0.2, 0.2);
    P.head.rotation.z = rand(-0.25, 0.25);
    z.mats[0].emissiveIntensity = 0.5;
    z.mats[0].emissive.setHex(0x0a1f08);
    z.mats[1].emissive.setHex(0x000000);

    // First spawn is spread across the whole field so the scene isn't empty
    // for the first 30 seconds; respawns come in from the back.
    const spread = Math.max(2.5, Math.min(9, 9 * innerWidth / innerHeight)); // keep them on-screen on phones
    z.group.position.set(rand(-spread, spread), 0, initial ? rand(-26, 3) : rand(-30, -16));
    z.group.rotation.set(0, 0, 0);
    z.state = 'walk';
    z.speed = rand(0.55, 1.05);
    z.collapseAt = rand(0, 4.5); // z position where it gets tagged; far enough that parts don't fly into the camera
  }

  function tag(z) {
    z.state = 'hit';
    z.timer = 0;
    // Paint hit: the whole body lights up.
    z.mats[0].emissive.setHex(0x39ff14);
    z.mats[0].emissiveIntensity = 1.6;
    z.mats[1].emissive.setHex(0x1a5a12);

    // Splat particles
    const origin = new THREE.Vector3();
    z.parts.torso.getWorldPosition(origin);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(G.splat, new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 1 }));
      m.position.copy(origin);
      m.userData.vel = new THREE.Vector3(rand(-2.5, 2.5), rand(1, 4), rand(-1, 2.5));
      m.userData.life = 0;
      scene.add(m);
      z.debris.push(m);
    }
  }

  function collapse(z) {
    z.state = 'fall';
    z.timer = 0;
    for (const p of Object.values(z.parts)) {
      scene.attach(p); // keep world transform, leave the group
      p.userData.vel = new THREE.Vector3(rand(-1.2, 1.2), rand(0.5, 2.5), rand(0.5, 2));
      p.userData.ang = new THREE.Vector3(rand(-4, 4), rand(-4, 4), rand(-4, 4));
      p.userData.rest = 0.2;
    }
    z.parts.head.userData.vel.y += 1.5;
  }

  const zombies = [];
  const count = isMobile ? 5 : 9;
  for (let i = 0; i < count; i++) zombies.push(makeZombie());

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  let last = performance.now();
  let running = true;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    resize();

    const t = now / 1000;
    camera.position.x = Math.sin(t * 0.25) * 0.4;
    camera.lookAt(0, 1.3, 0);
    blacklight.intensity = 2.0 + Math.sin(t * 9) * 0.25 + Math.sin(t * 23) * 0.1;

    for (const z of zombies) {
      const P = z.parts;
      z.t += dt;

      if (z.state === 'walk' || z.state === 'hit') {
        const g = z.group;
        const lurch = 1 + Math.sin(z.t * 4) * 0.35;
        g.position.z += z.speed * lurch * dt;
        g.position.y = Math.abs(Math.sin(z.t * 4)) * 0.06;
        g.rotation.z = Math.sin(z.t * 2) * 0.05;
        g.rotation.y = Math.sin(z.t * 0.7) * 0.15;
        P.lLeg.rotation.x = Math.sin(z.t * 4) * 0.55;
        P.rLeg.rotation.x = -Math.sin(z.t * 4) * 0.55;
        P.lArm.rotation.z = Math.sin(z.t * 3) * 0.12;
        P.rArm.rotation.z = -Math.sin(z.t * 3) * 0.12;
        P.head.rotation.y = Math.sin(z.t * 1.3) * 0.3;

        if (z.state === 'walk' && g.position.z > z.collapseAt) tag(z);
        if (z.state === 'hit') {
          z.timer += dt;
          z.mats[0].emissiveIntensity = 1.6 + Math.sin(z.timer * 30) * 0.5;
          if (z.timer > 0.45) collapse(z);
        }
      } else if (z.state === 'fall' || z.state === 'sink') {
        z.timer += dt;
        for (const p of Object.values(P)) {
          const u = p.userData;
          if (z.state === 'fall') {
            u.vel.y -= 7 * dt;
            p.position.addScaledVector(u.vel, dt);
            p.rotation.x += u.ang.x * dt;
            p.rotation.y += u.ang.y * dt;
            p.rotation.z += u.ang.z * dt;
            if (p.position.y < u.rest) {
              p.position.y = u.rest;
              u.vel.y = Math.abs(u.vel.y) * 0.25;
              u.vel.x *= 0.6;
              u.vel.z *= 0.6;
              u.ang.multiplyScalar(0.5);
            }
          } else {
            p.position.y -= 0.45 * dt;
          }
        }
        z.mats[0].emissiveIntensity = Math.max(0.3, z.mats[0].emissiveIntensity - dt * 0.6);
        if (z.state === 'fall' && z.timer > 2.8) { z.state = 'sink'; z.timer = 0; }
        if (z.state === 'sink' && z.timer > 1.6) respawn(z);
      }

      // Splat particles
      for (let i = z.debris.length - 1; i >= 0; i--) {
        const m = z.debris[i];
        m.userData.life += dt;
        m.userData.vel.y -= 6 * dt;
        m.position.addScaledVector(m.userData.vel, dt);
        m.material.opacity = Math.max(0, 1 - m.userData.life / 0.9);
        if (m.userData.life > 0.9) {
          scene.remove(m);
          m.material.dispose();
          z.debris.splice(i, 1);
        }
      }
    }

    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  requestAnimationFrame(frame);
})();
