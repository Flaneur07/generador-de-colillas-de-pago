import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUploader } from './components/FileUploader';
import { ClientList } from './components/ClientList';
import { PDFPreview } from './components/PDFPreview';
import { ClientDetailModal } from './components/ClientDetailModal';
import { ReportsModal } from './components/ReportsModal';
import { NewClientModal } from './components/NewClientModal';
import { SiteSelector } from './components/SiteSelector';
import { Client } from './types';
import { SITES, SiteConfig } from './config/siteConfigs';

function App() {
  const [selectedSite, setSelectedSite] = useState<SiteConfig | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);

  useEffect(() => {
    const savedSiteId = localStorage.getItem('selectedSiteId');
    if (savedSiteId) {
      const site = SITES.find(s => s.id === savedSiteId);
      if (site) setSelectedSite(site);
    }
  }, []);

  const handleSelectSite = (site: SiteConfig) => {
    setSelectedSite(site);
    localStorage.setItem('selectedSiteId', site.id);
  };

  const handleLogout = () => {
    setSelectedSite(null);
    localStorage.removeItem('selectedSiteId');
    setClients([]);
  };

  const handleDataLoaded = (data: Client[]) => {
    setClients(data);
    setSelectedClient(null);
  };

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    if (selectedClient?.id === updatedClient.id) setSelectedClient(updatedClient);
  };

  const handleAddNewClient = (newClient: Client) => {
    setClients(prev => [newClient, ...prev]);
    setSelectedClient(newClient);
  };

  const handleDeleteClient = (clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    if (selectedClient?.id === clientId) setSelectedClient(null);
  };

  if (!selectedSite) {
    return <SiteSelector onSelect={handleSelectSite} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header
        siteName={selectedSite.name}
        onOpenReports={() => setIsReportsOpen(true)}
        onNewClient={() => setIsNewClientOpen(true)}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="space-y-8">
          <section className="max-w-3xl mx-auto">
            <FileUploader
              onDataLoaded={handleDataLoaded}
              siteId={selectedSite.id}
            />
          </section>

          {clients.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in">
              <div className="lg:col-span-2">
                <ClientList
                  clients={clients}
                  selectedClient={selectedClient}
                  onSelectClient={setSelectedClient}
                  onEditClient={setEditingClient}
                />
              </div>
              <div className="lg:col-span-1 lg:sticky lg:top-24">
                <PDFPreview client={selectedClient} siteConfig={selectedSite} />
              </div>
            </div>
          )}
        </div>
      </main>

      <ClientDetailModal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        client={editingClient}
        onSave={handleUpdateClient}
        onDelete={handleDeleteClient}
        siteId={selectedSite.id}
      />

      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        onSave={handleAddNewClient}
        existingClients={clients}
        siteId={selectedSite.id}
      />

      <ReportsModal
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        clients={clients}
      />
    </div>
  );
}

export default App;
