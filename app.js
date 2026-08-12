const scenes = [
  {
    count: "01 / 06",
    title: "Postie",
    subtitle: "Record a feeling like a tiny parcel.",
    body: "Hold to record, add a label, and send it through a soft little postal route.",
    screen: "Listening",
  },
  {
    count: "02 / 06",
    title: "Wrap",
    subtitle: "The voice note becomes something you can hold.",
    body: "Gingham paper, a fine red label, and one small instruction for when to open it.",
    screen: "Wrapped",
  },
  {
    count: "03 / 06",
    title: "Send",
    subtitle: "Pop it in the post and let the route carry it.",
    body: "No feeds, no metrics, no performance. Just one warm thing traveling to one person.",
    screen: "Sent",
  },
  {
    count: "04 / 06",
    title: "Arrive",
    subtitle: "The mailbox flag lifts when something is waiting.",
    body: "June finds a parcel from Sam, tucked into the little glass mailbox.",
    screen: "New parcel",
  },
  {
    count: "05 / 06",
    title: "Open",
    subtitle: "Paper folds back into a private little world.",
    body: "The parcel opens with a tactile animation, then the message waits to be heard.",
    screen: "Open me",
  },
  {
    count: "06 / 06",
    title: "Reply",
    subtitle: "Send a little reaction parcel back.",
    body: "A paper heart, flower, gold star, or tiny stamp can travel the other way.",
    screen: "Reply",
  },
];

const sceneCount = document.querySelector("#scene-count");
const sceneTitle = document.querySelector("#scene-title");
const sceneSubtitle = document.querySelector("#scene-subtitle");
const sceneBody = document.querySelector("#scene-body");
const mailboxScreen = document.querySelector("#mailbox-screen");
const mailCamera = document.querySelector("#mail-camera");
const miniParcel = document.querySelector("#mini-parcel");
const mailboxFlag = document.querySelector(".mailbox-flag");
const paperHeart = document.querySelector(".paper-heart");
const scrollHint = document.querySelector("#scroll-hint");
const navButtons = document.querySelectorAll("[data-jump]");
const sceneCards = document.querySelectorAll(".scene-card");
const scrollTrack = document.querySelector(".scroll-track");

const parcelButton = document.querySelector("#parcel-button");
const foldButton = document.querySelector("#fold-button");
const reactionButton = document.querySelector("#reaction-button");
const parcelReveal = document.querySelector("#parcel-reveal");
const voiceNote = document.querySelector("#voice-note");
const playButton = document.querySelector("#play-button");
const voiceTime = document.querySelector("#voice-time");
const waveProgress = document.querySelector("#wave-progress");
const flowTitle = document.querySelector("#flow-title");
const flowCopy = document.querySelector("#flow-copy");
const flowStatus = document.querySelector("#flow-status");
const parcelScene = document.querySelector("#parcel-scene");
const flaps = {
  top: document.querySelector(".paper-flap-top"),
  right: document.querySelector(".paper-flap-right"),
  bottom: document.querySelector(".paper-flap-bottom"),
  left: document.querySelector(".paper-flap-left"),
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const threeMount = document.querySelector("#three-world");
const gsap = window.gsap;
const hasGsap = Boolean(gsap);
let activeScene = -1;
let parcelOpen = false;
let playing = false;
let playbackTimeline;
let parcelFloatTween;
let threeWorld;
let THREE;

if (hasGsap) {
  gsap.set([parcelReveal, voiceNote], { autoAlpha: 0 });
  gsap.set(Object.values(flaps), { autoAlpha: 0, scale: 0.82 });
  gsap.set(waveProgress, { scaleX: 0 });
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smooth(value) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

function makeMat(color, roughness = 0.82, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function roundedBox(width, height, depth, radius, smoothness) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: radius * 0.35,
    bevelThickness: radius * 0.35,
    bevelSegments: smoothness,
  }).center();
}

function makeMailbox(materials) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedBox(1.5, 2.6, 0.95, 0.08, 4), materials.glass);
  const roof = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 12, 0, Math.PI), materials.glass);
  roof.scale.set(1, 0.52, 0.6);
  roof.rotation.z = Math.PI;
  roof.position.y = 1.3;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 1.02), materials.ink);
  slot.position.y = -0.7;
  const flagPole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), materials.cherry);
  flagPole.position.set(0.92, 0.4, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.08), materials.strawberry);
  flag.position.set(1.17, 0.9, 0);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.04), materials.violet);
  screen.position.set(0, 0.28, 0.53);
  group.add(body, roof, slot, flagPole, flag, screen);
  group.userData.flag = flag;
  return group;
}

