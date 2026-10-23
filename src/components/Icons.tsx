import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };
export function Icon({ name, size = 22, ...props }: Props & { name: 'spark' | 'arrow' | 'sound' | 'muted' | 'chevron' | 'close' | 'logout' | 'planet' | 'heart' | 'check' | 'refresh' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {name === 'spark' && <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />}
    {name === 'arrow' && <><path d="M4 12h15M13 5l7 7-7 7" /></>}
    {name === 'sound' && <><path d="m11 4-6 5H2v6h3l6 5V4Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>}
    {name === 'muted' && <><path d="m11 4-6 5H2v6h3l6 5V4Z" /><path d="m16 9 6 6m0-6-6 6" /></>}
    {name === 'chevron' && <path d="m6 9 6 6 6-6" />}
    {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
    {name === 'logout' && <><path d="M9 4H4v16h5m5-13 5 5-5 5m-5-5h10" /></>}
    {name === 'planet' && <><circle cx="12" cy="12" r="7" /><ellipse cx="12" cy="12" rx="12" ry="3.3" transform="rotate(-28 12 12)" /></>}
    {name === 'heart' && <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />}
    {name === 'check' && <path d="m5 12 4 4L19 6" />}
    {name === 'refresh' && <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 6a8 8 0 0 1 13.5 4M4.4 14A8 8 0 0 0 18 18" /></>}
  </svg>;
}

export function GoogleMark() {
  return <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.88-1.73 2.99-4.29 2.99-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.22-2.51c-.89.6-2.02.96-3.39.96-2.6 0-4.8-1.75-5.59-4.1H3.08v2.6A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.41 13.94a6 6 0 0 1 0-3.88v-2.6H3.08a10 10 0 0 0 0 9.08l3.33-2.6Z" /><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.92 5.46l3.33 2.6A5.98 5.98 0 0 1 12 5.96Z" /></svg>;
}
