import React, { useEffect, Suspense, lazy } from 'react';
import { useAuditStore } from './hooks/useAuditStore';
import { TauriTitlebar } from './components/TauriTitlebar';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

// Phase fix: every view and modal used to be a static top-level import,
// so the entire app - including PythonCodeView, ExportPdfModal, and
// UploadPdfModal (which pulls in pdfjs-dist) - shipped in one ~1MB main
// bundle regardless of which single view the person actually opened.
// React.lazy() + Suspense splits each into its own chunk, loaded only
// when its route/modal is actually opened.
const ClauseAuditView = lazy(() => import('./components/views/ClauseAuditView').then(m => ({ default: m.ClauseAuditView })));
const ContractOverviewView = lazy(() => import('./components/views/ContractOverviewView').then(m => ({ default: m.ContractOverviewView })));
const ClausesManifestView = lazy(() => import('./components/views/ClausesManifestView').then(m => ({ default: m.ClausesManifestView })));
const ComplianceReposView = lazy(() => import('./components/views/ComplianceReposView').then(m => ({ default: m.ComplianceReposView })));
const ReviewQueueView = lazy(() => import('./components/views/ReviewQueueView').then(m => ({ default: m.ReviewQueueView })));
const AuditPipelineLogsView = lazy(() => import('./components/views/AuditPipelineLogsView').then(m => ({ default: m.AuditPipelineLogsView })));
const HashChainVisualizerView = lazy(() => import('./components/views/HashChainVisualizerView').then(m => ({ default: m.HashChainVisualizerView })));
const CounterpartyDiffView = lazy(() => import('./components/views/CounterpartyDiffView').then(m => ({ default: m.CounterpartyDiffView })));
const PythonCodeView = lazy(() => import('./components/views/PythonCodeView').then(m => ({ default: m.PythonCodeView })));
const JsonModal = lazy(() => import('./components/modals/JsonModal').then(m => ({ default: m.JsonModal })));
const OverrideModal = lazy(() => import('./components/modals/OverrideModal').then(m => ({ default: m.OverrideModal })));
const ExportPdfModal = lazy(() => import('./components/modals/ExportPdfModal').then(m => ({ default: m.ExportPdfModal })));
const ReRunAuditModal = lazy(() => import('./components/modals/ReRunAuditModal').then(m => ({ default: m.ReRunAuditModal })));
const UploadPdfModal = lazy(() => import('./components/modals/UploadPdfModal').then(m => ({ default: m.UploadPdfModal })));

const ViewLoadingFallback = () => (
  <div className="flex items-center justify-center h-full text-[#94a3b8] font-mono text-xs p-8">
    Loading...
  </div>
);

