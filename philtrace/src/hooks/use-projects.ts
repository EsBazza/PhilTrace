import { useQuery } from '@tanstack/react-query';

interface ProjectsParams {
  region?: string;
  status?: string;
  category?: string;
  flag?: string;
  province?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
  q?: string;
  search?: string;
}

interface ProjectListResponse {
  projects: ProjectWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ProjectWithRelations {
  id: string;
  name: string;
  provinceId: string;
  province: {
    id: string;
    name: string;
    region: { id: string; name: string };
  };
  gpsLat: number;
  gpsLng: number;
  budgetPHP: number;
  amountPaid: number;
  progress: number;
  startDate: string;
  completionDate: string | null;
  status: string;
  category: string;
  contractorRaw: string;
  sourceOfFunds: string | null;
  programName: string | null;
  infraYear: string | null;
  isLive: boolean;
  livestreamUrl: string | null;
  hasSatelliteImage: boolean;
  reportCount: number;
  flagStalled: boolean;
  flagNeverStarted: boolean;
  flagOverdue: boolean;
  flagPaymentPending: boolean;
  flagOverpaid: boolean;
  lastActivityAt: string | null;
  aiSummary: string | null;
  updatedAt: string;
}

export interface ContractorGraphNode {
  data: {
    id: string;
    label: string;
    totalValue: number;
    totalContracts: number;
    avgProgress: number;
    overdueCount: number;
    terminatedCount: number;
  };
}

export interface ContractorGraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    weight: number;
  };
}

export interface ContractorGraphResponse {
  nodes: ContractorGraphNode[];
  edges: ContractorGraphEdge[];
}

export type { ProjectWithRelations, ProjectListResponse };

export function useProjects(params: ProjectsParams) {
  const searchParams = new URLSearchParams();
  if (params.region) searchParams.set('region', params.region);
  if (params.status) searchParams.set('status', params.status);
  if (params.category) searchParams.set('category', params.category);
  if (params.flag) searchParams.set('flag', params.flag);
  if (params.province) searchParams.set('province', params.province);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.order) searchParams.set('order', params.order);
  if (params.q) searchParams.set('q', params.q);
  if (params.search) searchParams.set('search', params.search);

  return useQuery<ProjectListResponse>({
    queryKey: ['projects', params],
    queryFn: async () => {
      const res = await fetch(`/api/projects?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
  });
}

export function useProject(id: string) {
  return useQuery<ProjectWithRelations & {
    comments: Array<{
      id: string;
      text: string;
      severity: string;
      rationale: string;
      corroborationCount: number;
      photoUrl: string | null;
      createdAt: string;
    }>;
    agencyUpdates: Array<{
      id: string;
      agencyName: string;
      percentDone: number;
      note: string;
      photoUrl: string | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
    enabled: !!id,
  });
}

export interface ContractorItem {
  id: string;
  name: string;
  totalContracts: number;
  totalValuePHP: number;
  avgProgress: number;
  overdueCount: number;
  terminatedCount: number;
}

export interface ContractorListResponse {
  contractors: ContractorItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContractorsParams {
  q?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
}

export function useContractors(params: ContractorsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.order) searchParams.set('order', params.order);

  return useQuery<ContractorListResponse>({
    queryKey: ['contractors', params],
    queryFn: async () => {
      const res = await fetch(`/api/contractors?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch contractors');
      return res.json();
    },
  });
}

export function useNearbyProjects(lat: number | null, lng: number | null, radius = 5) {
  return useQuery<{ projects: Array<ProjectWithRelations & { distance: number }> }>({
    queryKey: ['nearby', lat, lng, radius],
    queryFn: async () => {
      const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
      if (!res.ok) throw new Error('Failed to fetch nearby projects');
      return res.json();
    },
    enabled: lat !== null && lng !== null,
  });
}

export function useContractorGraph() {
  return useQuery<ContractorGraphResponse>({
    queryKey: ['contractors', 'graph'],
    queryFn: async () => {
      const res = await fetch('/api/contractors/graph');
      if (!res.ok) throw new Error('Failed to fetch contractor graph');
      return res.json();
    },
  });
}

