const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  pressure: document.getElementById('pressure'),
  chemical: document.getElementById('chemical'),
  casing: document.getElementById('casing'),
  rain: document.getElementById('rain'),
  riverDistance: document.getElementById('riverDistance'),
  soilType: document.getElementById('soilType'),

  pressureOut: document.getElementById('pressureOut'),
  chemicalOut: document.getElementById('chemicalOut'),
  casingOut: document.getElementById('casingOut'),
  rainOut: document.getElementById('rainOut'),
  riverOut: document.getElementById('riverOut'),

  timeMetric: document.getElementById('timeMetric'),
  soilMetric: document.getElementById('soilMetric'),
  aquiferMetric: document.getElementById('aquiferMetric'),
  riverMetric: document.getElementById('riverMetric'),
  riskScore: document.getElementById('riskScore'),
  riskLabel: document.getElementById('riskLabel'),
};

const soilProfiles = {
  clay: {
    name: 'Arcilloso',
    permeability: 0.35,
    color: '#8d6b4f',
  },
  loam: {
    name: 'Franco',
    permeability: 0.7,
    color: '#9a7347',
  },
  sand: {
    name: 'Arenoso',
    permeability: 1.15,
    color: '#c99b57',
  },
  fractured: {
    name: 'Roca fracturada',
    permeability: 1.45,
    color: '#77736d',
  },
};

let running = false;
let day = 0;
let particles = [];
let contamination = {
  soil: 0,
  aquifer: 0,
  river: 0,
};
let spillAmount = 0;
let last = performance.now();

function riverX() {
  return 760 + Number(ui.riverDistance.value) * 2.4;
}

function updateOutputs() {
  ui.pressureOut.textContent = `${ui.pressure.value}%`;
  ui.chemicalOut.textContent = `${ui.chemical.value}%`;
  ui.casingOut.textContent = `${ui.casing.value}%`;
  ui.rainOut.textContent = `${ui.rain.value}%`;

  const d = Number(ui.riverDistance.value);

  if (d < 33) {
    ui.riverOut.textContent = 'Corta';
  } else if (d < 66) {
    ui.riverOut.textContent = 'Media';
  } else {
    ui.riverOut.textContent = 'Larga';
  }
}

Object.values(ui).forEach((el) => {
  if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
    el.addEventListener('input', updateOutputs);
  }
});

document.getElementById('startBtn').onclick = () => {
  running = true;
};

document.getElementById('pauseBtn').onclick = () => {
  running = false;
};

document.getElementById('spillBtn').onclick = () => {
  spillAmount += 35;
  spawnSpill(45);
};

document.getElementById('resetBtn').onclick = reset;

function reset() {
  running = false;
  day = 0;
  particles = [];
  contamination = {
    soil: 0,
    aquifer: 0,
    river: 0,
  };
  spillAmount = 0;
  draw();
  updateMetrics();
}

function spawnInjectedFluid() {
  const pressure = Number(ui.pressure.value) / 100;
  const chemical = Number(ui.chemical.value) / 100;
  const count = Math.floor(2 + pressure * 7);

  for (let i = 0; i < count; i++) {
    particles.push({
      x: 510 + Math.random() * 130,
      y: 480 + Math.random() * 15,
      vx: (Math.random() - 0.3) * (0.5 + pressure * 2.6),
      vy: (Math.random() - 0.5) * 0.5,
      kind: Math.random() < chemical ? 'chemical' : 'water',
      source: 'fracture',
      age: 0,
    });
  }
}

function spawnWellLeak() {
  const casingFailure = 1 - Number(ui.casing.value) / 100;

  if (Math.random() < casingFailure * 0.25) {
    particles.push({
      x: 360 + (Math.random() - 0.5) * 20,
      y: 240 + Math.random() * 120,
      vx: (Math.random() - 0.5) * 1.3,
      vy: 0.7 + Math.random(),
      kind: 'chemical',
      source: 'well',
      age: 0,
    });
  }
}

