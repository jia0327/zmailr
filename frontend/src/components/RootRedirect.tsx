import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RootRedirect: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-muted-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/dashboard/inbox' : '/login'} replace />;
};

export default RootRedirect;
