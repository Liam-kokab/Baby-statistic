import { useNavigate, useLocation } from 'react-router-dom';
import styles from './NavBar.module.css';

type TNavItem = {
  path: string;
  emoji: string;
  label: string;
};

const NAV_ITEMS: TNavItem[] = [
  { path: '/poop-pee',   emoji: '💩', label: 'Poop & Pee' },
  { path: '/pumping',    emoji: '🥛', label: 'Pumping'    },
  { path: '/medicine',   emoji: '💊', label: 'Medicine'   },
  { path: '/',           emoji: '🏠', label: 'Home'       },
  { path: '/milk-drank', emoji: '🍼', label: 'Milk Drank' },
  { path: '/sleep',      emoji: '🌙', label: 'Sleep'      },
];

const NavBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(({ path, emoji, label }) => (
        <button
          key={path}
          type="button"
          aria-label={label}
          data-tooltip={label}
          className={`${styles.navBtn} ${pathname === path ? styles.active : ''}`}
          onClick={() => navigate(path)}
        >
          {emoji}
        </button>
      ))}
    </nav>
  );
};

export default NavBar;
