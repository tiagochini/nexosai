export interface Asset {
  id: string;
  name: string;
  assetType: string;
  status: string;
  uri: string;
  mimeType: string;
  durationMs: number;
}

export interface Track {
  id: string;
  trackType: string;
  name: string;
  position: number;
  settings?: any;
}

export interface TimelineItem {
  id: string;
  trackId: string;
  assetId: string;
  position: number;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  settings?: any;
}

export interface TimelineData {
  tracks: Track[];
  items: TimelineItem[];
}

export interface RenderJob {
  id: string;
  status: string;
  isTrailer?: boolean;
  durationSeconds?: number;
  outputUri?: string;
  errorMessage?: string;
  createdAt?: string;
}

export interface ProjectManifest {
  specification?: {
    council?: {
      version?: string;
      status?: string;
      rounds?: {
        [key: string]: {
          proposals?: { author: string; content: string }[];
          directorDraft?: string;
          critiques?: { author: string; target: string; content: string }[];
          directorSynthesis?: string;
        };
      };
      errors?: string[];
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ProjectDetail {
  project: any;
  manifest?: ProjectManifest;
  assets: Asset[];
  timeline: TimelineData;
  revisions?: any[];
  renders?: RenderJob[];
  qcReports?: any[];
  qcIssues?: any[];
  corrections?: any[];
}