function makeParcel(materials) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(roundedBox(1.15, 0.72, 0.82, 0.06, 3), materials.paper);
  const tapeY = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.76, 0.86), materials.tape);
  const tapeX = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.86), materials.tape);
  const label = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.035), materials.cream);
  label.position.set(-0.15, 0.05, 0.44);
  group.add(box, tapeY, tapeX, label);
  return group;
}

function makeHeart(materials) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.2);
  shape.bezierCurveTo(0, 0.48, -0.46, 0.48, -0.46, 0.18);
  shape.bezierCurveTo(-0.46, -0.14, 0, -0.32, 0, -0.58);
  shape.bezierCurveTo(0, -0.32, 0.46, -0.14, 0.46, 0.18);
  shape.bezierCurveTo(0.46, 0.48, 0, 0.48, 0, 0.2);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }), materials.strawberry);
  mesh.rotation.x = -0.25;
  return mesh;
}

async function initThreeWorld() {
  if (!threeMount) return null;
  try {
    THREE = await import("three");
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(threeMount.clientWidth, threeMount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeMount.appendChild(renderer.domElement);
    document.body.classList.add("has-webgl");

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xfff8e8, 8, 26);

    const camera = new THREE.PerspectiveCamera(42, threeMount.clientWidth / threeMount.clientHeight, 0.1, 60);
    camera.position.set(0, 2.2, 8);

    const materials = {
      cream: makeMat(0xfff8e8),
      paper: makeMat(0xd8b47c),
      tape: makeMat(0xeccf96),
      cherry: makeMat(0x762e35),
      strawberry: makeMat(0xc94a4a),
      green: makeMat(0x71866a),
      ink: makeMat(0x472f2b),
      violet: makeMat(0x8177dd),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xa9ddff,
        roughness: 0.2,
        metalness: 0,
        transmission: 0.45,
        transparent: true,
        opacity: 0.55,
      }),
    };

    const ambient = new THREE.HemisphereLight(0xffffff, 0xd8b47c, 2.1);
    const key = new THREE.DirectionalLight(0xfff8e8, 3.2);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    scene.add(ambient, key);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), materials.cream);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.28;
    ground.receiveShadow = true;
    scene.add(ground);

    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6, -1.12, 2.2),
      new THREE.Vector3(-3, -1.05, -0.7),
      new THREE.Vector3(0, -1.0, -2.3),
      new THREE.Vector3(3.2, -1.05, -0.5),
      new THREE.Vector3(6, -1.12, 2.2),
    ]);
    const routeTube = new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.025, 8, false), materials.cherry);
    routeTube.position.y = 0.03;
    scene.add(routeTube);

    const mailbox = makeMailbox(materials);
    mailbox.position.set(4.8, 0.15, 1.25);
    mailbox.rotation.y = -0.55;
    scene.add(mailbox);

    const parcel = makeParcel(materials);
    parcel.position.set(-5.6, 0.1, 1.6);
    parcel.castShadow = true;
    scene.add(parcel);

    const hearts = Array.from({ length: 7 }, (_, index) => {
      const heart = makeHeart(materials);
      heart.scale.setScalar(0.18 + index * 0.018);
      heart.position.set(-4.2 + index * 1.35, 0.3 + (index % 3) * 0.25, -1.2 + Math.sin(index) * 0.9);
      heart.rotation.z = index * 0.35;
      scene.add(heart);
      return heart;
    });

    Array.from({ length: 18 }, (_, index) => {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), materials.strawberry);
      berry.position.set(-7 + index * 0.82, -1.1, -3.2 + Math.sin(index * 1.7) * 0.55);
      scene.add(berry);
    });

    const target = new THREE.Vector3();
    const clock = new THREE.Clock();
    const update = (progress) => {
      const point = path.getPoint(clamp(progress));
      const look = path.getPoint(clamp(progress + 0.08));
      const arc = Math.sin(progress * Math.PI);
      parcel.position.copy(point);
      parcel.position.y += 0.92 + arc * 0.8;
      parcel.rotation.set(progress * Math.PI * 1.2, progress * Math.PI * 3.5, progress * Math.PI * 0.8);
      mailbox.userData.flag.rotation.z = -smooth(clamp((progress - 0.54) / 0.25)) * 1.2;
      camera.position.set(point.x * 0.45, 2.4 + arc * 1.2, 7 - progress * 5.4);
      target.set(look.x, 0.2, look.z);
      camera.lookAt(target);
    };
    const render = () => {
      const elapsed = clock.getElapsedTime();
      hearts.forEach((heart, index) => {
        heart.position.y += Math.sin(elapsed * 1.2 + index) * 0.0009;
        heart.rotation.y = elapsed * 0.28 + index * 0.18;
      });
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    const resize = () => {
      const width = threeMount.clientWidth;
      const height = threeMount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", resize);
    update(0);
    render();
    return { update, resize };
  } catch (error) {
    threeMount.hidden = true;
    return null;
  }
}

