/* ===== Parámetros del robot (unidades SI) ===== */
const L1  = 0.36, L2  = 0.38;   // m
const lc1 = 0.19, lc2 = 0.20;   // m (centros de masa)
const m1  = 3.48, m2  = 7.5;    // kg
const I1  = 0.25, I2  = 0.69;   // kg·m^2
const g   = 9.8;                // m/s^2

/* ===== Estado de simulación ===== */
let q  = [Math.PI/2, 0];  // [q1,q2] (rad)
let dq = [0, 0];          // [q1dot,q2dot] (rad/s)
let dt = 0.01;            // paso de integración (s)
let simTime = 5;          // duración de simulación (s)

/* Trayectoria/series para gráficas */
let trajectory = {
  t:  [],
  x:  [],
  xd: [],
  e1: [],
  e2: []
};

/* ===== DOM y canvas principal ===== */
const canvas = document.getElementById('robotCanvas');
const ctx    = canvas.getContext('2d');

document.getElementById('btnSimulate').addEventListener('click', simulate);
document.getElementById('btnReset').addEventListener('click', resetScene);

let chartX, chartErrors;

function initCharts(){
  const baseFont   = 14;
  const tickFont   = 13;
  const titleFont  = 16;
  const legendFont = 13;

  // x(t): real vs deseado
  chartX = new Chart(document.getElementById('chartX'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'x real',
          data: [],
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0,240,255,.20)',
          borderWidth: 3,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: false,
          spanGaps: true
        },
        {
          label: 'x deseado',
          data: [],
          borderColor: '#ffb020',
          backgroundColor: 'rgba(255,176,32,.20)',
          borderWidth: 3,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: false,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // usa la altura del contenedor .plot
      animation: { duration: 500, easing: 'easeOutQuart' },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#e6f1ff', font: { size: legendFont, weight: '600' } }
        },
        title: {
          display: true,
          text: 'Posición x del TCP vs tiempo',
          color: '#cfeaff',
          font: { size: titleFont, weight: '700' },
          padding: { top: 8, bottom: 8 }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(10,15,22,.9)',
          titleColor: '#e6f1ff',
          bodyColor: '#cfeaff',
          borderColor: '#1a2a41',
          borderWidth: 1,
          padding: 10,
          titleFont: { size: baseFont, weight: '700' },
          bodyFont: { size: baseFont }
        }
      },
      layout: { padding: { left: 8, right: 8, top: 0, bottom: 0 } },
      scales: {
        x: {
          title: { display: true, text: 'Tiempo [s]', color: '#8ca3c7', font: { size: baseFont } },
          ticks: { color: '#8ca3c7', font: { size: tickFont } },
          grid: { color: '#1e293b' }
        },
        y: {
          title: { display: true, text: 'x [m]', color: '#8ca3c7', font: { size: baseFont } },
          ticks: { color: '#8ca3c7', font: { size: tickFont } },
          grid: { color: '#1e293b' },
          grace: '5%',
          suggestedMin: 0.0,
          suggestedMax: 0.5
        }
      }
    }
  });

  // Errores e1,e2
  chartErrors = new Chart(document.getElementById('chartErrors'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'e₁ (rad)',
          data: [],
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34,211,238,.20)',
          borderWidth: 3,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: false,
          spanGaps: true
        },
        {
          label: 'e₂ (rad)',
          data: [],
          borderColor: '#34d399',
          backgroundColor: 'rgba(52,211,153,.20)',
          borderWidth: 3,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: false,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#e6f1ff', font: { size: legendFont, weight: '600' } }
        },
        title: {
          display: true,
          text: 'Errores articulares e₁ y e₂',
          color: '#cfeaff',
          font: { size: titleFont, weight: '700' },
          padding: { top: 8, bottom: 8 }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(10,15,22,.9)',
          titleColor: '#e6f1ff',
          bodyColor: '#cfeaff',
          borderColor: '#1a2a41',
          borderWidth: 1,
          padding: 10,
          titleFont: { size: baseFont, weight: '700' },
          bodyFont: { size: baseFont }
        }
      },
      layout: { padding: { left: 8, right: 8, top: 0, bottom: 0 } },
      scales: {
        x: {
          title: { display: true, text: 'Tiempo [s]', color: '#8ca3c7', font: { size: baseFont } },
          ticks: { color: '#8ca3c7', font: { size: tickFont } },
          grid: { color: '#1e293b' }
        },
        y: {
          title: { display: true, text: 'Error [rad]', color: '#8ca3c7', font: { size: baseFont } },
          ticks: { color: '#8ca3c7', font: { size: tickFont } },
          grid: { color: '#1e293b' },
          grace: '10%'
        }
      }
    }
  });
}

/* Llamar una vez al cargar */
initCharts();

