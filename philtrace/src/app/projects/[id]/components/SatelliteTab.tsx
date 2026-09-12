'use client';

import { Satellite, ShieldCheck } from 'lucide-react';
import SatelliteComparison from '@/components/satellite-comparison';
import { ProjectDetailData } from '@/hooks/use-projects';

interface SatelliteTabProps {
  project: ProjectDetailData;
}

export default function SatelliteTab({ project }: SatelliteTabProps) {
  return (
    <div className="space-y-6">
      {/* Policy alignment callout */}
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-cyan-300">
            2026 General Appropriations Mandate Alignment
          </h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            The General Appropriations Act directs the Philippine Space Agency (PhilSA) and public watchdogs
            to cross-reference infrastructure disbursements with satellite time-series imagery. This tool
            displays historical and present satellite captures from the ESRI World Imagery Wayback catalog
            at exact DPWH project coordinates ({project.gpsLat.toFixed(4)}, {project.gpsLng.toFixed(4)}).
          </p>
        </div>
      </div>

      {/* Dual Panel Split Comparison */}
      <SatelliteComparison
        lat={project.gpsLat}
        lng={project.gpsLng}
        startDate={project.startDate}
        completionDate={project.completionDate}
        projectName={project.name}
      />
    </div>
  );
}
