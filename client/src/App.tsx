import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar/NavBar';
import InstallBanner from './components/InstallBanner/InstallBanner';
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
import styles from './App.module.css';

const App = () => (
  <div className={styles.app}>
    <main className={styles.content}>
      <Routes>
        <Route path="/"                    element={<HomePage />} />
        <Route path="/milk-drank"          element={<MilkDrankPage />} />
        <Route path="/milk-saved"          element={<MilkSavedPage />} />
        <Route path="/milk-saved/:id"      element={<EditStoredMilkPage />} />
        <Route path="/medicine"            element={<MedicinePage />} />
        <Route path="/medicine/log/:id"    element={<EditMedicineLogPage />} />
        <Route path="/medicine/:id"        element={<EditMedicinePage />} />
        <Route path="/sleep"               element={<SleepPage />} />
        <Route path="/poop-pee"            element={<PoopPeePage />} />
        <Route path="/drank-milk/:id"     element={<EditDrankMilkPage />} />
        <Route path="/sleep/:id"           element={<EditSleepPage />} />
        <Route path="/pee/:id"             element={<EditPoopPeePage type="pee" />} />
        <Route path="/poop/:id"            element={<EditPoopPeePage type="poop" />} />
        <Route path="/pumping"             element={<PumpingPage />} />
        <Route path="/pumping/:id"         element={<EditPumpingPage />} />
        <Route path="/settings"            element={<SettingsPage />} />
        <Route path="*"                    element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <InstallBanner />
    <NavBar />
  </div>
);

export default App;

