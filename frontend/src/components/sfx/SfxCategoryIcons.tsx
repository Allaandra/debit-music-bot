import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Swords,
  Sparkles,
  Globe,
  Shield,
  Wand2,
  Trees,
  Dices,
  Skull,
  Ghost,
  Beer,
  Bell,
  Flame,
  Zap,
  Target,
  Bomb,
  Compass,
  Footprints
} from 'lucide-react';

export const SFX_CATEGORY_ICONS: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }
> = {
  swords: { label: 'Combat', icon: Swords },
  shield: { label: 'Defense', icon: Shield },
  sparkles: { label: 'Magic', icon: Sparkles },
  wand: { label: 'Spells', icon: Wand2 },
  trees: { label: 'Nature', icon: Trees },
  dices: { label: 'Dice', icon: Dices },
  skull: { label: 'Monsters', icon: Skull },
  ghost: { label: 'Undead', icon: Ghost },
  beer: { label: 'Tavern', icon: Beer },
  bell: { label: 'Bell', icon: Bell },
  flame: { label: 'Fire', icon: Flame },
  zap: { label: 'Lightning', icon: Zap },
  target: { label: 'Archery', icon: Target },
  bomb: { label: 'Traps', icon: Bomb },
  compass: { label: 'Adventure', icon: Compass },
  footprints: { label: 'Stealth', icon: Footprints },
  globe: { label: 'Shared', icon: Globe },
};

export const CATEGORY_ICON_OPTIONS = SFX_CATEGORY_ICONS;

export const EMOJI_TO_ICON_ID: Record<string, string> = {
  '⚔️': 'swords',
  '🛡️': 'shield',
  '🏹': 'target',
  '🧙': 'wand',
  '✨': 'sparkles',
  '🌲': 'trees',
  '🎲': 'dices',
  '💀': 'skull',
  '🍺': 'beer',
  '⚡': 'zap',
  '🔔': 'bell',
  '💥': 'bomb',
  '🔥': 'flame',
  '🐉': 'skull',
  '🌐': 'globe',
};

export const renderCategoryIcon = (iconKey?: string, size = 18) => {
  const iconId = (iconKey && EMOJI_TO_ICON_ID[iconKey]) || iconKey || 'swords';
  const IconComponent = SFX_CATEGORY_ICONS[iconId]?.icon || Swords;
  return <IconComponent size={size} className="sfx-category-icon-svg" />;
};

export interface MarqueeTitleProps {
  title: string;
}

export const MarqueeTitle: React.FC<MarqueeTitleProps> = ({ title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scrollData, setScrollData] = useState<{ canScroll: boolean; dist: number; duration: number }>({
    canScroll: false,
    dist: 0,
    duration: 3
  });

  const measure = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      const diff = textWidth - containerWidth;
      if (diff > 2) {
        const dist = diff + 6;
        // Comfortable reading speed: ~28px per second, clamped between 2.5s and 7s
        const duration = Math.min(7, Math.max(2.5, dist / 28));
        setScrollData({ canScroll: true, dist, duration });
      } else {
        setScrollData({ canScroll: false, dist: 0, duration: 3 });
      }
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, title]);

  return (
    <div
      ref={containerRef}
      className="sfx-marquee-wrap"
      onMouseEnter={measure}
    >
      <span
        ref={textRef}
        className={`sfx-sound-title ${scrollData.canScroll ? 'can-scroll' : ''}`}
        style={scrollData.canScroll ? {
          '--scroll-dist': `-${scrollData.dist}px`,
          '--scroll-dur': `${scrollData.duration}s`
        } as React.CSSProperties : undefined}
      >
        {title}
      </span>
    </div>
  );
};
