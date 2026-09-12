'use client';

import { Network } from 'lucide-react';
import ContractorConnectionPanel from '@/components/contractor-connection-panel';
import { ProjectDetailData } from '@/hooks/use-projects';

interface ConnectionsTabProps {
  project: ProjectDetailData;
}

export default function ConnectionsTab({ project }: ConnectionsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-cyan-400" />
        <h3 className="text-base font-bold text-white">
          Contractor Alliance & Signatory Intelligence
        </h3>
      </div>

      <ContractorConnectionPanel
        contractorRaw={project.contractorRaw}
        engineerSignature={project.contractDocument?.engineerSignature}
      />
    </div>
  );
}
