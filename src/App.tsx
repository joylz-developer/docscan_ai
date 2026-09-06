import React from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { TabNavigation } from './components/layout/TabNavigation';
import { ToastContainer } from './components/layout/ToastContainer';
import { ScanningTab } from './components/tabs/ScanningTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { PairingTab } from './components/tabs/PairingTab';
import { RegistryTab } from './components/tabs/RegistryTab';
import { MobileScanner } from './components/mobile/MobileScanner';
import { WebcamModal } from './components/modals/WebcamModal';
import { ServerGuideModal } from './components/modals/ServerGuideModal';

export const MainAppContent: React.FC = () => {
  const { isMobileMode, activeTab } = useApp();

  if (isMobileMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <MobileScanner />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      <Header />
      <TabNavigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activeTab === 1 && <ScanningTab />}
        {activeTab === 2 && <SettingsTab />}
        {activeTab === 3 && <PairingTab />}
        {activeTab === 4 && <RegistryTab />}
      </main>

      <WebcamModal />
      <ServerGuideModal />
      <ToastContainer />
    </div>
  );
};
