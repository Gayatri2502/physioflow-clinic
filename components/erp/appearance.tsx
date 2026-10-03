'use client';

import {useEffect, useState} from 'react';
import {ThemeProvider, useTheme} from 'next-themes';
import {Monitor, Moon, Sun} from 'lucide-react';

export function AppearanceProvider({children}: {children: React.ReactNode}) {
  return <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="physioflow-appearance" disableTransitionOnChange>{children}</ThemeProvider>;
}

export function ThemeControl() {
  const {theme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const selected = mounted ? theme || 'system' : 'system';
  const Icon = selected === 'dark' ? Moon : selected === 'light' ? Sun : Monitor;
  return <label className="theme-control" title="Appearance: System follows your device setting">
    <Icon size={16} aria-hidden="true"/>
    <select aria-label="Appearance" value={selected} disabled={!mounted} onChange={event => setTheme(event.target.value)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
