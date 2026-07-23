import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar/NavBar';
import InstallBanner from './components/InstallBanner/InstallBanner';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import LoginPage from './pages/LoginPage/LoginPage';
import HomePage from './pages/HomePage/HomePage';
import PoopPeePage from './pages/PoopPeePage/PoopPeePage';
import MilkDrankPage from './pages/MilkDrankPage/MilkDrankPage';
import SleepPage from './pages/SleepPage/SleepPage';
import EditDrankMilkPage from './pages/EditDrankMilkPage/EditDrankMilkPage';
import EditSleepPage from './pages/EditSleepPage/EditSleepPage';
import EditPoopPeePage from './pages/EditPoopPeePage/EditPoopPeePage';
import MedicinePage from './pages/MedicinePage/MedicinePage';
import EditMedicineLogPage from './pages/EditMedicineLogPage/EditMedicineLogPage';
import EditMedicinePage from './pages/EditMedicinePage/EditMedicinePage';
import EditPumpingPage from './pages/EditPumpingPage/EditPumpingPage';
import PumpingPage from './pages/PumpingPage/PumpingPage';
import MilkSavedPage from './pages/MilkSavedPage/MilkSavedPage';
import EditStoredMilkPage from './pages/EditStoredMilkPage/EditStoredMilkPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import AdminBabiesPage from './pages/AdminBabiesPage/AdminBabiesPage';
import AdminUsersPage from './pages/AdminUsersPage/AdminUsersPage';
import styles from './App.module.css';

const App = () => {
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <div className={styles.app}>
      <main className={isLogin ? styles.contentLogin : styles.content}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/babies" element={<ProtectedRoute><AdminBabiesPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
          {/* User routes */}
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/milk-drank" element={<ProtectedRoute><MilkDrankPage /></ProtectedRoute>} />
          <Route path="/milk-saved" element={<ProtectedRoute><MilkSavedPage /></ProtectedRoute>} />
          <Route path="/milk-saved/:id" element={<ProtectedRoute><EditStoredMilkPage /></ProtectedRoute>} />
          <Route path="/medicine" element={<ProtectedRoute><MedicinePage /></ProtectedRoute>} />
          <Route path="/medicine/log/:id" element={<ProtectedRoute><EditMedicineLogPage /></ProtectedRoute>} />
          <Route path="/medicine/:id" element={<ProtectedRoute><EditMedicinePage /></ProtectedRoute>} />
          <Route path="/sleep" element={<ProtectedRoute><SleepPage /></ProtectedRoute>} />
          <Route path="/poop-pee" element={<ProtectedRoute><PoopPeePage /></ProtectedRoute>} />
          <Route path="/drank-milk/:id" element={<ProtectedRoute><EditDrankMilkPage /></ProtectedRoute>} />
          <Route path="/sleep/:id" element={<ProtectedRoute><EditSleepPage /></ProtectedRoute>} />
          <Route path="/pee/:id" element={<ProtectedRoute><EditPoopPeePage type="pee" /></ProtectedRoute>} />
          <Route path="/poop/:id" element={<ProtectedRoute><EditPoopPeePage type="poop" /></ProtectedRoute>} />
          <Route path="/pumping" element={<ProtectedRoute><PumpingPage /></ProtectedRoute>} />
          <Route path="/pumping/:id" element={<ProtectedRoute><EditPumpingPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {isLogin ? null : <InstallBanner />}
      {isLogin ? null : <NavBar />}
    </div>
  );
};

export default App;