function spawnSpill(n = 1) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x: 210 + Math.random() * 170,
      y: 118 + Math.random() * 8,
      vx: 0.25 + Math.random() * 1.8,
      vy: 0.25 + Math.random() * 0.8,
      kind: 'spill',
      source: 'surface',
      age: 0,
    });
  }
}

function step(dt) {
  const profile = soilProfiles[ui.soilType.value];
  const pressure = Number(ui.pressure.value) / 100;
  const rain = Number(ui.rain.value) / 100;

  day += dt * 2.8;

  if (Math.random() < 0.45 + pressure * 0.35) {
    spawnInjectedFluid();
  }

  spawnWellLeak();

  if (spillAmount > 0 && Math.random() < 0.35) {
    spawnSpill(2);
    spillAmount -= 0.6;
  }

  for (const p of particles) {
    p.age += dt;

    const inSoil = p.y > 135;
    const inAquifer = p.y > 282 && p.y < 350;
    const inRock = p.y > 380;

    if (p.source === 'surface') {
      p.vx += 0.012 + rain * 0.055;
      p.vy += (0.012 + profile.permeability * 0.018) * (1 - rain * 0.25);

      if (rain > 0.45 && p.y < 170) {
        p.vy -= rain * 0.015;
      }
    } else if (p.source === 'well') {
      p.vy += 0.012 * profile.permeability;
      p.vx += (Math.random() - 0.5) * 0.035;
    } else {
      p.vx += (pressure - 0.35) * 0.025;
      p.vy += (Math.random() - 0.48) * 0.04 + profile.permeability * 0.006;

      if (inRock && ui.soilType.value === 'fractured') {
        p.vy -= 0.015 + Math.random() * 0.02;
      }
    }

    if (inAquifer) {
      p.vx += 0.04;
    }

    if (inSoil) {
      p.vy *= 0.995;
    }

    p.x += p.vx * dt * 24;
    p.y += p.vy * dt * 24;

    if (p.x > riverX() - 20 && p.y > 130) {
      contamination.river += (p.kind === 'water' ? 0.004 : 0.018) * (1 + rain);
      p.dead = true;
    }

    if (p.y > 170 && p.y < 430 && p.kind !== 'water') {
      contamination.soil += 0.0035 * profile.permeability;
    }

    if (inAquifer && p.kind !== 'water') {
      contamination.aquifer += 0.009 * profile.permeability;
    }

    if (
      p.y < 100 ||
      p.y > canvas.height + 20 ||
      p.x < -30 ||
      p.x > canvas.width + 40 ||
      p.age > 35
    ) {
      p.dead = true;
    }
  }

  particles = particles.filter((p) => !p.dead).slice(-900);

  contamination.soil = Math.min(100, contamination.soil);
  contamination.aquifer = Math.min(100, contamination.aquifer);
  contamination.river = Math.min(100, contamination.river);

  updateMetrics();
}

function updateMetrics() {
  ui.timeMetric.textContent = `${Math.floor(day)} días`;
  ui.soilMetric.textContent = `${Math.round(contamination.soil)}%`;
  ui.aquiferMetric.textContent = `${Math.round(contamination.aquifer)}%`;
  ui.riverMetric.textContent = `${Math.round(contamination.river)}%`;

  const risk = Math.round(
    contamination.soil * 0.28 +
    contamination.aquifer * 0.42 +
    contamination.river * 0.30
  );

  ui.riskScore.textContent = risk;

  let label = 'Bajo';
  let color = '#4dd4ac';

  if (risk >= 65) {
    label = 'Alto';
    color = '#ff6678';
  } else if (risk >= 35) {
    label = 'Medio';
    color = '#ffb84d';
  }

  ui.riskLabel.textContent = label;
  ui.riskScore.style.color = color;
}

