import React from 'react';
import { Outlet } from 'react-router-dom';
import DashboardSidebar from './DashboardSidebar';
import AnnouncementModal from './AnnouncementModal';
import SEO from './SEO';

const DashboardLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <SEO title="zMailR Dashboard" description="zMailR temporary email dashboard" />
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AnnouncementModal />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
