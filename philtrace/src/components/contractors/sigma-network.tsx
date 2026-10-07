'use client';

import { useEffect, useMemo, useState } from 'react';
import { SigmaContainer, ControlsContainer, ZoomControl, FullScreenControl, useSigma, useRegisterEvents, useSetSettings } from '@react-sigma/core';
import '@react-sigma/core/lib/react-sigma.min.css';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

interface SigmaNetworkProps {
  graphData: any;
  onProjectClick: (id: string) => void;
  onContractorClick: (data: any) => void;
}

const GraphEvents = ({ onProjectClick, onContractorClick, setHoveredNode }: any) => {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const setSettings = useSetSettings();

  useEffect(() => {
    registerEvents({
      clickNode: (e: any) => {
        const nodeId = e.node;
        const type = sigma.getGraph().getNodeAttribute(nodeId, 'nodeType');
        
        if (type === 'project') {
          onProjectClick(nodeId);
        } else if (type === 'contractor') {
          const label = sigma.getGraph().getNodeAttribute(nodeId, 'label');
          const totalValue = sigma.getGraph().getNodeAttribute(nodeId, 'totalValue');
          const totalContracts = sigma.getGraph().getNodeAttribute(nodeId, 'totalContracts');
          const overdueCount = sigma.getGraph().getNodeAttribute(nodeId, 'overdueCount');
          const terminatedCount = sigma.getGraph().getNodeAttribute(nodeId, 'terminatedCount');
          onContractorClick({ id: nodeId, label, totalValue, totalContracts, overdueCount, terminatedCount });
        }
      },
      enterNode: (e: any) => {
        setHoveredNode(e.node);
      },
      leaveNode: () => {
        setHoveredNode(null);
      },
    });
  }, [registerEvents, sigma, onProjectClick, onContractorClick, setHoveredNode]);

  return null;
};

const GraphEffect = ({ hoveredNode }: { hoveredNode: string | null }) => {
  const sigma = useSigma();
  const setSettings = useSetSettings();

  useEffect(() => {
    const graph = sigma.getGraph();
    if (hoveredNode) {
      const neighbors = new Set(graph.neighbors(hoveredNode));
      neighbors.add(hoveredNode);
      
      setSettings({
        nodeReducer: (node: string, data: any) => {
          const res = { ...data };
          if (!neighbors.has(node)) {
            res.label = "";
            res.color = "#f6f6f6";
          }
          return res;
        },
        edgeReducer: (edge: string, data: any) => {
          const res = { ...data };
          if (graph.hasExtremity(edge, hoveredNode)) {
            res.color = "#ffb241";
            res.size = 3;
          } else {
            res.color = "#f6f6f6";
            res.hidden = true;
          }
          return res;
        }
      });
    } else {
      setSettings({
        nodeReducer: null,
        edgeReducer: null,
      });
    }
  }, [hoveredNode, sigma, setSettings]);

  return null;
};

export default function SigmaNetwork({ graphData, onProjectClick, onContractorClick }: SigmaNetworkProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const graph = useMemo(() => {
    const g = new Graph() as any;
    if (!graphData || !graphData.nodes) return g;
    
    graphData.nodes.forEach((n: any) => {
      if (!g.hasNode(n.id)) {
        g.addNode(n.id, {
          ...n,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: n.size || 5,
          color: n.color || '#ccc',
          label: n.label,
        });
      }
    });

    graphData.edges?.forEach((e: any) => {
      if (g.hasNode(e.source) && g.hasNode(e.target)) {
        if (!g.hasEdge(e.source, e.target)) {
          g.addEdge(e.source, e.target, { size: e.weight || 1, color: '#e2e8f0' });
        }
      }
    });

    try {
      forceAtlas2.assign(g, { iterations: 100, settings: { gravity: 1, scalingRatio: 5, edgeWeightInfluence: 1 } });
    } catch (e) {
      console.error(e);
    }
    
    return g;
  }, [graphData]);

  if (!graphData || !graphData.nodes) return null;

  return (
    <SigmaContainer style={{ height: '100%', width: '100%' }} graph={graph} settings={{
      defaultNodeType: 'circle', // Fallback to circle
      labelFont: 'Inter, sans-serif',
      labelWeight: 'bold',
    }}>
      <GraphEvents onProjectClick={onProjectClick} onContractorClick={onContractorClick} setHoveredNode={setHoveredNode} />
      <GraphEffect hoveredNode={hoveredNode} />
      <ControlsContainer position="bottom-right">
        <ZoomControl />
        <FullScreenControl />
      </ControlsContainer>
    </SigmaContainer>
  );
}