function draw() {
  const W = canvas.width;
  const H = canvas.height;
  const profile = soilProfiles[ui.soilType.value];

  ctx.clearRect(0, 0, W, H);

  const sky = ctx.createLinearGradient(0, 0, 0, 140);
  sky.addColorStop(0, '#8fd4ff');
  sky.addColorStop(1, '#c7ecff');

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 140);

  ctx.fillStyle = '#76b85b';
  ctx.fillRect(0, 115, W, 28);

  drawClouds();
  drawLayers(profile);
  drawRiver();
  drawMachinery();
  drawWell();
  drawFractures();
  drawContaminationPlumes();
  drawParticles();
  drawLabels();
}

function drawLayers(profile) {
  ctx.fillStyle = profile.color;
  ctx.fillRect(0, 143, canvas.width, 135);

  ctx.fillStyle = `rgba(106, 73, 44, ${0.35 + contamination.soil / 160})`;
  ctx.fillRect(0, 143, canvas.width, 135);

  ctx.fillStyle = `rgba(69, 183, 255, 0.55)`;
  ctx.fillRect(0, 278, canvas.width, 72);

  ctx.fillStyle = `rgba(160, 75, 190, ${contamination.aquifer / 130})`;
  ctx.fillRect(0, 278, canvas.width, 72);

  ctx.fillStyle = '#6c6861';
  ctx.fillRect(0, 350, canvas.width, 100);

  ctx.fillStyle = '#3d3834';
  ctx.fillRect(0, 450, canvas.width, 170);

  for (let x = 0; x < canvas.width; x += 42) {
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath();
    ctx.moveTo(x, 145);
    ctx.lineTo(x + 20, 278);
    ctx.stroke();
  }

  if (ui.soilType.value === 'fractured') {
    ctx.strokeStyle = 'rgba(10,10,10,.45)';
    ctx.lineWidth = 2;

    for (let x = 120; x < 900; x += 95) {
      ctx.beginPath();
      ctx.moveTo(x, 350);
      ctx.lineTo(x + 25, 405);
      ctx.lineTo(x - 5, 455);
      ctx.stroke();
    }

    ctx.lineWidth = 1;
  }
}

