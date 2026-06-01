/**
 * Canvas fireworks overlay (PSG celebration).
 */
(function () {
  'use strict';

  var canvas, ctx, particles, rafId, intervalId, running = false;
  var COLORS = ['#004170', '#d4a853', '#8ec5ff', '#E4007F', '#ffffff', '#1a5a8a'];

  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fireworks-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    particles = [];
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function burst(x, y) {
    var count = 36 + Math.floor(Math.random() * 24);
    var color = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      var speed = 2 + Math.random() * 5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        size: 2 + Math.random() * 2.5,
        color: color,
        gravity: 0.04 + Math.random() * 0.03,
      });
    }
  }

  function randomBurst() {
    var x = canvas.width * (0.15 + Math.random() * 0.7);
    var y = canvas.height * (0.1 + Math.random() * 0.45);
    burst(x, y);
    if (Math.random() > 0.5) {
      setTimeout(function () {
        burst(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 40);
      }, 180 + Math.random() * 220);
    }
  }

  function tick() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vx *= 0.98;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (running) rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    initCanvas();
    running = true;
    randomBurst();
    intervalId = setInterval(randomBurst, 900 + Math.random() * 600);
    tick();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (intervalId) clearInterval(intervalId);
    particles = [];
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  window.Fireworks = { start: start, stop: stop };
})();
