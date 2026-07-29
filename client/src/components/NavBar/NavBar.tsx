import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authStore } from '../../utils/authStore';
import { authFetch } from '../../utils/authFetch';
import { useTranslation } from '../../i18n/i18n';
import { HOME_ITEM, SETTINGS_ITEM, USER_FEATURE_ITEMS, ADMIN_MAIN_ITEMS, VISIBLE_FEATURE_COUNT } from '../../utils/navItems';
import { getSavedNavOrder, applyNavOrder, getHiddenNavItems } from '../../utils/navOrder';
import styles from './NavBar.module.css';

const NavBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = authStore.getUser()?.role === 'admin';

  // Feature items are user-reorderable and optional (Settings page → Navigation tab);
  // Home, Settings and Logout always stay in their fixed slots. Read on every render so a
  // reorder/hide made on the Settings page is reflected as soon as the user navigates back.
  const hiddenFeatureItems = new Set(isAdmin ? [] : getHiddenNavItems());
  const orderedFeatureItems = isAdmin
    ? []
    : applyNavOrder(USER_FEATURE_ITEMS, getSavedNavOrder()).filter((item) => !hiddenFeatureItems.has(item.path));

  // Home is fixed at position 2 on the main bar (after the first visible feature item).
  const visibleFeatureItems = orderedFeatureItems.slice(0, VISIBLE_FEATURE_COUNT);
  const mainItems = isAdmin
    ? ADMIN_MAIN_ITEMS
    : [...visibleFeatureItems.slice(0, 1), HOME_ITEM, ...visibleFeatureItems.slice(1)];

  const menuItems = isAdmin
    ? [SETTINGS_ITEM]
    : [...orderedFeatureItems.slice(VISIBLE_FEATURE_COUNT), SETTINGS_ITEM];

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