function setScene(index) {
  if (index === activeScene) return;
  activeScene = index;
  const scene = scenes[index];
  sceneCount.textContent = scene.count;
  sceneTitle.textContent = scene.title;
  sceneSubtitle.textContent = scene.subtitle;
  sceneBody.textContent = scene.body;
  mailboxScreen.textContent = scene.screen;
  navButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("is-active", buttonIndex === index);
  });
  sceneCards.forEach((card, cardIndex) => {
    card.classList.toggle("is-active", cardIndex === index % sceneCards.length);
  });
}

function readScroll() {
  const maxScroll = scrollTrack.offsetHeight - window.innerHeight;
  const progress = clamp(window.scrollY / Math.max(1, maxScroll));
  const scaled = progress * (scenes.length - 1);
  const index = clamp(Math.round(scaled), 0, scenes.length - 1);
  const arc = Math.sin(progress * Math.PI);
  const routeX = (progress - 0.5) * 52;
  const routeY = -18 * arc;
  const routeScale = 0.72 + arc * 0.46;
  const parcelSpin = progress * 720;

  setScene(index);
  threeWorld?.update(progress);

  if (!prefersReducedMotion) {
    mailCamera.style.transform = `translate(calc(-50% + ${routeX}vw), calc(-50% + ${routeY}vh)) scale(${routeScale}) rotate(${(progress - 0.5) * 7}deg)`;
    miniParcel.style.transform = `translateY(${-arc * 4}rem) rotate(${parcelSpin}deg)`;
    mailboxFlag.style.transform = `rotate(${-14 - smooth(clamp((progress - 0.48) / 0.22)) * 62}deg)`;
    paperHeart.style.opacity = smooth(clamp((progress - 0.82) / 0.15));
    paperHeart.style.transform = `rotate(45deg) translate(${smooth(clamp((progress - 0.82) / 0.15)) * -2}rem, ${smooth(clamp((progress - 0.82) / 0.15)) * -2}rem)`;
  }

  scrollHint.style.opacity = clamp(1 - progress * 5);
}

function startParcelFloat() {
  if (!hasGsap || prefersReducedMotion || parcelOpen) return;
  parcelFloatTween = gsap.to(parcelButton, {
    y: -11,
    rotate: 0.35,
    duration: 1.9,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });
}

function stopParcelFloat() {
  parcelFloatTween?.kill();
  parcelFloatTween = null;
  if (hasGsap) gsap.set(parcelButton, { y: 0, rotate: 0 });
}

