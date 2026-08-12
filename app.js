(() => {
  const container = document.querySelector("#container");
  if (!container || !window.p5) return;

  const PHRASES = ["水滴石穿", "雲雨成河", "潮生墨流", "霧散風過", "露凝空明", "雨落成波"];
  const CONFIG = {
    damping: 0.985,
    gravity: 0.34,
    iterations: 5,
    pullRadius: 92,
    clickRadius: 150,
  };

  class Point {
    constructor(x, y, char, pinned = false) {
      this.x = x;
      this.y = y;
      this.oldX = x;
      this.oldY = y;
      this.char = char;
      this.pinned = pinned;
      this.homeX = x;
      this.homeY = y;
      this.fx = 0;
      this.fy = 0;
    }

    addForce(x, y) {
      this.fx += x;
      this.fy += y;
    }

    update() {
      if (this.pinned) {
        this.fx = 0;
        this.fy = 0;
        return;
      }

      const vx = (this.x - this.oldX) * CONFIG.damping;
      const vy = (this.y - this.oldY) * CONFIG.damping;
      this.oldX = this.x;
      this.oldY = this.y;
      this.x += vx + this.fx;
      this.y += vy + this.fy + CONFIG.gravity;
      this.fx = 0;
      this.fy = 0;
    }
  }

  class Link {
    constructor(a, b, length, stiffness = 1) {
      this.a = a;
      this.b = b;
      this.length = length;
      this.stiffness = stiffness;
    }

    solve() {
      const dx = this.b.x - this.a.x;
      const dy = this.b.y - this.a.y;
      const distance = Math.hypot(dx, dy) || 1;
      const diff = (distance - this.length) / distance;
      const ox = dx * diff * 0.5 * this.stiffness;
      const oy = dy * diff * 0.5 * this.stiffness;
      if (!this.a.pinned) {
        this.a.x += ox;
        this.a.y += oy;
      }
      if (!this.b.pinned) {
        this.b.x -= ox;
        this.b.y -= oy;
      }
    }
  }

  new p5((p) => {
    let points = [];
    let links = [];
    let grabbed = null;
    let spacing = 0;
    let fontSize = 0;
    let surfaceY = 0;
    let droplet;
    let resetHitArea = { x: 14, y: 0, w: 52, h: 18 };

    function sizeCanvas() {
      return Math.max(300, Math.min(520, window.innerWidth - 42, window.innerHeight - 42));
    }

    function halfWidthAt(y) {
      const t = Math.max(0, Math.min(1, (y - droplet.top) / droplet.height));
      const taper = Math.pow(Math.sin(t * Math.PI), 0.52);
      const bulb = 0.26 + 1.55 * t - 0.72 * t * t;
      return droplet.maxHalf * taper * bulb;
    }

    function clampToDroplet(point) {
      const margin = fontSize * 0.55;
      point.y = Math.max(droplet.top + margin, Math.min(droplet.bottom - margin, point.y));
      const half = Math.max(2, halfWidthAt(point.y) - margin);
      point.x = Math.max(droplet.cx - half, Math.min(droplet.cx + half, point.x));
    }

    function buildMesh() {
      points = [];
      links = [];
      const width = p.width;
      const height = p.height;
      droplet = {
        cx: width / 2,
        top: height * 0.12,
        bottom: height * 0.86,
        height: height * 0.74,
        maxHalf: width * 0.34,
      };
      spacing = Math.max(22, Math.min(32, width / 16));
      fontSize = spacing * 0.78;
      surfaceY = height * 0.68;
      const text = PHRASES.join("");
      const rows = Math.floor((droplet.bottom - droplet.top - fontSize) / (spacing * 0.72));
      const rowPoints = [];

      for (let row = 0; row < rows; row += 1) {
        const y = droplet.top + fontSize * 0.62 + row * spacing * 0.72;
        const half = halfWidthAt(y) - fontSize * 0.62;
        const cols = Math.max(1, Math.floor((half * 2) / spacing) + 1);
        const usable = Math.max(0, (cols - 1) * spacing);
        const startX = droplet.cx - usable / 2;
        const rowList = [];
        for (let col = 0; col < cols; col += 1) {
          const wobble = row % 2 ? spacing * 0.22 : 0;
          let x = startX + col * spacing + wobble;
          const allowedHalf = halfWidthAt(y) - fontSize * 0.62;
          x = Math.max(droplet.cx - allowedHalf, Math.min(droplet.cx + allowedHalf, x));
          const index = (col + row * 3 + Math.floor(row / 2)) % text.length;
          const point = new Point(x, y, text[index], row === 0);
          rowList.push(point);
          points.push(point);
        }
        rowPoints.push(rowList);
      }

      rowPoints.forEach((rowList, row) => {
        rowList.forEach((current, col) => {
          if (col < rowList.length - 1) {
            links.push(new Link(current, rowList[col + 1], Math.abs(rowList[col + 1].x - current.x), 0.75));
          }
          const nextRow = rowPoints[row + 1];
          if (!nextRow) return;
          const nearest = [...nextRow].sort((a, b) => Math.abs(a.x - current.x) - Math.abs(b.x - current.x)).slice(0, 2);
          nearest.forEach((next) => links.push(new Link(current, next, Math.hypot(next.x - current.x, next.y - current.y), 0.72)));
        });
      });
    }

    function applyPointerForce(x, y, radius, strength) {
      points.forEach((point) => {
        const dx = point.x - x;
        const dy = point.y - y;
        const distance = Math.hypot(dx, dy);
        if (distance > radius || distance < 1) return;
        const power = (1 - distance / radius) * strength;
        point.addForce((dx / distance) * power, (dy / distance) * power);
      });
    }

    function nearestPoint(x, y) {
      let best = null;
      let bestDistance = 28;
      points.forEach((point) => {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < bestDistance) {
          best = point;
          bestDistance = distance;
        }
      });
      return best;
    }

    function drawSurface() {
      p.stroke("#2f8f9a");
      p.strokeWeight(1);
      p.line(0, surfaceY, p.width, surfaceY);
      p.stroke("#2f8f9a36");
      p.line(0, surfaceY + 7, p.width, surfaceY + 7);
    }

    function drawDropletGuide() {
      p.noFill();
      p.stroke("#2f8f9a24");
      p.strokeWeight(1);
      p.beginShape();
      for (let i = 0; i <= 72; i += 1) {
        const y = droplet.top + (i / 72) * droplet.height;
        p.vertex(droplet.cx - halfWidthAt(y), y);
      }
      for (let i = 72; i >= 0; i -= 1) {
        const y = droplet.top + (i / 72) * droplet.height;
        p.vertex(droplet.cx + halfWidthAt(y), y);
      }
      p.endShape(p.CLOSE);
    }

    function drawCharacters() {
      p.textFont('"Noto Serif SC", "Songti SC", "SimSun", serif');
      p.textAlign(p.CENTER, p.CENTER);
      p.noStroke();
      points.forEach((point) => {
        const below = Math.max(0, point.y - surfaceY);
        const melt = Math.min(1, below / 90);
        p.push();
        p.translate(point.x, point.y);
        p.rotate((point.x - point.oldX) * 0.035);
        p.scale(1 + melt * 0.75, 1 - melt * 0.45);
        p.fill(melt > 0 ? "#2f8f9a" : "#171614");
        p.textSize(fontSize * (1 - melt * 0.22));
        p.text(point.char, 0, 0);
        p.pop();

        if (melt > 0.05) {
          p.fill(47, 143, 154, 34 * melt);
          p.ellipse(point.x, surfaceY + below * 0.18, fontSize * (0.8 + melt), 4 + melt * 8);
        }
      });
    }

    p.setup = () => {
      const side = sizeCanvas();
      const canvas = p.createCanvas(side, side);
      canvas.parent(container);
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      buildMesh();
    };

    p.draw = () => {
      p.background("#f6f1e8");
      p.noStroke();
      p.fill(255, 255, 255, 22);
      p.rect(0, 0, p.width, p.height);

      if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
        applyPointerForce(p.mouseX, p.mouseY, CONFIG.pullRadius, p.mouseIsPressed ? 1.8 : 0.34);
      }

      points.forEach((point) => point.update());
      for (let i = 0; i < CONFIG.iterations; i += 1) links.forEach((link) => link.solve());
      points.forEach(clampToDroplet);

      drawDropletGuide();
      drawSurface();
      drawCharacters();

      p.fill("#6a655d");
      p.textSize(10);
      p.textAlign(p.LEFT, p.BOTTOM);
      resetHitArea = { x: 14, y: p.height - 28, w: 34, h: 18 };
      p.text("reset", resetHitArea.x, p.height - 14);
    };

    p.mousePressed = () => {
      if (
        p.mouseX >= resetHitArea.x &&
        p.mouseX <= resetHitArea.x + resetHitArea.w &&
        p.mouseY >= resetHitArea.y &&
        p.mouseY <= resetHitArea.y + resetHitArea.h
      ) {
        buildMesh();
        return false;
      }
      grabbed = nearestPoint(p.mouseX, p.mouseY);
      if (grabbed) {
        grabbed.pinned = true;
        grabbed.x = p.mouseX;
        grabbed.y = p.mouseY;
        grabbed.oldX = p.mouseX;
        grabbed.oldY = p.mouseY;
      } else {
        applyPointerForce(p.mouseX, p.mouseY, CONFIG.clickRadius, 6);
      }
      return false;
    };

    p.mouseDragged = () => {
      if (!grabbed) return false;
      grabbed.x = p.mouseX;
      grabbed.y = p.mouseY;
      grabbed.oldX = p.mouseX;
      grabbed.oldY = p.mouseY;
      return false;
    };

    p.mouseReleased = () => {
      if (grabbed) grabbed.pinned = grabbed.homeY === points[0].homeY;
      grabbed = null;
    };

    p.touchStarted = () => p.mousePressed();
    p.touchMoved = () => p.mouseDragged();
    p.touchEnded = () => p.mouseReleased();

    p.keyPressed = () => {
      if (p.key === "r" || p.key === "R") buildMesh();
      if (p.key === " ") applyPointerForce(p.width / 2, p.height / 2, p.width, 4.5);
    };

    p.windowResized = () => {
      const side = sizeCanvas();
      p.resizeCanvas(side, side);
      buildMesh();
    };
  });
})();