/* =========================================================
   Dinámica: H(q) q¨ + C(q,q˙) q˙ + g(q) = τ
   ========================================================= */
function H(q){
  const [q1,q2] = q;
  const h11 = m1*lc1**2 + m2*(L1**2 + lc2**2 + 2*L1*lc2*Math.cos(q2)) + I1 + I2;
  const h12 = m2*(lc2**2 + L1*lc2*Math.cos(q2)) + I2;
  const h21 = h12;
  const h22 = m2*lc2**2 + I2;
  return [[h11,h12],[h21,h22]];
}

function C(q,dq){
  const [ ,q2] = q;
  const [dq1,dq2] = dq;
  const c11 = -m2*L1*lc2*Math.sin(q2)*dq2;
  const c12 = -m2*L1*lc2*Math.sin(q2)*(dq1 + dq2);
  const c21 =  m2*L1*lc2*Math.sin(q2)*dq1;
  return [[c11,c12],[c21,0]];
}

function G(q){
  const [q1,q2] = q;
  const g1 = (m1*lc1 + m2*L1)*g*Math.cos(q1) + m2*lc2*g*Math.cos(q1+q2);
  const g2 = m2*lc2*g*Math.cos(q1+q2);
  return [g1,g2];
}

/* =========================================================
   Cinemática e IK (geométrica, rama “codo arriba” 
   ========================================================= */
function fk(q){
  const [q1,q2] = q;
  return {
    x: L1*Math.cos(q1) + L2*Math.cos(q1+q2),
    y: L1*Math.sin(q1) + L2*Math.sin(q1+q2)
  };
}

function ik(x,y){
  const r2 = x*x + y*y;
  const c2 = (r2 - L1*L1 - L2*L2)/(2*L1*L2);
  const c2cl = Math.min(1, Math.max(-1, c2));
  const s2  = Math.sqrt(Math.max(0, 1 - c2cl*c2cl)); 
  const q2  = Math.atan2(s2, c2cl);
  const q1  = Math.atan2(y, x) - Math.atan2(L2*s2, L1 + L2*c2cl);
  return [q1, q2];
}

/* =========================================================
   Control PD articular: τ = Kp (qd - q) + Kd (dqd - dq)
   ========================================================= */
function tauPD(q, dq, qd, dqd, Kp, Kd){
  return [
    Kp*(qd[0]-q[0]) + Kd*(dqd[0]-dq[0]),
    Kp*(qd[1]-q[1]) + Kd*(dqd[1]-dq[1])
  ];
}

/* =========================================================
   Simulación con integración 
   ========================================================= */
function simulate(){
  const xd = parseFloat(document.getElementById('xd').value);
  const yd = parseFloat(document.getElementById('yd').value);
  const Kp = parseFloat(document.getElementById('kp').value);
  const Kd = parseFloat(document.getElementById('kd').value);

  // Objetivo articular por IK desde posición cartesiana deseada
  const qd  = ik(xd, yd);
  const dqd = [0,0];

  // Limpiar series
  trajectory = { t:[], x:[], xd:[], e1:[], e2:[] };

  // Integración
  for(let t=0; t<=simTime+1e-9; t+=dt){
    // Control
    const tau = tauPD(q, dq, qd, dqd, Kp, Kd);

    // Dinámica: q¨ = H^{-1} [ τ - C(q,q˙) q˙ - G(q) ]
    const Hm = H(q);
    const Cm = C(q, dq);
    const Gv = G(q);

    const Cdq0 = Cm[0][0]*dq[0] + Cm[0][1]*dq[1];
    const Cdq1 = Cm[1][0]*dq[0] + Cm[1][1]*dq[1];

    const rhs  = [ tau[0] - Cdq0 - Gv[0],
                   tau[1] - Cdq1 - Gv[1] ];

    const qdd = solve2x2(Hm, rhs);

    // Euler explícito
    dq[0] += qdd[0]*dt;  dq[1] += qdd[1]*dt;
    q[0]  += dq[0]*dt;   q[1]  += dq[1]*dt;

    // Guardar muestras
    const pos = fk(q);
    trajectory.t.push(Number(t.toFixed(3)));
    trajectory.x.push(pos.x);
    trajectory.xd.push(xd);
    trajectory.e1.push(qd[0]-q[0]);
    trajectory.e2.push(qd[1]-q[1]);
  }

  // Dibujar y actualizar gráficas
  drawScene();
  plotSignals();
}

/* Resolver sistema 2x2: M x = b */
function solve2x2(M, b){
  const a = M[0][0], b1 = M[0][1];
  const c = M[1][0], d = M[1][1];
  const det = a*d - b1*c || 1e-9;
  return [
    ( b[0]*d - b[1]*b1)/det,
    ( a*b[1] - c*b[0])/det
  ];
}

