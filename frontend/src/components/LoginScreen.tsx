import React, { useEffect, useRef, useState } from 'react';
import { BASE_URL } from '../services/api';
import '../assets/css/LoginScreen.css';

const PARTICLE_COUNT = 45;

class MagicalSparkle {
  x: number = 0;
  y: number = 0;
  size: number = 2;
  speedY: number = 0.3;
  speedX: number = 0;
  wobble: number = 0;
  wobbleSpeed: number = 0.01;
  baseAlpha: number = 0.4;
  pulse: number = 0;
  pulseSpeed: number = 0.02;
  depth: number = 0.5;
  isGlint: boolean = false;
  color: string = '134, 229, 156';

  constructor(canvasWidth: number, canvasHeight: number) {
    this.reset(canvasWidth, canvasHeight, true);
  }

  reset(canvasWidth: number, canvasHeight: number, initial = false) {
    this.x = Math.random() * canvasWidth;
    this.y = initial ? Math.random() * canvasHeight : canvasHeight + 15;
    this.size = Math.random() * 2.5 + 1.2;
    this.speedY = Math.random() * 0.45 + 0.18;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.02 + 0.01;
    this.baseAlpha = Math.random() * 0.55 + 0.3;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = Math.random() * 0.035 + 0.015;
    this.depth = Math.random() * 0.8 + 0.4;
    this.isGlint = Math.random() < 0.28;

    const tones = [
      '134, 229, 156', // Мятный изумруд
      '173, 196, 176', // Шалфейный
      '242, 247, 243', // Звёздный белый
      '150, 240, 215', // Эфирный циан
      '255, 235, 170'  // Тёплое золото
    ];
    this.color = tones[Math.floor(Math.random() * tones.length)];
  }

  update(canvasWidth: number, canvasHeight: number, shiftX: number, shiftY: number) {
    this.y -= this.speedY - shiftY * this.depth * 0.15;
    this.wobble += this.wobbleSpeed;
    this.pulse += this.pulseSpeed;
    this.x += this.speedX + Math.sin(this.wobble) * 0.35 + shiftX * this.depth * 0.25;

    if (this.y < -20 || this.x < -20 || this.x > canvasWidth + 20) {
      this.reset(canvasWidth, canvasHeight);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pulseFactor = 0.65 + 0.35 * Math.sin(this.pulse);
    const alpha = Math.max(0, Math.min(1, this.baseAlpha * pulseFactor));
    const currentSize = this.size * (0.85 + 0.15 * Math.sin(this.pulse));

    // Рассеянный ореол
    const glowRadius = currentSize * 3.4;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
    grad.addColorStop(0, `rgba(${this.color}, ${alpha * 0.95})`);
    grad.addColorStop(0.35, `rgba(${this.color}, ${alpha * 0.45})`);
    grad.addColorStop(1, `rgba(${this.color}, 0)`);

    ctx.beginPath();
    ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Яркое ядро
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.7, currentSize * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.3)})`;
    ctx.fill();

    // Лучистые мерцающие звёздочки
    if (this.isGlint && Math.sin(this.pulse) > 0.65) {
      const glintAlpha = ((Math.sin(this.pulse) - 0.65) / 0.35) * alpha;
      const glintLen = currentSize * 3.6;
      ctx.strokeStyle = `rgba(255, 255, 255, ${glintAlpha * 0.85})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(this.x - glintLen, this.y);
      ctx.lineTo(this.x + glintLen, this.y);
      ctx.moveTo(this.x, this.y - glintLen);
      ctx.lineTo(this.x, this.y + glintLen);
      ctx.stroke();
    }
  }
}

