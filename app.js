(() => {
  const host = document.querySelector("#canvas-host");
  const controls = {
    gravity: document.querySelector("#gravity-control"),
    frequency: document.querySelector("#frequency-control"),
    size: document.querySelector("#size-control"),
    bounce: document.querySelector("#bounce-control"),
    deform: document.querySelector("#deform-control"),
    drift: document.querySelector("#drift-control"),
    ripple: document.querySelector("#ripple-control"),
    colorMode: document.querySelector("#color-control"),
    phrase: document.querySelector("#phrase-input"),
    pause: document.querySelector("#pause-button"),
    reset: document.querySelector("#reset-button"),
    rain: document.querySelector("#rain-button"),
    save: document.querySelector("#save-button"),
    panelToggle: document.querySelector("#panel-toggle"),
    panel: document.querySelector(".control-shell"),
  };
  const status = {
    state: document.querySelector("#status-state"),
    count: document.querySelector("#status-count"),
    time: document.querySelector("#status-time"),
  };

  if (!host || !window.p5) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const defaultCharacters = Array.from("水雨云雾河海潮流滴落风波泉露墨静空");
  const palettes = {
    ink: { text: "#151412", accent: "#b42f20", splash: "#1e1d1a", glow: "#b42f20" },
    cinnabar: { text: "#7b1d13", accent: "#c43a26", splash: "#b42f20", glow: "#f05a3f" },
    jade: { text: "#153e35", accent: "#007f66", splash: "#1c7b68", glow: "#00a987" },
    blue: { text: "#10182f", accent: "#1357ff", splash: "#174de0", glow: "#3a74ff" },
  };

  let sketchApi;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;

  function settings() {
    const reduced = reducedMotionQuery.matches;
    return {
      gravity: Number(controls.gravity.value),
      frequency: reduced ? 0.08 : Number(controls.frequency.value),
      size: Number(controls.size.value) * (window.innerWidth < 700 ? 0.74 : 1),
      bounce: Number(controls.bounce.value),
      deform: reduced ? Number(controls.deform.value) * 0.35 : Number(controls.deform.value),
      drift: reduced ? Number(controls.drift.value) * 0.18 : Number(controls.drift.value),
      ripple: reduced ? Number(controls.ripple.value) * 0.28 : Number(controls.ripple.value),
      palette: palettes[controls.colorMode.value] || palettes.ink,
      maxDrops: window.innerWidth < 700 ? 18 : 34,
      maxSplash: window.innerWidth < 700 ? 90 : 180,
      reduced,
    };
  }

  function phraseCharacters() {
    const clean = Array.from(controls.phrase.value)
      .filter((char) => /[\u3400-\u9fff]/u.test(char))
      .slice(0, 24);
    return clean.length ? clean : defaultCharacters;
  }

  class LiquidSurface {
    constructor(p) {
      this.p = p;
      this.points = [];
      this.resize();
    }

    resize() {
      const count = Math.max(34, Math.floor(this.p.width / 28));
      this.y = this.p.height * 0.64;
      this.points = Array.from({ length: count }, (_, index) => ({
        x: (index / (count - 1)) * this.p.width,
        y: 0,
        velocity: 0,
      }));
    }

    disturb(x, force) {
      this.points.forEach((point) => {
        const distance = Math.abs(point.x - x);
        const falloff = Math.max(0, 1 - distance / 180);
        point.velocity += force * falloff;
      });
    }

    update(dt) {
      const tension = 36;
      const damping = 0.82;
      this.points.forEach((point) => {
        point.velocity += -point.y * tension * dt;
        point.velocity *= Math.pow(damping, dt * 60);
        point.y += point.velocity * dt;
      });
    }

    displacementAt(x) {
      if (!this.points.length) return 0;
      const step = this.p.width / (this.points.length - 1);
      const raw = clamp(x / step, 0, this.points.length - 1);
      const left = Math.floor(raw);
      const right = Math.min(this.points.length - 1, left + 1);
      const t = raw - left;
      return this.p.lerp(this.points[left].y, this.points[right].y, t);
    }

    draw(palette) {
      const p = this.p;
      p.noFill();
      p.strokeWeight(1.2);
      p.stroke(p.color(palette.accent + "99"));
      p.beginShape();
      this.points.forEach((point) => p.curveVertex(point.x, this.y + point.y));
      p.endShape();
      p.stroke(p.color(palette.accent + "22"));
      p.line(0, this.y + 8, p.width, this.y + 8);
    }
  }

  class SplashParticle {
    constructor() {
      this.dead = true;
    }

    reset(p, x, y, palette, force = 1) {
      const angle = p.random(-Math.PI * 0.92, -Math.PI * 0.08);
      const speed = p.random(70, 320) * force;
      this.x = x;
      this.y = y;
      this.vx = Math.cos(angle) * speed + p.random(-60, 60);
      this.vy = Math.sin(angle) * speed;
      this.size = p.random(2, 9) * force;
      this.life = p.random(0.55, 1.25);
      this.age = 0;
      this.color = palette.splash;
      this.dead = false;
    }

    update(dt, gravity) {
      if (this.dead) return;
      this.age += dt;
      this.vy += gravity * 0.55 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.age > this.life) this.dead = true;
    }

    draw(p) {
      if (this.dead) return;
      const fade = 1 - this.age / this.life;
      const c = p.color(this.color);
      c.setAlpha(190 * fade);
      p.noStroke();
      p.fill(c);
      p.circle(this.x, this.y, this.size * (0.65 + fade));
    }
  }

  class CharacterDrop {
    constructor(p, surface, getCharacters) {
      this.p = p;
      this.surface = surface;
      this.getCharacters = getCharacters;
      this.dead = true;
    }

    reset(x, y, options = {}) {
      const p = this.p;
      const config = settings();
      const chars = this.getCharacters();
      this.char = chars[Math.floor(p.random(chars.length))];
      this.x = x ?? p.random(p.width * 0.18, p.width * 0.88);
      this.y = y ?? p.random(-p.height * 0.38, -40);
      this.vx = p.random(-18, 18);
      this.vy = options.fast ? p.random(80, 190) : p.random(20, 90);
      this.ax = 0;
      this.rotation = p.random(-0.12, 0.12);
      this.angularVelocity = p.random(-0.42, 0.42);
      this.baseSize = options.size ?? p.random(config.size * 0.78, config.size * 1.22);
      this.scaleX = 1;
      this.scaleY = 1;
      this.opacity = 255;
      this.state = "SPAWNING";
      this.age = 0;
      this.impactAge = 0;
      this.noiseSeed = p.random(1000);
      this.smear = p.random(26, 82);
      this.dead = false;
      this.splashMade = false;
      this.color = options.color || config.palette.text;
    }

    update(dt, config, onImpact) {
      if (this.dead) return;
      const p = this.p;
      this.age += dt;
      const surfaceY = this.surface.y + this.surface.displacementAt(this.x);
      const distance = surfaceY - this.y;

      if (this.state === "SPAWNING" && this.age > 0.08) this.state = "FALLING";
      if (this.state === "FALLING" && distance < this.baseSize * 1.1) this.state = "APPROACHING";

      if (["SPAWNING", "FALLING", "APPROACHING"].includes(this.state)) {
        const drift = (p.noise(this.noiseSeed, this.age * 0.42) - 0.5) * config.drift;
        this.ax = drift;
        this.vx += this.ax * dt;
        this.vy += config.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.angularVelocity * dt;

        if (this.state === "APPROACHING") {
          const pull = 1 - clamp(distance / (this.baseSize * 1.1), 0, 1);
          this.scaleY = 1 + pull * 0.45 * config.deform;
          this.scaleX = 1 - pull * 0.16 * config.deform;
        }

        if (this.y + this.baseSize * 0.34 >= surfaceY) {
          this.state = "IMPACT";
          this.impactAge = 0;
          this.y = surfaceY - this.baseSize * 0.22;
          this.vy = -Math.abs(this.vy) * config.bounce;
          this.surface.disturb(this.x, Math.min(70, this.baseSize * 0.62) * config.ripple);
          onImpact(this);
        }
      } else {
        this.impactAge += dt;
        const t = this.impactAge;
        if (this.state === "IMPACT") {
          const squash = easeOutCubic(Math.min(1, t / 0.16));
          this.scaleX = 1 + 0.72 * squash * config.deform;
          this.scaleY = 1 - 0.46 * squash * config.deform;
          if (t > 0.16) this.state = "LIQUID";
        } else if (this.state === "LIQUID") {
          const recoil = easeInOutSine(Math.min(1, t / 0.48));
          this.x += this.vx * 0.22 * dt;
          this.y += this.vy * dt + 32 * dt;
          this.vy += config.gravity * 0.58 * dt;
          this.scaleX = 1.72 - recoil * 0.42;
          this.scaleY = 0.54 + recoil * 0.38;
          this.opacity = 255 * (1 - clamp((t - 0.18) / 0.82, 0, 1));
          if (t > 0.58) this.state = "DISSOLVING";
        } else if (this.state === "DISSOLVING") {
          this.y += (70 + Math.abs(this.vy) * 0.3) * dt;
          this.x += Math.sin(this.age * 4) * 12 * dt;
          this.scaleX += 0.55 * dt;
          this.scaleY = Math.max(0.08, this.scaleY - 0.5 * dt);
          this.opacity -= 210 * dt;
          if (this.opacity <= 0 || this.y > p.height + this.baseSize) this.dead = true;
        }
      }

      if (this.x < -this.baseSize || this.x > p.width + this.baseSize || this.y > p.height + this.baseSize * 2) {
        this.dead = true;
      }
    }

    draw(p, palette) {
      if (this.dead) return;
      p.push();
      p.translate(this.x, this.y);
      p.rotate(this.rotation);
      p.scale(this.scaleX, this.scaleY);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(this.baseSize);
      p.textFont("Noto Serif SC, Source Han Serif SC, Songti SC, SimSun, serif");

      if (this.state === "LIQUID" || this.state === "DISSOLVING") {
        const smearAlpha = clamp(this.opacity * 0.32, 0, 80);
        const smear = p.color(palette.accent);
        smear.setAlpha(smearAlpha);
        p.noStroke();
        p.fill(smear);
        p.ellipse(0, this.baseSize * 0.2, this.smear * this.scaleX, this.baseSize * 0.18);
      }

      const ink = p.color(this.color);
      ink.setAlpha(clamp(this.opacity, 0, 255));
      p.fill(ink);
      p.noStroke();
      p.text(this.char, 0, 0);
      p.pop();
    }
  }

  new p5((p) => {
    let surface;
    let drops = [];
    let splashes = [];
    let lastTime = 0;
    let spawnClock = 0;
    let running = true;
    let hiddenPause = false;
    let startTime = 0;
    let lastState = "FALLING";

    function createDrop(x, y, options) {
      const config = settings();
      let drop = drops.find((candidate) => candidate.dead);
      if (!drop && drops.length < config.maxDrops) {
        drop = new CharacterDrop(p, surface, phraseCharacters);
        drops.push(drop);
      }
      if (drop) drop.reset(x, y, options);
    }

    function createSplash(x, y, force = 1) {
      const config = settings();
      surface.disturb(x, -44 * config.ripple * force);
      const count = config.reduced ? 3 : Math.floor(p.random(7, 15) * force);
      for (let i = 0; i < count; i += 1) {
        let particle = splashes.find((candidate) => candidate.dead);
        if (!particle && splashes.length < config.maxSplash) {
          particle = new SplashParticle();
          splashes.push(particle);
        }
        if (particle) particle.reset(p, x + p.random(-12, 12), y + p.random(-4, 4), config.palette, force);
      }
    }

    function rain(count = 12) {
      const config = settings();
      const total = config.reduced ? Math.min(4, count) : count;
      for (let i = 0; i < total; i += 1) {
        createDrop(p.random(p.width * 0.12, p.width * 0.9), p.random(-p.height * 0.55, -24), { fast: true });
      }
    }

    function resetComposition() {
      drops.forEach((drop) => { drop.dead = true; });
      splashes.forEach((particle) => { particle.dead = true; });
      surface.resize();
      createDrop(p.width * 0.36, -90, { fast: true, size: settings().size * 1.08 });
      createDrop(p.width * 0.55, -220, { fast: true });
      createDrop(p.width * 0.72, -340, { fast: true, size: settings().size * 0.92 });
      createDrop(p.width * 0.48, p.height * 0.2, { fast: true });
      startTime = p.millis();
    }

    function setRunning(next) {
      running = next;
      controls.pause.textContent = running ? "Pause" : "Play";
      if (running) p.loop();
      else p.noLoop();
    }

    function pointerAction(x, y) {
      if (y < surface.y - 18) createDrop(x, y - 20, { fast: true });
      else createSplash(x, surface.y + surface.displacementAt(x), 1.2);
    }

    p.setup = () => {
      const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent(host);
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      p.frameRate(60);
      p.textFont("Noto Serif SC, Source Han Serif SC, Songti SC, SimSun, serif");
      surface = new LiquidSurface(p);
      lastTime = p.millis();
      resetComposition();
      sketchApi = { rain, resetComposition, setRunning };
    };

    p.draw = () => {
      const config = settings();
      const now = p.millis();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const active = drops.filter((drop) => !drop.dead).length;

      p.background(config.palette.text === "#151412" ? "#f3eee2" : "#efe8da");
      p.noStroke();
      p.fill(255, 255, 255, 18);
      p.rect(0, 0, p.width, p.height);

      spawnClock += dt * config.frequency;
      if (spawnClock > 1 && active < config.maxDrops) {
        spawnClock = 0;
        createDrop();
      }

      surface.update(dt);
      drops.forEach((drop) => {
        drop.update(dt, config, (impactDrop) => {
          lastState = "LIQUID";
          createSplash(impactDrop.x, surface.y + surface.displacementAt(impactDrop.x), 1);
        });
      });
      splashes.forEach((particle) => particle.update(dt, config.gravity));

      drawAnnotations(config);
      surface.draw(config.palette);
      splashes.forEach((particle) => particle.draw(p));
      drops.forEach((drop) => drop.draw(p, config.palette));

      if (now % 220 < 18) {
        status.count.textContent = String(active);
        status.state.textContent = active ? lastState : "REST";
        const elapsed = Math.floor((now - startTime) / 1000);
        status.time.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
      }
      if (lastState === "LIQUID" && p.frameCount % 90 === 0) lastState = "FALLING";
    };

    function drawAnnotations(config) {
      p.push();
      p.textFont("Noto Serif SC, Source Han Serif SC, SimSun, serif");
      p.textSize(11);
      p.fill(config.palette.accent + "66");
      p.noStroke();
      p.textAlign(p.RIGHT, p.CENTER);
      p.text("y = " + Math.round(surface.y), p.width - 24, surface.y - 18);
      p.stroke(config.palette.accent + "24");
      p.strokeWeight(1);
      p.line(p.width - 110, surface.y - 14, p.width - 28, surface.y - 14);
      p.pop();
    }

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      surface.resize();
    };

    p.mouseMoved = () => {
      if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
        const config = settings();
        surface.disturb(p.mouseX, (p.mouseY - surface.y) * 0.018 * config.ripple);
      }
    };

    p.mousePressed = (event) => {
      if (event.target.closest(".control-shell")) return;
      pointerAction(p.mouseX, p.mouseY);
      return false;
    };

    p.touchStarted = (event) => {
      if (event.target.closest(".control-shell")) return true;
      const touch = p.touches[0];
      if (touch) pointerAction(touch.x, touch.y);
      return false;
    };

    p.keyPressed = () => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (p.key === " ") {
        rain(14);
        return false;
      }
      if (p.key === "r" || p.key === "R") resetComposition();
      if (p.key === "p" || p.key === "P") setRunning(!running);
      if (p.key === "s" || p.key === "S") p.saveCanvas("zi-luo-cheng-di", "png");
    };

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running) {
        hiddenPause = true;
        p.noLoop();
      } else if (!document.hidden && hiddenPause) {
        hiddenPause = false;
        lastTime = p.millis();
        p.loop();
      }
    });
  });

  controls.pause.addEventListener("click", () => sketchApi?.setRunning(controls.pause.textContent !== "Pause"));
  controls.reset.addEventListener("click", () => sketchApi?.resetComposition());
  controls.rain.addEventListener("click", () => sketchApi?.rain(12));
  controls.save.addEventListener("click", () => {
    const canvas = host.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "zi-luo-cheng-di.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
  controls.panelToggle.addEventListener("click", () => {
    const collapsed = controls.panel.classList.toggle("is-collapsed");
    controls.panelToggle.setAttribute("aria-expanded", String(!collapsed));
  });
  controls.phrase.addEventListener("input", () => {
    const clean = Array.from(controls.phrase.value)
      .filter((char) => /[\u3400-\u9fff]/u.test(char))
      .slice(0, 24)
      .join("");
    if (controls.phrase.value !== clean) controls.phrase.value = clean;
  });
})();
