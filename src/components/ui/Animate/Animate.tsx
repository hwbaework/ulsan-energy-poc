'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimateProps {
  children: ReactNode;
  animation?: 'fadeIn' | 'slideUp' | 'slideDown';
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

export function Animate({
  children,
  animation = 'fadeIn',
  delay = 0,
  duration = 200,
  className,
  once = true,
}: AnimateProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!once) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [once]);

  const animationClass = {
    fadeIn: 'animate-fadeIn',
    slideUp: 'animate-slideUp',
    slideDown: 'animate-slideDown',
  }[animation];

  return (
    <div
      ref={ref}
      className={cn('opacity-0', visible && animationClass, visible && 'opacity-100', className)}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationFillMode: 'forwards',
      }}
    >
      {children}
    </div>
  );
}

interface StaggerProps {
  children: ReactNode[];
  animation?: 'fadeIn' | 'slideUp' | 'slideDown';
  staggerDelay?: number;
  duration?: number;
  className?: string;
  itemClassName?: string;
}

export function Stagger({
  children,
  animation = 'slideUp',
  staggerDelay = 50,
  duration = 200,
  className,
  itemClassName,
}: StaggerProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Animate key={i} animation={animation} delay={i * staggerDelay} duration={duration} className={itemClassName}>
          {child}
        </Animate>
      ))}
    </div>
  );
}
