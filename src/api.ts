import { requestUrl } from 'obsidian';
import {
  Article,
  OpenAlexWork,
  OpenAlexResponse,
  CrossRefWork,
  CrossRefResponse,
  JournalConfig,
} from './types';

/**
 * Fetch abstract from CrossRef for a single DOI.
 * Used as fallback when OpenAlex doesn't have the abstract.
 */
async function fetchAbstractFromCrossRef(doi: string): Promise<string | undefined> {
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const work = response.json?.message;
    if (work?.abstract) {
      // CrossRef abstracts often contain HTML tags
      return work.abstract.replace(/<[^>]*>/g, '').trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Backfill missing abstracts from CrossRef for a batch of articles.
 * Only queries CrossRef for articles that are missing abstracts.
 */
export async function backfillAbstracts(articles: Article[]): Promise<number> {
  const missing = articles.filter(a => !a.abstract);
  if (missing.length === 0) return 0;
  
  let filled = 0;
  // Process in small batches to avoid rate limiting
  for (const article of missing) {
    const abstract = await fetchAbstractFromCrossRef(article.doi);
    if (abstract) {
      article.abstract = abstract;
      filled++;
    }
    // Small delay between requests to be polite to CrossRef
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return filled;
}

/**
 * Reconstruct abstract from OpenAlex inverted index format
 */
function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string | undefined {
  if (!invertedIndex) return undefined;
  
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  
  words.sort((a, b) => a[1] - b[1]);
  return words.map(w => w[0]).join(' ');
}

/**
 * Format author name from OpenAlex
 */
function formatOpenAlexAuthors(authorships: OpenAlexWork['authorships']): string[] {
  return authorships
    .sort((a, b) => {
      const order = { first: 0, middle: 1, last: 2 };
      return (order[a.author_position as keyof typeof order] || 1) - 
             (order[b.author_position as keyof typeof order] || 1);
    })
    .map(a => a.author.display_name);
}

/**
 * Format author name from CrossRef
 */
function formatCrossRefAuthors(authors: CrossRefWork['author']): string[] {
  if (!authors) return [];
  return authors.map(a => {
    if (a.name) return a.name;
    if (a.family && a.given) return `${a.family}, ${a.given}`;
    return a.family || a.given || 'Unknown';
  });
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string | undefined, dateParts: number[][] | undefined): string {
  if (dateStr) {
    return dateStr.split('T')[0];
  }
  if (dateParts && dateParts[0]) {
    const parts = dateParts[0];
    const year = parts[0];
    const month = parts[1] ? String(parts[1]).padStart(2, '0') : '01';
    const day = parts[2] ? String(parts[2]).padStart(2, '0') : '01';
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Convert OpenAlex work to Article
 */
function openAlexToArticle(work: OpenAlexWork, journalName: string, journalIssn: string): Article | null {
  if (!work.doi) return null;
  
  const doi = work.doi.replace('https://doi.org/', '');
  
  // Extract keywords from concepts/topics (much more reliable than keywords field)
  const keywords = work.concepts
    ?.filter(c => c.score > 0.3)
    ?.slice(0, 8)
    ?.map(c => c.display_name)
    || work.topics
      ?.filter(t => t.score > 0.3)
      ?.slice(0, 8)
      ?.map(t => t.display_name)
    || work.keywords?.map(k => k.keyword)
    || [];
  
  return {
    doi,
    title: work.display_name || work.title || 'Untitled',
    authors: formatOpenAlexAuthors(work.authorships || []),
    journal: journalName,
    journalIssn,
    volume: work.biblio?.volume,
    issue: work.biblio?.issue,
    pages: work.biblio?.first_page && work.biblio?.last_page 
      ? `${work.biblio.first_page}-${work.biblio.last_page}`
      : work.biblio?.first_page,
    date: work.publication_date || new Date().toISOString().split('T')[0],
    year: work.publication_year || new Date().getFullYear(),
    abstract: reconstructAbstract(work.abstract_inverted_index),
    keywords,
    url: `https://doi.org/${doi}`,
    openAccessUrl: work.open_access?.oa_url,
    state: 'unseen',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Convert CrossRef work to Article
 */
function crossRefToArticle(work: CrossRefWork, journalName: string, journalIssn: string): Article | null {
  const doi = work.DOI;
  if (!doi) return null;
  
  const dateParts = work.published?.['date-parts'] || 
                    work['published-online']?.['date-parts'] || 
                    work['published-print']?.['date-parts'];
  const date = parseDate(undefined, dateParts);
  const year = dateParts?.[0]?.[0] || new Date().getFullYear();
  
  return {
    doi,
    title: work.title?.[0] || 'Untitled',
    authors: formatCrossRefAuthors(work.author),
    journal: journalName,
    journalIssn,
    volume: work.volume,
    issue: work.issue,
    pages: work.page,
    date,
    year,
    abstract: work.abstract?.replace(/<[^>]*>/g, ''), // Strip HTML
    keywords: work.subject,
    url: `https://doi.org/${doi}`,
    state: 'unseen',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch articles from OpenAlex API
 */
export async function fetchFromOpenAlex(
  journal: JournalConfig,
  fromDate: string,
  toDate: string,
  perPage: number = 50,
  email?: string
): Promise<Article[]> {
  const issn = journal.issnElectronic || journal.issn;
  
  // Build filter
  const filters = [
    `primary_location.source.issn:${issn}`,
    `publication_date:>${fromDate}`,
    `publication_date:<${toDate}`,
  ];
  
  const params = new URLSearchParams({
    filter: filters.join(','),
    sort: 'publication_date:desc',
    'per-page': String(perPage),
  });
  
  if (email) {
    params.set('mailto', email);
  }
  
  const url = `https://api.openalex.org/works?${params.toString()}`;
  
  try {
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const data = response.json as OpenAlexResponse;
    
    return data.results
      .map(work => openAlexToArticle(work, journal.name, journal.issn))
      .filter((a): a is Article => a !== null);
  } catch (error) {
    console.error(`OpenAlex fetch error for ${journal.name}:`, error);
    return [];
  }
}

/**
 * Fetch articles from CrossRef API
 */
export async function fetchFromCrossRef(
  journal: JournalConfig,
  fromDate: string,
  toDate: string,
  rows: number = 50,
  email?: string
): Promise<Article[]> {
  const issn = journal.issnElectronic || journal.issn;
  
  const params = new URLSearchParams({
    'filter': `from-pub-date:${fromDate},until-pub-date:${toDate}`,
    'sort': 'published',
    'order': 'desc',
    'rows': String(rows),
  });
  
  if (email) {
    params.set('mailto', email);
  }
  
  const url = `https://api.crossref.org/journals/${issn}/works?${params.toString()}`;
  
  try {
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const data = response.json as CrossRefResponse;
    
    return data.message.items
      .map(work => crossRefToArticle(work, journal.name, journal.issn))
      .filter((a): a is Article => a !== null);
  } catch (error) {
    console.error(`CrossRef fetch error for ${journal.name}:`, error);
    return [];
  }
}

/**
 * Search OpenAlex for articles by keyword
 */
export async function searchOpenAlex(
  query: string,
  issns: string[],
  fromDate: string,
  toDate: string,
  perPage: number = 25,
  email?: string
): Promise<Article[]> {
  const filters = [
    `publication_date:>${fromDate}`,
    `publication_date:<${toDate}`,
  ];
  
  if (issns.length > 0) {
    filters.push(`primary_location.source.issn:${issns.join('|')}`);
  }
  
  const params = new URLSearchParams({
    search: query,
    filter: filters.join(','),
    sort: 'publication_date:desc',
    'per-page': String(perPage),
  });
  
  if (email) {
    params.set('mailto', email);
  }
  
  const url = `https://api.openalex.org/works?${params.toString()}`;
  
  try {
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const data = response.json as OpenAlexResponse;
    
    return data.results
      .map(work => {
        const journalName = work.primary_location?.source?.display_name || 'Unknown Journal';
        const journalIssn = work.primary_location?.source?.issn_l || 
                           work.primary_location?.source?.issn?.[0] || '';
        return openAlexToArticle(work, journalName, journalIssn);
      })
      .filter((a): a is Article => a !== null);
  } catch (error) {
    console.error('OpenAlex search error:', error);
    return [];
  }
}

/**
 * Lookup journal info by ISSN
 */
export async function lookupJournalByIssn(issn: string): Promise<JournalConfig | null> {
  const url = `https://api.openalex.org/sources/issn:${issn}`;
  
  try {
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const data = response.json;
    
    if (data && data.display_name) {
      return {
        name: data.display_name,
        issn: data.issn_l || issn,
        issnElectronic: data.issn?.[0],
        publisher: data.host_organization_name || 'Unknown',
        enabled: true,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Journal lookup error:', error);
    return null;
  }
}

/**
 * Calculate date range based on filter
 */
export function getDateRange(range: string, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  
  let from: string;
  
  switch (range) {
    case 'day':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      from = yesterday.toISOString().split('T')[0];
      break;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      from = weekAgo.toISOString().split('T')[0];
      break;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      from = monthAgo.toISOString().split('T')[0];
      break;
    case '3months':
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      from = threeMonthsAgo.toISOString().split('T')[0];
      break;
    case 'custom':
      from = customFrom || to;
      return { from, to: customTo || to };
    default:
      const defaultAgo = new Date(now);
      defaultAgo.setMonth(defaultAgo.getMonth() - 1);
      from = defaultAgo.toISOString().split('T')[0];
  }
  
  return { from, to };
}
