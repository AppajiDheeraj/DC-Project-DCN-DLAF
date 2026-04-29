import { NavLink } from 'react-router-dom';
import { useTheme } from '@/lib/theme';
import { RiSunLine, RiMoonLine } from 'react-icons/ri';

const links = [
  { to: '/', label: 'Home' },
  { to: '/concepts', label: 'Concepts' },
  { to: '/simulator', label: 'Simulator' },
  { to: '/results', label: 'Results' },
  { to: '/p4', label: 'P4 Code' },
];

export default function NavBar() {
  const { theme, toggle } = useTheme();
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <span className="font-bold text-lg tracking-tight">
          <span className="text-blue-500">DLAF</span> Lab
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          <button
            onClick={toggle}
            className="ml-2 p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <RiSunLine size={16} /> : <RiMoonLine size={16} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