export const LoginScreen: React.FC = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const lBgRef = useRef<HTMLDivElement>(null);
  const lRocksRef = useRef<HTMLDivElement>(null);
  const lTreesRef = useRef<HTMLDivElement>(null);
  const lUiRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sparklesEnabled, setSparklesEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('login_sparkles_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [parallaxEnabled, setParallaxEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('login_parallax_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const sparklesRef = useRef(sparklesEnabled);
  const parallaxRef = useRef(parallaxEnabled);

  useEffect(() => {
    sparklesRef.current = sparklesEnabled;
    localStorage.setItem('login_sparkles_enabled', String(sparklesEnabled));
  }, [sparklesEnabled]);

  useEffect(() => {
    parallaxRef.current = parallaxEnabled;
    localStorage.setItem('login_parallax_enabled', String(parallaxEnabled));
  }, [parallaxEnabled]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: MagicalSparkle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new MagicalSparkle(canvas.width, canvas.height));
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!parallaxRef.current) return;
      const rect = stage.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
    };

    const onMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    stage.addEventListener('mousemove', onMouseMove);
    stage.addEventListener('mouseleave', onMouseLeave);

    const render = () => {
      if (!parallaxRef.current) {
        targetX = 0;
        targetY = 0;
      }
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      const f = 30;

      // 1. Плашка De-Bit (тянется к курсору с 3D-наклоном)
      if (lUiRef.current) {
        const cardShiftX = currentX * f * 0.42;
        const cardShiftY = currentY * f * 0.42;
        const tiltX = -currentY * 15;
        const tiltY = currentX * 15;
        lUiRef.current.style.transform = `translate3d(${cardShiftX}px, ${cardShiftY}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      }

      // 2. Окружение (деревья, скалы, долина)
      if (lTreesRef.current) {
        lTreesRef.current.style.transform = `translate3d(${-currentX * f * 1.3}px, ${-currentY * f * 1.3}px, 0)`;
      }
      if (lRocksRef.current) {
        lRocksRef.current.style.transform = `translate3d(${-currentX * f * 0.65}px, ${-currentY * f * 0.65}px, 0)`;
      }
      if (lBgRef.current) {
        lBgRef.current.style.transform = `translate3d(${currentX * f * 0.35}px, ${currentY * f * 0.35}px, 0)`;
      }

      // 3. Магические светяшки
      if (sparklesRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const particleShiftX = currentX * f;
        const particleShiftY = currentY * f;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles[i].update(canvas.width, canvas.height, particleShiftX, particleShiftY);
          particles[i].draw(ctx);
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      stage.removeEventListener('mousemove', onMouseMove);
      stage.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <div className="login-viewport" ref={stageRef}>
      <div className="login-layer login-layer-bg" ref={lBgRef} />
      <div className="login-layer login-layer-rocks" ref={lRocksRef} />
      <canvas
        className="login-layer-particles"
        ref={canvasRef}
        style={{ opacity: sparklesEnabled ? 1 : 0 }}
      />
      <div className="login-layer login-layer-trees" ref={lTreesRef} />

      {/* Верхние контролы управления эффектами */}
      <div className="login-top-controls">
        <button
          type="button"
          className={`login-icon-btn ${sparklesEnabled ? 'active' : 'disabled'}`}
          onClick={() => setSparklesEnabled(!sparklesEnabled)}
          title={`Магические светяшки: ${sparklesEnabled ? 'Вкл (нажмите, чтобы выключить)' : 'Выкл (нажмите, чтобы включить)'}`}
          aria-label="Светяшки"
        >
          <svg className="login-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            <path d="M5 3v4"/>
            <path d="M19 17v4"/>
            <path d="M3 5h4"/>
            <path d="M17 19h4"/>
            <line className="slash-line" x1="4" y1="20" x2="20" y2="4"/>
          </svg>
        </button>

        <button
          type="button"
          className={`login-icon-btn ${parallaxEnabled ? 'active' : 'disabled'}`}
          onClick={() => setParallaxEnabled(!parallaxEnabled)}
          title={`3D Параллакс: ${parallaxEnabled ? 'Вкл (нажмите, чтобы выключить)' : 'Выкл (нажмите, чтобы включить)'}`}
          aria-label="3D Параллакс"
        >
          <svg className="login-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z"/>
            <path d="M12 22V12"/>
            <path d="M20.5 7L12 12L3.5 7"/>
            <path d="M12 12L20.5 17"/>
            <path d="M12 12L3.5 17"/>
            <line className="slash-line" x1="4" y1="20" x2="20" y2="4"/>
          </svg>
        </button>
      </div>

      <div className="login-layer-ui" ref={lUiRef}>
        <div className="login-card">
          <div className="login-brand-header">
            <div className="login-brand-badge">D&amp;D AUDIO COMPANION</div>
            <h1 className="login-bot-title">De-Bit</h1>
            <div className="login-title-underline" />
          </div>

          <div className="login-avatar-wrapper">
            <div className="login-avatar-pulse-ring" />
            <img
              src="/debit_avatar_d20.svg"
              alt="De-Bit D20 Avatar"
              className="login-avatar-d20-image"
            />
          </div>

          <div className="login-bot-subtitle-group">
            <h2 className="login-bot-subtitle">Discord music bot</h2>
          </div>

          <p className="login-instruction">
            Please log in with Discord to access your library and files
          </p>

          <button
            className="login-discord-login-btn"
            type="button"
            onClick={() => {
              window.location.href = `${BASE_URL}/auth/login`;
            }}
          >
            <svg className="login-discord-icon" viewBox="0 0 127.14 96.36" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
            <span>Log in with Discord</span>
          </button>

          <div className="login-version-tag">v3.0.0</div>
        </div>
      </div>
    </div>
  );
};