function startAmbientMotion() {
  if (!hasGsap || prefersReducedMotion) return;
  startParcelFloat();
  gsap.to(".cloud-one", { x: 24, duration: 6.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".cloud-two", { x: -20, duration: 7.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
}

function setOpenCopy() {
  flowTitle.textContent = "Sam sent you somewhere softer.";
  flowCopy.textContent = "A sunset train, a field of flowers, and twelve seconds meant only for you.";
  flowStatus.textContent = "The parcel is open. The little world is still warm.";
}

function setClosedCopy() {
  flowTitle.textContent = "A little world, folded just for you.";
  flowCopy.textContent = "Tap the parcel to see what Sam tucked inside.";
  flowStatus.textContent = "Paper parcel. Packed 12 minutes ago.";
}

function openParcel() {
  if (parcelOpen) return;
  stopParcelFloat();
  const lidLift = parcelScene.clientHeight * 0.67;
  const flapReachY = parcelScene.clientHeight * 0.46;
  const flapReachX = parcelScene.clientWidth * 0.33;
  parcelOpen = true;
  parcelButton.setAttribute("aria-expanded", "true");
  parcelReveal.setAttribute("aria-hidden", "false");
  foldButton.hidden = false;
  reactionButton.hidden = false;
  parcelScene.classList.add("is-open");
  setOpenCopy();

  if (!hasGsap) {
    playButton.focus();
    return;
  }

  gsap.timeline({ defaults: { ease: "power3.inOut" } })
    .to(parcelButton, { duration: 0.8, y: -lidLift, rotateX: -12, scale: 0.96, transformOrigin: "50% 100%" })
    .to(parcelReveal, { duration: 0.18, autoAlpha: 1 }, "-=0.38")
    .to(flaps.top, { duration: 0.64, autoAlpha: 1, y: -flapReachY, scale: 1, rotateX: -8 }, "-=0.26")
    .to(flaps.right, { duration: 0.58, autoAlpha: 1, x: flapReachX, scale: 1, rotateY: 8 }, "-=0.48")
    .to(flaps.bottom, { duration: 0.58, autoAlpha: 1, y: flapReachY, scale: 1, rotateX: 8 }, "-=0.48")
    .to(flaps.left, { duration: 0.58, autoAlpha: 1, x: -flapReachX, scale: 1, rotateY: -8 }, "-=0.48")
    .fromTo(".dream-landscape", { scale: 1.16 }, { duration: 1.2, scale: 1, transformOrigin: "50% 50%" }, "-=0.26")
    .to(voiceNote, { duration: 0.5, autoAlpha: 1, y: 0 }, "-=0.35")
    .fromTo(".waveform span", { scaleY: 0.25 }, { duration: 0.4, scaleY: 1, stagger: 0.035 }, "-=0.28")
    .call(() => playButton.focus());
}

function stopPlayback() {
  playbackTimeline?.kill();
  playing = false;
  playButton.classList.remove("is-playing");
  playButton.setAttribute("aria-label", "Play voice message");
  voiceTime.textContent = "0:00 / 0:12";
  if (hasGsap) {
    gsap.set(waveProgress, { scaleX: 0 });
  } else {
    waveProgress.style.transform = "scaleX(0)";
  }
}

function closeParcel() {
  if (!parcelOpen) return;
  stopPlayback();
  parcelOpen = false;
  parcelButton.setAttribute("aria-expanded", "false");
  foldButton.hidden = true;
  reactionButton.hidden = true;
  parcelScene.classList.remove("is-open");
  setClosedCopy();

  if (!hasGsap) {
    parcelReveal.setAttribute("aria-hidden", "true");
    parcelButton.focus();
    return;
  }

  gsap.timeline({ defaults: { ease: "power3.inOut" } })
    .to(voiceNote, { duration: 0.24, autoAlpha: 0 })
    .to(flaps.left, { duration: 0.46, x: 0, scale: 0.82, autoAlpha: 0 }, "-=0.18")
    .to(flaps.bottom, { duration: 0.46, y: 0, scale: 0.82, autoAlpha: 0 }, "-=0.38")
    .to(flaps.right, { duration: 0.46, x: 0, scale: 0.82, autoAlpha: 0 }, "-=0.38")
    .to(flaps.top, { duration: 0.46, y: 0, scale: 0.82, autoAlpha: 0 }, "-=0.38")
    .to(parcelReveal, { duration: 0.16, autoAlpha: 0 }, "-=0.2")
    .to(parcelButton, { duration: 0.7, y: 0, rotateX: 0, scale: 1 }, "-=0.12")
    .call(() => {
      parcelReveal.setAttribute("aria-hidden", "true");
      parcelButton.focus();
      startParcelFloat();
    });
}

function togglePlayback() {
  if (playing) {
    stopPlayback();
    return;
  }

  playing = true;
  playButton.classList.add("is-playing");
  playButton.setAttribute("aria-label", "Pause voice message");
  if (!hasGsap) {
    waveProgress.style.transition = "transform 12s linear";
    waveProgress.style.transform = "scaleX(1)";
    window.setTimeout(stopPlayback, 12000);
    return;
  }

  playbackTimeline = gsap.timeline({
    onUpdate() {
      const elapsed = Math.min(12, Math.floor(this.progress() * 12));
      voiceTime.textContent = `0:${String(elapsed).padStart(2, "0")} / 0:12`;
    },
    onComplete() {
      stopPlayback();
    },
  });
  playbackTimeline.fromTo(waveProgress, { scaleX: 0 }, { duration: 12, scaleX: 1, ease: "none" });
}

function sendReaction() {
  flowStatus.textContent = "A tiny reply parcel is on its way back to Sam.";
  if (hasGsap) {
    gsap.fromTo(reactionButton, { scale: 0.96 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });
  }
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.jump);
    const maxScroll = scrollTrack.offsetHeight - window.innerHeight;
    window.scrollTo({ top: (index / (scenes.length - 1)) * maxScroll, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
});

parcelButton.addEventListener("click", openParcel);
foldButton.addEventListener("click", closeParcel);
playButton.addEventListener("click", togglePlayback);
reactionButton.addEventListener("click", sendReaction);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && parcelOpen) closeParcel();
});
window.addEventListener("scroll", readScroll, { passive: true });
window.addEventListener("resize", readScroll);

readScroll();
initThreeWorld().then((world) => {
  threeWorld = world;
  readScroll();
});
startAmbientMotion();
