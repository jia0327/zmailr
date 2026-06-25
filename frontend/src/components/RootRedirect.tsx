import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RootRedirect: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard/usage" replace />;
  }

  // 鉴权完成前先到登录页，避免全屏 spinner 阻塞首屏
  return <Navigate to="/login" replace />;
};

export default RootRedirect;
