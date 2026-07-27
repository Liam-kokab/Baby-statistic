import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authStore } from '../../utils/authStore';
import { authFetch } from '../../utils/authFetch';
import { useTranslation } from '../../i18n/i18n';
import styles from './NavBar.module.css';

type TNavItem = {
  path: string;
  emoji: string;
  labelKey: string;
};

// ── User nav ──────────────────────────────────────────────────────────────────
const USER_MAIN_ITEMS: TNavItem[] = [
  { path: '/pumping',    emoji: '🥛', labelKey: 'NAV_PUMPING'   },
  { path: '/',           emoji: '🏠', labelKey: 'NAV_HOME'       },
  { path: '/milk-drank', emoji: '🍼', labelKey: 'NAV_MILK_DRANK' },
  { path: '/sleep',      emoji: '🌙', labelKey: 'NAV_SLEEP'      },
];

const USER_MENU_ITEMS: TNavItem[] = [
  { path: '/poop-pee',   emoji: '💩', labelKey: 'NAV_POOP_AND_PEE' },
  { path: '/medicine',   emoji: '💊', labelKey: 'NAV_MEDICINE'   },
  { path: '/milk-saved', emoji: '🧊', labelKey: 'NAV_MILK_SAVED' },
  { path: '/milestones', emoji: '🏆', labelKey: 'NAV_MILESTONES' },
  { path: '/settings',   emoji: '⚙️', labelKey: 'NAV_SETTINGS'   },
];

// ── Admin nav ─────────────────────────────────────────────────────────────────
const ADMIN_MAIN_ITEMS: TNavItem[] = [
  { path: '/admin/babies', emoji: '👶', labelKey: 'NAV_BABIES' },
  { path: '/admin',        emoji: '🔑', labelKey: 'NAV_ADMIN'  },
  { path: '/admin/users',  emoji: '👥', labelKey: 'NAV_USERS'  },
];

const ADMIN_MENU_ITEMS: TNavItem[] = [
  { path: '/settings', emoji: '⚙️', labelKey: 'NAV_SETTINGS' },
];

const NavBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
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
            aria-label={t('NAV_MENU')}
            data-tooltip={t('NAV_MENU')}
            className={`${styles.navBtn} ${menuOpen ? styles.active : ''}`}
            onClick={toggleMenu}
          >
            ☰
          </button>

          {menuItems.map(({ path, emoji, labelKey }, index) => (
            <button
              key={path}
              type="button"
              aria-label={t(labelKey)}
              data-tooltip={t(labelKey)}
              className={`${styles.menuItem} ${menuOpen ? styles.menuItemOpen : ''} ${pathname === path ? styles.menuItemActive : ''}`}
              style={{ '--i': index } as React.CSSProperties}
              onClick={() => handleMenuNavigate(path)}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            aria-label={t('NAV_LOGOUT')}
            data-tooltip={t('NAV_LOGOUT')}
            className={`${styles.menuItem} ${menuOpen ? styles.menuItemOpen : ''}`}
            style={{ '--i': menuItems.length } as React.CSSProperties}
            onClick={handleLogout}
          >
            🚪
          </button>
        </div>

        {mainItems.map(({ path, emoji, labelKey }) => (
          <button
            key={path}
            type="button"
            aria-label={t(labelKey)}
            data-tooltip={t(labelKey)}
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


