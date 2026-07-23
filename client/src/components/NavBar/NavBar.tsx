import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authStore } from '../../utils/authStore';
import { authFetch } from '../../utils/authFetch';
import styles from './NavBar.module.css';

type TNavItem = {
  path: string;
  emoji: string;
  label: string;
};

// ── User nav ──────────────────────────────────────────────────────────────────
const USER_MAIN_ITEMS: TNavItem[] = [
  { path: '/pumping',    emoji: '🥛', label: 'Pumping'   },
  { path: '/',           emoji: '🏠', label: 'Home'       },
  { path: '/milk-drank', emoji: '🍼', label: 'Milk Drank' },
  { path: '/sleep',      emoji: '🌙', label: 'Sleep'      },
];

const USER_MENU_ITEMS: TNavItem[] = [
  { path: '/poop-pee',   emoji: '💩', label: 'Poop & Pee' },
  { path: '/medicine',   emoji: '💊', label: 'Medicine'   },
  { path: '/milk-saved', emoji: '🧊', label: 'Milk Saved' },
  { path: '/settings',   emoji: '⚙️', label: 'Settings'   },
];

// ── Admin nav ─────────────────────────────────────────────────────────────────
const ADMIN_MAIN_ITEMS: TNavItem[] = [
  { path: '/admin/babies', emoji: '👶', label: 'Babies' },
  { path: '/admin',        emoji: '🔑', label: 'Admin'  },
  { path: '/admin/users',  emoji: '👥', label: 'Users'  },
];

const ADMIN_MENU_ITEMS: TNavItem[] = [
  { path: '/settings', emoji: '⚙️', label: 'Settings' },
];

const NavBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = authStore.getUser()?.role === 'admin';

  const mainItems  = isAdmin ? ADMIN_MAIN_ITEMS  : USER_MAIN_ITEMS;
  const menuItems  = isAdmin ? ADMIN_MENU_ITEMS  : USER_MENU_ITEMS;

  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
  const closeMenu  = useCallback(() => setMenuOpen(false), []);

  const handleMenuNavigate = useCallback((path: string) => {
    navigate(path);
    setMenuOpen(false);
  }, [navigate]);

  const navigateAndClose = useCallback((path: string) => {
    navigate(path);
    closeMenu();
  }, [navigate, closeMenu]);

  const handleLogout = useCallback(async () => {
    const refreshToken = authStore.getRefreshToken();
    await authFetch('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    authStore.clear();
    navigate('/login', { replace: true });
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

          {menuItems.map(({ path, emoji, label }, index) => (
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
          <button
            type="button"
            aria-label="Log out"
            data-tooltip="Log out"
            className={`${styles.menuItem} ${menuOpen ? styles.menuItemOpen : ''}`}
            style={{ '--i': menuItems.length } as React.CSSProperties}
            onClick={handleLogout}
          >
            🚪
          </button>
        </div>

        {mainItems.map(({ path, emoji, label }) => (
          <button
            key={path}
            type="button"
            aria-label={label}
            data-tooltip={label}
            className={`${styles.navBtn} ${pathname === path ? styles.active : ''}`}
            onClick={() => navigateAndClose(path)}
          >
            {emoji}
          </button>
        ))}
      </nav>
    </>
  );
};

export default NavBar;
