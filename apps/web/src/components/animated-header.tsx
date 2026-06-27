'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

export function AnimatedHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.from('[data-animate]', { opacity: 0, y: 24, stagger: 0.12, duration: 0.7, ease: 'power3.out' }); }, { scope: ref });
  return <div ref={ref}><h1 data-animate className="max-w-4xl text-4xl font-semibold tracking-tight lg:text-6xl">{title}</h1><p data-animate className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{subtitle}</p></div>;
}