function drawRiver() {
  const x = riverX();

  ctx.fillStyle = '#2c9fe4';
  ctx.beginPath();
  ctx.moveTo(x, 105);
  ctx.bezierCurveTo(x - 35, 180, x + 35, 250, x - 10, 350);
  ctx.lineTo(canvas.width, 350);
  ctx.lineTo(canvas.width, 115);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(153, 75, 210, ${contamination.river / 100})`;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.45)';

  for (let y = 145; y < 330; y += 35) {
    ctx.beginPath();
    ctx.moveTo(x + 15, y);
    ctx.quadraticCurveTo(x + 70, y + 12, x + 135, y);
    ctx.stroke();
  }
}

function drawMachinery() {
  ctx.fillStyle = '#2b3440';
  ctx.fillRect(210, 70, 185, 45);

  ctx.fillStyle = '#151b22';
  ctx.fillRect(220, 50, 45, 20);
  ctx.fillRect(285, 48, 70, 22);

  ctx.fillStyle = '#e94f37';
  ctx.fillRect(395, 82, 18, 33);

  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(245, 118, 15, 0, Math.PI * 2);
  ctx.arc(350, 118, 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(350, 115);
  ctx.lineTo(390, 18);
  ctx.lineTo(430, 115);
  ctx.moveTo(365, 78);
  ctx.lineTo(415, 78);
  ctx.moveTo(377, 48);
  ctx.lineTo(403, 48);
  ctx.stroke();

  ctx.lineWidth = 1;

  ['#6ee7b7', '#c084fc', '#93c5fd'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(70 + i * 45, 82, 34, 34);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(70 + i * 45, 82, 34, 7);
  });

  ctx.strokeStyle = '#222';
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(172, 100);
  ctx.lineTo(210, 100);
  ctx.moveTo(395, 100);
  ctx.lineTo(360, 135);
  ctx.stroke();

  ctx.lineWidth = 1;
}

function drawWell() {
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 12;

  ctx.beginPath();
  ctx.moveTo(360, 105);
  ctx.lineTo(360, 485);
  ctx.quadraticCurveTo(360, 515, 390, 515);
  ctx.lineTo(650, 515);
  ctx.stroke();

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(360, 105);
  ctx.lineTo(360, 485);
  ctx.quadraticCurveTo(360, 515, 390, 515);
  ctx.lineTo(650, 515);
  ctx.stroke();

  ctx.lineWidth = 1;

  const failure = 1 - Number(ui.casing.value) / 100;

  if (failure > 0.15) {
    ctx.strokeStyle = `rgba(255, 102, 120, ${failure})`;
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(352, 240);
    ctx.lineTo(342, 265);
    ctx.moveTo(368, 315);
    ctx.lineTo(382, 340);
    ctx.stroke();

    ctx.lineWidth = 1;
  }
}

function drawFractures() {
  const pressure = Number(ui.pressure.value) / 100;

  ctx.strokeStyle = `rgba(255, 227, 110, ${0.35 + pressure * 0.55})`;
  ctx.lineWidth = 2;

  for (let i = 0; i < 9; i++) {
    const x = 470 + i * 24;

    ctx.beginPath();
    ctx.moveTo(x, 515);
    ctx.lineTo(x + (i % 2 ? 45 : -35) * pressure, 490 - Math.random() * 8);
    ctx.stroke();
  }

  ctx.lineWidth = 1;
}

function drawContaminationPlumes() {
  const soilAlpha = contamination.soil / 120;
  const aquiferAlpha = contamination.aquifer / 100;

  ctx.fillStyle = `rgba(128, 42, 151, ${soilAlpha})`;
  ctx.beginPath();
  ctx.ellipse(
    350,
    235,
    150 + contamination.soil,
    55,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = `rgba(128, 42, 151, ${aquiferAlpha})`;
  ctx.beginPath();
  ctx.ellipse(
    510,
    312,
    170 + contamination.aquifer * 1.5,
    28,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawParticles() {
  for (const p of particles) {
    if (p.kind === 'water') {
      ctx.fillStyle = '#7de3ff';
    }

    if (p.kind === 'chemical') {
      ctx.fillStyle = '#c56cff';
    }

    if (p.kind === 'spill') {
      ctx.fillStyle = '#221a13';
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.kind === 'spill' ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,227,110,.8)';

  const pressure = Number(ui.pressure.value) / 100;

  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(
      600 + Math.sin(day / 3 + i) * 25 + i * 8,
      492 - pressure * 25 - i * 2,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawClouds() {
  const rain = Number(ui.rain.value) / 100;

  ctx.fillStyle = 'rgba(255,255,255,.85)';

  for (const [x, y] of [
    [90, 45],
    [710, 35],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 25, y - 7, 28, 0, Math.PI * 2);
    ctx.arc(x + 55, y, 22, 0, Math.PI * 2);
    ctx.fill();

    if (rain > 0.05) {
      ctx.strokeStyle = `rgba(35,120,200,${rain})`;

      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 12, y + 30);
        ctx.lineTo(x + i * 12 - 4, y + 45 + rain * 18);
        ctx.stroke();
      }
    }
  }
}

function drawLabels() {
  const labels = [
    ['Maquinaria y tanques', 65, 70],
    ['Derrame superficial', 210, 145],
    ['Suelo', 20, 190],
    ['Acuífero', 20, 315],
    ['Roca impermeable', 20, 405],
    ['Roca con gas', 20, 535],
    ['Pozo vertical', 380, 250],
    ['Pozo horizontal y fracturas', 470, 548],
    ['Río', riverX() + 35, 130],
  ];

  ctx.font = '17px system-ui';
  ctx.textBaseline = 'middle';

  for (const [txt, x, y] of labels) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x - 6, y - 14, ctx.measureText(txt).width + 12, 28);

    ctx.fillStyle = '#fff';
    ctx.fillText(txt, x, y);
  }
}

function loop(now) {
  const dt = Math.min(0.06, (now - last) / 1000);
  last = now;

  if (running) {
    step(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

updateOutputs();
updateMetrics();
requestAnimationFrame(loop);
