import { Link, useLocation } from 'react-router-dom';
import { Settings, Zap, Monitor } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { useUnit } from '@/contexts/unit';
import { useTheme, THEME_LIST, THEME_LABELS, type Theme } from '@/contexts/theme';

interface HeaderProps {
  isRunning?: boolean;
  nextRun?: string | null;
}

const THEME_ICONS: Record<Theme, string> = { void: '◉', terminal: '⬛', paper: '□' };

export function Header({ isRunning, nextRun }: HeaderProps) {
  const location = useLocation();
  const onSettings = location.pathname === '/settings';
  const { unit, setUnit } = useUnit();
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    const idx = THEME_LIST.indexOf(theme);
    setTheme(THEME_LIST[(idx + 1) % THEME_LIST.length]);
  }

  return (
    <header className="border-b border-border bg-card px-4 py-2.5 flex items-center justify-between">
      {/* Brand — always links home */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <Zap className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
        <span className="text-sm font-semibold tracking-widest uppercase text-foreground group-hover:text-primary transition-colors">
          SpeedWatch
        </span>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs text-amber-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            testing…
          </span>
        )}
      </Link>

      <div className="flex items-center gap-1.5">
        {/* next run */}
        {nextRun && !isRunning && (
          <span className="hidden md:block text-xs text-muted-foreground mr-2">
            next {new Date(nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}

        {/* Unit toggle: Mbps / MB/s */}
        <div className="flex items-center border border-border overflow-hidden text-xs">
          <button
            onClick={() => setUnit('Mbps')}
            className={cn('px-2.5 py-1 transition-colors', unit === 'Mbps' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}
          >
            Mbps
          </button>
          <button
            onClick={() => setUnit('MBps')}
            className={cn('px-2.5 py-1 transition-colors', unit === 'MBps' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}
          >
            MB/s
          </button>
        </div>

        {/* Theme cycle */}
        <Button variant="ghost" size="sm" onClick={cycleTheme} className="gap-1.5 text-xs px-2.5 h-7">
          <Monitor className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{THEME_ICONS[theme]} {THEME_LABELS[theme]}</span>
        </Button>

        {/* Settings link */}
        <Button variant={onSettings ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" asChild>
          <Link to={onSettings ? '/' : '/settings'} aria-label="Settings">
            <Settings className={cn('h-3.5 w-3.5', onSettings && 'text-primary')} />
          </Link>
        </Button>
      </div>
    </header>
  );
}
