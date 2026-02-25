// Article state in the browse queue
export type ArticleState = 'unseen' | 'viewed' | 'saved' | 'skipped';

// Journal configuration
export interface JournalConfig {
  name: string;
  issn: string;
  issnElectronic?: string;
  publisher: string;
  enabled: boolean;
  color?: string;
}

// Article metadata from API
export interface Article {
  doi: string;
  title: string;
  authors: string[];
  journal: string;
  journalIssn: string;
  volume?: string;
  issue?: string;
  pages?: string;
  date: string;
  year: number;
  abstract?: string;
  keywords?: string[];
  url: string;
  openAccessUrl?: string;
  // State tracking
  state: ArticleState;
  fetchedAt: string;
  viewedAt?: string;
  savedAt?: string;
  savedPath?: string;
}

// Browse position state
export interface BrowsePosition {
  currentDoi: string | null;
  filterHash: string;
  scrollIndex: number;
}

// Filter configuration
export interface FilterConfig {
  dateRange: 'day' | 'week' | 'month' | '3months' | 'custom';
  customDateFrom?: string;
  customDateTo?: string;
  journals: string[]; // ISSNs
  keywords: string[];
  searchInAbstracts: boolean;
  showState: 'unseen' | 'all' | 'viewed' | 'saved' | 'skipped';
  sortBy: 'date-desc' | 'date-asc' | 'journal';
}

// Plugin settings
export interface JournalMonitorSettings {
  // Storage locations
  savedArticlesFolder: string;
  masterIndexPath: string;
  journalIndicesFolder: string;
  
  // Journal subscriptions
  journals: JournalConfig[];
  
  // Sync settings
  apiProvider: 'openalex' | 'crossref';
  autoFetchFrequency: 'startup' | 'daily' | 'weekly' | 'manual';
  fetchOnStartup: boolean;
  articlesPerFetch: number;
  lookbackDays: number;
  
  // API keys
  openAlexEmail?: string;
  crossRefEmail?: string;
  
  // Note templates
  includeAbstract: boolean;
  includeKeywords: boolean;
  includeBibtex: boolean;
  autoTagWithJournal: boolean;
  
  // Notifications
  notifyOnNewArticles: boolean;
  showBadgeCount: boolean;
  
  // Current filter state
  currentFilter: FilterConfig;
}

// Plugin data (persisted state)
export interface JournalMonitorData {
  version: string;
  lastFetch: string | null;
  articles: Record<string, Article>;
  browsePosition: BrowsePosition;
  statistics: {
    totalFetched: number;
    totalSaved: number;
    totalSkipped: number;
    byJournal: Record<string, {
      fetched: number;
      saved: number;
      skipped: number;
    }>;
  };
}

// OpenAlex API response types
export interface OpenAlexWork {
  id: string;
  doi?: string;
  title: string;
  display_name: string;
  publication_date: string;
  publication_year: number;
  primary_location?: {
    source?: {
      display_name: string;
      issn_l?: string;
      issn?: string[];
    };
  };
  authorships: Array<{
    author: {
      display_name: string;
    };
    author_position: string;
  }>;
  abstract_inverted_index?: Record<string, number[]>;
  keywords?: Array<{
    keyword: string;
  }>;
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  open_access?: {
    oa_url?: string;
  };
  concepts?: Array<{
    display_name: string;
    score: number;
  }>;
  topics?: Array<{
    display_name: string;
    score: number;
  }>;
}

export interface OpenAlexResponse {
  meta: {
    count: number;
    page: number;
    per_page: number;
  };
  results: OpenAlexWork[];
}

// CrossRef API response types
export interface CrossRefWork {
  DOI: string;
  title: string[];
  author?: Array<{
    given?: string;
    family?: string;
    name?: string;
  }>;
  'container-title'?: string[];
  published?: {
    'date-parts': number[][];
  };
  'published-print'?: {
    'date-parts': number[][];
  };
  'published-online'?: {
    'date-parts': number[][];
  };
  volume?: string;
  issue?: string;
  page?: string;
  abstract?: string;
  ISSN?: string[];
  subject?: string[];
}

export interface CrossRefResponse {
  status: string;
  'message-type': string;
  message: {
    'total-results': number;
    items: CrossRefWork[];
  };
}

// Default journals configuration
export const DEFAULT_JOURNALS: JournalConfig[] = [
  { name: 'Remote Sensing of Environment', issn: '0034-4257', issnElectronic: '1879-0704', publisher: 'Elsevier', enabled: true },
  { name: 'Global Change Biology', issn: '1354-1013', issnElectronic: '1365-2486', publisher: 'Wiley', enabled: true },
  { name: 'Nature Climate Change', issn: '1758-678X', issnElectronic: '1758-6798', publisher: 'Nature', enabled: true },
  { name: 'Nature Sustainability', issn: '2398-9629', issnElectronic: '2398-9629', publisher: 'Nature', enabled: true },
  { name: 'Biogeosciences', issn: '1726-4170', issnElectronic: '1726-4189', publisher: 'Copernicus', enabled: true },
  { name: 'Environmental Research Letters', issn: '1748-9326', issnElectronic: '1748-9326', publisher: 'IOP', enabled: false },
  { name: 'ISPRS J. Photogrammetry & Remote Sensing', issn: '0924-2716', issnElectronic: '1872-8235', publisher: 'Elsevier', enabled: true },
  { name: 'IEEE Trans. Geoscience & Remote Sensing', issn: '0196-2892', issnElectronic: '1558-0644', publisher: 'IEEE', enabled: false },
  { name: 'Int\'l J. Applied Earth Observation & Geoinformation', issn: '1569-8432', issnElectronic: '1872-826X', publisher: 'Elsevier', enabled: false },
  { name: 'Remote Sensing (MDPI)', issn: '2072-4292', issnElectronic: '2072-4292', publisher: 'MDPI', enabled: false },
  { name: 'Agricultural & Forest Meteorology', issn: '0168-1923', issnElectronic: '1873-2240', publisher: 'Elsevier', enabled: false },
  { name: 'Forest Ecology and Management', issn: '0378-1127', issnElectronic: '1872-7042', publisher: 'Elsevier', enabled: false },
];

// Default settings
export const DEFAULT_SETTINGS: JournalMonitorSettings = {
  savedArticlesFolder: 'Literature/Journal Articles',
  masterIndexPath: 'Literature/00-Journal-Index.md',
  journalIndicesFolder: 'Literature/Journals',
  journals: DEFAULT_JOURNALS,
  apiProvider: 'openalex',
  autoFetchFrequency: 'daily',
  fetchOnStartup: true,
  articlesPerFetch: 50,
  lookbackDays: 30,
  openAlexEmail: '',
  crossRefEmail: '',
  includeAbstract: true,
  includeKeywords: true,
  includeBibtex: true,
  autoTagWithJournal: true,
  notifyOnNewArticles: true,
  showBadgeCount: true,
  currentFilter: {
    dateRange: 'month',
    journals: [],
    keywords: [],
    searchInAbstracts: true,
    showState: 'unseen',
    sortBy: 'date-desc',
  },
};

// Default data
export const DEFAULT_DATA: JournalMonitorData = {
  version: '1.0.0',
  lastFetch: null,
  articles: {},
  browsePosition: {
    currentDoi: null,
    filterHash: '',
    scrollIndex: 0,
  },
  statistics: {
    totalFetched: 0,
    totalSaved: 0,
    totalSkipped: 0,
    byJournal: {},
  },
};