/* =========================================================
   Dibujo del robot en canvas 
   ========================================================= */
function drawGrid(){
  ctx.save();
  ctx.fillStyle = '#0a0f16';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const scale = 200; 
  const dx = 0.1 * scale;

  ctx.lineWidth = 1;
  for(let x=canvas.width/2; x<canvas.width; x+=dx){
    ctx.strokeStyle = '#152233'; ctx.beginPath();
    ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for(let x=canvas.width/2; x>0; x-=dx){
    ctx.strokeStyle = '#152233'; ctx.beginPath();
    ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for(let y=canvas.height/2; y<canvas.height; y+=dx){
    ctx.strokeStyle = '#152233'; ctx.beginPath();
    ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }
  for(let y=canvas.height/2; y>0; y-=dx){
    ctx.strokeStyle = '#152233'; ctx.beginPath();
    ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }

  ctx.strokeStyle = '#1de5ff88'; ctx.lineWidth = 1.5;
  // eje X
  ctx.beginPath(); ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2); ctx.stroke();
  // eje Y
  ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke();

  ctx.restore();
}

function drawWorkspace(){
  const scale = 400; 
  const rmax = L1 + L2;
  const origin = { x: canvas.width/2, y: canvas.height/2 };

  ctx.save();
  ctx.strokeStyle = '#00f0ff66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, rmax*scale, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function drawScene(){
  drawGrid();
  drawWorkspace();

  const scale = 400; 
  const origin = { x: canvas.width/2, y: canvas.height/2 };
  const p0 = origin;
  const p1 = {
    x: p0.x + L1*Math.cos(q[0]) * scale,
    y: p0.y - L1*Math.sin(q[0]) * scale
  };
  const p2 = {
    x: p1.x + L2*Math.cos(q[0]+q[1]) * scale,
    y: p1.y - L2*Math.sin(q[0]+q[1]) * scale
  };

  // Glow suave
  ctx.save();
  ctx.shadowColor = 'rgba(0,240,255,.35)';
  ctx.shadowBlur  = 10;

  // Eslabones
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
  ctx.stroke();

  // Juntas
  ctx.fillStyle = '#e5e7eb';
  [p0,p1].forEach(P=>{
    ctx.beginPath(); ctx.arc(P.x,P.y,5,0,Math.PI*2); ctx.fill();
  });

  // TCP
  ctx.fillStyle = '#ffb020';
  ctx.beginPath(); ctx.arc(p2.x,p2.y,8,0,Math.PI*2); ctx.fill();

  ctx.restore();

  // Texto info
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui';
  const pos = fk(q);
  ctx.fillText(`q1=${(q[0]).toFixed(3)} rad (${(q[0]*180/Math.PI).toFixed(1)}°)`, 10, 18);
  ctx.fillText(`q2=${(q[1]).toFixed(3)} rad (${(q[1]*180/Math.PI).toFixed(1)}°)`, 10, 34);
  ctx.fillText(`TCP=(${pos.x.toFixed(3)} m, ${pos.y.toFixed(3)} m)`, 10, 50);
  ctx.restore();
}

/* =========================================================
   Actualización de gráficas 
   ========================================================= */
function plotSignals(){
  // Etiquetas = tiempo
  chartX.data.labels      = trajectory.t;
  chartErrors.data.labels = trajectory.t;

  // Series
  chartX.data.datasets[0].data = trajectory.x;   
  chartX.data.datasets[1].data = trajectory.xd;  
  chartErrors.data.datasets[0].data = trajectory.e1;
  chartErrors.data.datasets[1].data = trajectory.e2;

  // Auto-rangos cómodos
  if(trajectory.x.length){
    const xmin = Math.min(...trajectory.x, ...trajectory.xd);
    const xmax = Math.max(...trajectory.x, ...trajectory.xd);
    chartX.options.scales.y.suggestedMin = xmin - 0.02;
    chartX.options.scales.y.suggestedMax = xmax + 0.02;
  }
  if(trajectory.e1.length){
    const emin = Math.min(...trajectory.e1, ...trajectory.e2);
    const emax = Math.max(...trajectory.e1, ...trajectory.e2);
    chartErrors.options.scales.y.suggestedMin = emin - 0.02;
    chartErrors.options.scales.y.suggestedMax = emax + 0.02;
  }

  // Actualizar sin animación para respuesta rápida
  chartX.update('none');
  chartErrors.update('none');
}

/* =========================================================
   Reset e inicialización
   ========================================================= */
function resetScene(){
  q  = [Math.PI/2, 0];
  dq = [0, 0];
  drawScene();

  // Inicializa gráficos con series vacías
  trajectory = { t:[], x:[], xd:[], e1:[], e2:[] };
  plotSignals();
}

resetScene();
