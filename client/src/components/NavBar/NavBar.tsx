import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './NavBar.module.css';

type TNavItem = {
  path: string;
  emoji: string;
  label: string;
};

const MAIN_ITEMS: TNavItem[] = [
  { path: '/poop-pee',   emoji: '💩', label: 'Poop & Pee' },
  { path: '/',           emoji: '🏠', label: 'Home'       },
  { path: '/milk-drank', emoji: '🍼', label: 'Milk Drank' },
  { path: '/sleep',      emoji: '🌙', label: 'Sleep'      },
];

const MENU_ITEMS: TNavItem[] = [
  { path: '/pumping',    emoji: '🥛', label: 'Pumping'   },
  { path: '/medicine',   emoji: '💊', label: 'Medicine'  },
  { path: '/milk-saved', emoji: '🧊', label: 'Milk Saved'},
  { path: '/settings',   emoji: '⚙️', label: 'Settings'  },
];

const NavBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleMenuNavigate = useCallback((path: string) => {
    navigate(path);
    setMenuOpen(false);
  }, [navigate]);

  return (
    <>
      {menuOpen ? <div className={styles.overlay} onClick={closeMenu} /> : null}
      <nav className={styles.nav}>
        <div className={styles.menuAnchor}>
          <button
            type="button"
            aria-label="Menu"
            data-tooltip="Menu"
            className={`${styles.navBtn} ${menuOpen ? styles.active : ''}`}
            onClick={toggleMenu}
          >
            ☰
          </button>

          {MENU_ITEMS.map(({ path, emoji, label }, index) => (
            <button
              key={path}
              type="button"
              aria-label={label}
              data-tooltip={label}
              className={`${styles.menuItem} ${menuOpen ? styles.menuItemOpen : ''} ${pathname === path ? styles.menuItemActive : ''}`}
              style={{ '--i': index } as React.CSSProperties}
              onClick={() => handleMenuNavigate(path)}
            >
              {emoji}
            </button>
          ))}
        </div>

        {MAIN_ITEMS.map(({ path, emoji, label }) => (
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
    </>
  );
};

export default NavBar;