export default function App() {
  const store = useAuditStore();

  // Keyboard Shortcuts (Meta+J, Meta+R, Meta+E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'j') {
          e.preventDefault();
          store.setIsJsonModalOpen(true);
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          store.setIsRerunModalOpen(true);
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          store.setIsExportPdfModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  const isOverallAmber = Object.values(store.clauseStatuses).some((s) => s.toLowerCase().includes('gaps flagged') || s.toLowerCase().includes('amber'));
  const isOverallRed = Object.values(store.clauseStatuses).some((s) => s.toLowerCase().includes('conflict') || s.toLowerCase().includes('rejected'));
  const overallStatusText = isOverallRed
    ? 'Audit Alert - Revisions Required'
    : isOverallAmber
    ? 'Audit Completed - Amber Review Required'
    : 'Audit Certified - All Clauses Passing';
  const statusType = isOverallRed ? 'red' : isOverallAmber ? 'amber' : 'green';

  return (
    <div className="relative flex flex-col h-screen w-screen bg-[#070b14] text-[#dae2fd] overflow-hidden select-none font-['Sora',sans-serif]">
      <TauriTitlebar
        onSelectView={store.setActiveView}
        contractName={store.contractName}
      />

      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar
          activeView={store.activeView}
          onSelectView={store.setActiveView}
          clauseStatuses={store.clauseStatuses}
          clauses={store.clauses}
          onUploadPdf={() => store.setIsUploadPdfModalOpen(true)}
          onVerifyLedger={store.handleVerifyLedgerChain}
          isVerifyingLedger={store.isVerifyingLedger}
        />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#070b14]">
          <Header
            onExportPdf={() => store.setIsExportPdfModalOpen(true)}
            onExportProofBundle={store.handleExportProofBundle}
            onRerunAudit={() => store.setIsRerunModalOpen(true)}
            onOverrideVerdict={() => store.setIsOverrideModalOpen(true)}
            onUploadPdf={() => store.setIsUploadPdfModalOpen(true)}
            onResetBenchmark={store.resetToBenchmarkContract}
            overallStatusText={overallStatusText}
            statusType={statusType}
            contractId={store.contractName.split(' ')[0]}
            clauseId={store.currentClause?.id || 'clause-001'}
            activeView={store.activeView}
            onSelectView={store.setActiveView}
          />

          <main className="flex-1 overflow-y-auto px-4 pt-3 bg-[#0b1326]">
          <Suspense fallback={<ViewLoadingFallback />}>
            {store.activeView === 'contract-overview' && (
              <ContractOverviewView
                onSelectView={store.setActiveView}
                onRunFullAudit={() => store.setIsRerunModalOpen(true)}
                onUploadPdf={() => store.setIsUploadPdfModalOpen(true)}
                contractName={store.contractName}
                sourceDocHash={store.sourceDocHash}
                clauses={store.clauses}
                clauseStatuses={store.clauseStatuses}
              />
            )}

            {store.activeView === 'clauses-breakdown' && (
              <ClausesManifestView
                onSelectView={store.setActiveView}
                clauseStatuses={store.clauseStatuses}
                clauses={store.clauses}
                contractName={store.contractName}
              />
            )}

            {(store.activeView.startsWith('clause-') || !!store.clauses[store.activeView]) && (
              <ClauseAuditView
                clause={store.currentClause}
                onApproveCaveat={store.handleApproveCaveat}
                onOverridePass={store.handleOverridePass}
                onApplyRedline={store.handleApplyRedlineRevision}
                onRejectRevision={store.handleRejectRevision}
                onRerunClassifier={store.handleRerunClassifier}
                onOpenJsonModal={() => store.setIsJsonModalOpen(true)}
                onOpenOverrideModal={() => store.setIsOverrideModalOpen(true)}
                isRerunning={store.isRerunningInline}
                contractName={store.contractName}
              />
            )}

            {(store.activeView === 'regulatory-ftc' ||
              store.activeView === 'regulatory-gdpr' ||
              store.activeView === 'regulatory-ccpa' ||
              store.activeView === 'regulatory-popia' ||
              store.activeView === 'regulatory-lesotho-dpa') && (
              <ComplianceReposView initialRepo={store.activeView} />
            )}

            {store.activeView === 'review-queue' && (
              <ReviewQueueView onSelectClause={(id) => store.setActiveView(id as any)} />
            )}

            {store.activeView === 'counterparty-diff' && (
              <CounterpartyDiffView
                currentClauses={Object.values(store.clauses)}
                contractName={store.contractName}
                onApplyUnifiedRedline={store.handleApplyRedlineRevision}
              />
            )}

            {store.activeView === 'merkle-visualizer' && (
              <HashChainVisualizerView
                ledgerBlocks={store.ledgerBlocks}
                contractName={store.contractName}
                sourceDocHash={store.sourceDocHash}
                onVerifyLedger={store.handleVerifyLedgerChain}
                isVerifying={store.isVerifyingLedger}
              />
            )}

            {store.activeView === 'audit-pipeline-logs' && (
              <AuditPipelineLogsView
                logs={store.logs}
                ledgerBlocks={store.ledgerBlocks}
                onTriggerRun={() => store.handleRerunClassifier(store.currentClause.id)}
                isExecuting={store.isRerunningInline}
                onVerifyLedger={store.handleVerifyLedgerChain}
                onExportProofBundle={store.handleExportProofBundle}
              />
            )}

            {store.activeView === 'python-source' && <PythonCodeView />}
          </Suspense>
          </main>
        </div>
      </div>

      {store.toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2d3449] border border-[#ffc174]/40 text-[#dae2fd] px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 text-xs font-mono animate-bounce">
          <span className="material-symbols-outlined text-[#ffc174] text-[18px]">info</span>
          <span>{store.toastMessage}</span>
        </div>
      )}

      {store.isJsonModalOpen && (
        <Suspense fallback={null}>
          <JsonModal
            isOpen={store.isJsonModalOpen}
            onClose={() => store.setIsJsonModalOpen(false)}
            clause={store.currentClause}
          />
        </Suspense>
      )}
      {store.isOverrideModalOpen && (
        <Suspense fallback={null}>
          <OverrideModal
            isOpen={store.isOverrideModalOpen}
            onClose={() => store.setIsOverrideModalOpen(false)}
            clauseId={store.currentClause.id}
            clauseTitle={store.currentClause.title}
            currentVerdict={store.currentClause.verdict}
            onConfirmOverride={store.handleConfirmModalOverride}
          />
        </Suspense>
      )}
      {store.isExportPdfModalOpen && (
        <Suspense fallback={null}>
          <ExportPdfModal
            isOpen={store.isExportPdfModalOpen}
            onClose={() => store.setIsExportPdfModalOpen(false)}
            contractId={store.contractName.split(' ')[0] || 'contract-001'}
            clauses={Object.values(store.clauses)}
            onExportProofBundle={store.handleExportProofBundle}
            onExportEvidenceZip={store.handleExportEvidenceZip}
          />
        </Suspense>
      )}
      {store.isRerunModalOpen && (
        <Suspense fallback={null}>
          <ReRunAuditModal
            isOpen={store.isRerunModalOpen}
            onClose={() => store.setIsRerunModalOpen(false)}
            clauseId={store.currentClause.id}
            onComplete={(_newConf) => {
              store.handleRerunClassifier(store.currentClause.id);
            }}
          />
        </Suspense>
      )}
      {store.isUploadPdfModalOpen && (
        <Suspense fallback={null}>
          <UploadPdfModal
            isOpen={store.isUploadPdfModalOpen}
            onClose={() => store.setIsUploadPdfModalOpen(false)}
            onUploadSuccess={store.handleContractUpload}
          />
        </Suspense>
      )}
    </div>
  );
}
