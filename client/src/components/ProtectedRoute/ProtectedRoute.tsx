import { Navigate } from 'react-router-dom';
import { authStore } from '../../utils/authStore';

type TProps = {
  children: React.ReactNode;
};

const ProtectedRoute = ({ children }: TProps) => {
  if (!authStore.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;

