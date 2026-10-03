'use client';

import {useEffect, useState} from 'react';
import {ThemeProvider, useTheme} from 'next-themes';
import {Monitor, Moon, Sun} from 'lucide-react';

export function AppearanceProvider({children}: {children: React.ReactNode}) {
  return <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="physioflow-appearance" disableTransitionOnChange>{children}</ThemeProvider>;
}

export function ThemeControl() {
  const {theme, resolvedTheme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const selected = mounted ? theme || 'system' : 'system';
  return <div className="theme-switch" role="group" aria-label="Appearance">
    {([{value:'light', label:'Light', Icon:Sun}, {value:'dark', label:'Dark', Icon:Moon}, {value:'system', label:'System', Icon:Monitor}] as const).map(({value, label, Icon}) => <button
      key={value} type="button" disabled={!mounted}
      className={selected === value ? 'is-selected' : ''}
      aria-label={value === 'system' ? 'Use device theme' : `Use ${label.toLowerCase()} theme`}
      aria-pressed={mounted && selected === value}
      title={value === 'system' ? `Follow device appearance (${mounted ? resolvedTheme : 'system'})` : `Switch to ${label.toLowerCase()} theme`}
      onClick={() => setTheme(value)}>
      <Icon size={17} aria-hidden="true"/><span>{label}</span>
    </button>)}
  </div>;
}
