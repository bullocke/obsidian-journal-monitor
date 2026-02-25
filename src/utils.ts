import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { Article, JournalMonitorSettings, FilterConfig } from './types';

/**
 * Generate a safe filename from article title
 */
export function generateFilename(article: Article): string {
  const firstAuthorRaw = article.authors[0]?.split(',')[0]?.split(' ').pop() || 'Unknown';
  const firstAuthor = firstAuthorRaw.replace(/[^\w\s-]/g, '');
  const year = String(article.year).replace(/[^\w\s-]/g, '');
  
  // Clean title for filename
  const titleWords = article.title
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  
  return `${firstAuthor}${year}-${titleWords}`.substring(0, 100);
}

/**
 * Generate markdown content for saved article
 */
export function generateArticleNote(article: Article, settings: JournalMonitorSettings): string {
  const frontmatter = generateFrontmatter(article, settings);
  const content = generateArticleContent(article, settings);
  
  return `---\n${frontmatter}---\n\n${content}`;
}

/**
 * Generate YAML frontmatter
 */
function generateFrontmatter(article: Article, settings: JournalMonitorSettings): string {
  const lines: string[] = [];
  
  lines.push(`title: "${escapeYaml(article.title)}"`);
  
  // Authors array
  lines.push('authors:');
  for (const author of article.authors) {
    lines.push(`  - "${escapeYaml(author)}"`);
  }
  
  lines.push(`journal: "${escapeYaml(article.journal)}"`);
  
  if (article.volume) lines.push(`volume: "${escapeYaml(article.volume)}"`);
  if (article.issue) lines.push(`issue: "${escapeYaml(article.issue)}"`);
  if (article.pages) lines.push(`pages: "${escapeYaml(article.pages)}"`);
  
  lines.push(`year: ${article.year}`);
  lines.push(`date: ${article.date}`);
  lines.push(`doi: "${escapeYaml(article.doi || '')}"`);
  lines.push(`url: "${escapeYaml(article.url || '')}"`);
  lines.push(`issn: "${escapeYaml(article.journalIssn || '')}"`);
  
  if (article.openAccessUrl) {
    lines.push(`open_access_url: "${escapeYaml(article.openAccessUrl)}"`);
  }
  
  if (settings.includeKeywords && article.keywords && article.keywords.length > 0) {
    lines.push('keywords:');
    for (const kw of article.keywords) {
      lines.push(`  - "${escapeYaml(kw)}"`);
    }
  }
  
  // Tags
  lines.push('tags:');
  lines.push('  - literature');
  lines.push('  - unread');
  if (settings.autoTagWithJournal) {
    const journalTag = article.journal
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    lines.push(`  - "journal/${journalTag}"`);
  }
  
  lines.push(`saved: ${new Date().toISOString().split('T')[0]}`);
  
  return lines.join('\n') + '\n';
}

/**
 * Generate article content body
 */
function generateArticleContent(article: Article, settings: JournalMonitorSettings): string {
  const lines: string[] = [];
  
  // Title
  lines.push(`# ${article.title}`);
  lines.push('');
  
  // Metadata
  lines.push(`**Authors:** ${article.authors.join(', ')}`);
  lines.push('');
  
  const citation = [article.journal];
  if (article.volume) citation.push(`Volume ${article.volume}`);
  if (article.issue) citation.push(`Issue ${article.issue}`);
  if (article.pages) citation.push(`Pages ${article.pages}`);
  lines.push(`**Journal:** ${citation.join(' | ')}`);
  lines.push('');
  
  lines.push(`**Published:** ${formatDate(article.date)}`);
  lines.push('');
  
  lines.push(`**DOI:** [${article.doi}](${article.url})`);
  
  if (article.openAccessUrl) {
    lines.push('');
    lines.push(`**Open Access:** [PDF](${article.openAccessUrl})`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Abstract
  if (settings.includeAbstract && article.abstract) {
    lines.push('## Abstract');
    lines.push('');
    lines.push(article.abstract);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  // Notes section
  lines.push('## Notes');
  lines.push('');
  lines.push('<!-- Your reading notes here -->');
  lines.push('');
  lines.push('');
  
  // BibTeX
  if (settings.includeBibtex) {
    lines.push('---');
    lines.push('');
    lines.push('## BibTeX');
    lines.push('');
    lines.push('```bibtex');
    lines.push(generateBibtex(article));
    lines.push('```');
  }
  
  return lines.join('\n');
}

/**
 * Generate BibTeX entry
 */
export function generateBibtex(article: Article): string {
  const firstAuthor = article.authors[0]?.split(',')[0]?.split(' ').pop()?.toLowerCase() || 'unknown';
  const titleWord = article.title.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  const key = `${firstAuthor}${article.year}${titleWord}`;
  
  const lines: string[] = [];
  lines.push(`@article{${key},`);
  lines.push(`  title={${article.title}},`);
  lines.push(`  author={${article.authors.join(' and ')}},`);
  lines.push(`  journal={${article.journal}},`);
  if (article.volume) lines.push(`  volume={${article.volume}},`);
  if (article.issue) lines.push(`  number={${article.issue}},`);
  if (article.pages) lines.push(`  pages={${article.pages.replace('-', '--')}},`);
  lines.push(`  year={${article.year}},`);
  lines.push(`  doi={${article.doi}}`);
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Escape YAML special characters
 */
function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Ensure folder exists, create if not
 */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath);
  const folder = app.vault.getAbstractFileByPath(normalizedPath);
  
  if (!folder) {
    await app.vault.createFolder(normalizedPath);
  }
}

/**
 * Save article as note
 */
export async function saveArticleNote(
  app: App,
  article: Article,
  settings: JournalMonitorSettings
): Promise<string> {
  const filename = generateFilename(article);
  const folderPath = normalizePath(settings.savedArticlesFolder);
  const filePath = normalizePath(`${folderPath}/${filename}.md`);
  
  // Ensure folder exists
  await ensureFolder(app, folderPath);
  
  // Generate content
  const content = generateArticleNote(article, settings);
  
  // Check if file exists
  const existingFile = app.vault.getAbstractFileByPath(filePath);
  if (existingFile instanceof TFile) {
    // File exists, could append or skip
    console.log(`Article note already exists: ${filePath}`);
    return filePath;
  }
  
  // Create file
  await app.vault.create(filePath, content);
  
  return filePath;
}

/**
 * Generate master index note content
 */
export function generateMasterIndex(
  articles: Article[],
  settings: JournalMonitorSettings
): string {
  const savedArticles = articles.filter(a => a.state === 'saved');
  const unreadCount = savedArticles.filter(a => a.savedAt && !a.viewedAt).length;
  
  const byJournal: Record<string, number> = {};
  const unreadByJournal: Record<string, number> = {};
  
  for (const article of savedArticles) {
    byJournal[article.journal] = (byJournal[article.journal] || 0) + 1;
    if (!article.viewedAt) {
      unreadByJournal[article.journal] = (unreadByJournal[article.journal] || 0) + 1;
    }
  }
  
  const lines: string[] = [];
  
  // Frontmatter
  lines.push('---');
  lines.push('title: Journal Article Index');
  lines.push('description: Master index of saved journal articles from Journal Monitor');
  lines.push(`updated: ${new Date().toISOString()}`);
  lines.push(`total_articles: ${savedArticles.length}`);
  lines.push('---');
  lines.push('');
  
  // Header
  lines.push('# 📚 Journal Article Index');
  lines.push('');
  lines.push(`> Last updated: ${formatDate(new Date().toISOString())}`);
  lines.push(`> Total saved articles: ${savedArticles.length}`);
  lines.push('');
  
  // Stats table
  lines.push('## Quick Stats');
  lines.push('');
  lines.push('| Journal | Saved | Unread |');
  lines.push('|---------|-------|--------|');
  
  for (const [journal, count] of Object.entries(byJournal).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${journal} | ${count} | ${unreadByJournal[journal] || 0} |`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Recent additions
  lines.push('## Recent Additions (Last 7 Days)');
  lines.push('');
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const recentArticles = savedArticles
    .filter(a => a.savedAt && new Date(a.savedAt) > weekAgo)
    .sort((a, b) => new Date(b.savedAt!).getTime() - new Date(a.savedAt!).getTime())
    .slice(0, 10);
  
  for (const article of recentArticles) {
    const filename = generateFilename(article);
    const shortTitle = article.title.length > 60 
      ? article.title.substring(0, 60) + '...' 
      : article.title;
    lines.push(`- [[${filename}|${shortTitle}]] - *${article.journal}* (${formatDate(article.date)})`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Dataview queries
  lines.push('## Unread Articles');
  lines.push('');
  lines.push('```dataview');
  lines.push('LIST');
  lines.push(`FROM "${settings.savedArticlesFolder}"`);
  lines.push('WHERE contains(tags, "unread")');
  lines.push('SORT saved DESC');
  lines.push('```');
  
  return lines.join('\n');
}

/**
 * Generate journal-specific index note content
 */
export function generateJournalIndex(
  journal: { name: string; issn: string; publisher: string },
  articles: Article[]
): string {
  const journalArticles = articles
    .filter(a => a.journalIssn === journal.issn && a.state === 'saved')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const lines: string[] = [];
  
  // Frontmatter
  lines.push('---');
  lines.push(`title: "${journal.name}"`);
  lines.push(`issn: "${journal.issn}"`);
  lines.push(`publisher: "${journal.publisher}"`);
  lines.push(`updated: ${new Date().toISOString()}`);
  lines.push('---');
  lines.push('');
  
  // Header
  lines.push(`# ${journal.name}`);
  lines.push('');
  lines.push(`> ISSN: ${journal.issn} | Publisher: ${journal.publisher}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Saved articles
  lines.push(`## Saved Articles (${journalArticles.length} total)`);
  lines.push('');
  
  if (journalArticles.length > 0) {
    for (const article of journalArticles.slice(0, 20)) {
      const filename = generateFilename(article);
      const shortTitle = article.title.length > 60 
        ? article.title.substring(0, 60) + '...' 
        : article.title;
      const firstAuthor = article.authors[0]?.split(',')[0] || 'Unknown';
      lines.push(`- [[${filename}|${shortTitle}]] - ${firstAuthor} (${article.date})`);
    }
    
    if (journalArticles.length > 20) {
      lines.push('');
      lines.push(`*... and ${journalArticles.length - 20} more*`);
    }
  } else {
    lines.push('*No saved articles yet*');
  }
  
  return lines.join('\n');
}

/**
 * Calculate hash of filter config for cache invalidation
 */
export function hashFilterConfig(filter: FilterConfig): string {
  const str = JSON.stringify({
    dateRange: filter.dateRange,
    customDateFrom: filter.customDateFrom,
    customDateTo: filter.customDateTo,
    journals: filter.journals.sort(),
    keywords: filter.keywords.sort(),
    showState: filter.showState,
    sortBy: filter.sortBy,
  });
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return hash.toString(36);
}

/**
 * Filter articles based on current filter config
 */
export function filterArticles(
  articles: Article[],
  filter: FilterConfig,
  allJournals: { issn: string }[]
): Article[] {
  let filtered = Object.values(articles);
  
  // Filter by state
  if (filter.showState !== 'all') {
    filtered = filtered.filter(a => a.state === filter.showState);
  }
  
  // Filter by journals
  const enabledIssns = filter.journals.length > 0 
    ? filter.journals 
    : allJournals.map(j => j.issn);
  
  filtered = filtered.filter(a => enabledIssns.includes(a.journalIssn));
  
  // Filter by keywords
  if (filter.keywords.length > 0) {
    const lowerKeywords = filter.keywords.map(k => k.toLowerCase());
    filtered = filtered.filter(a => {
      const searchText = filter.searchInAbstracts
        ? `${a.title} ${a.abstract || ''} ${(a.keywords || []).join(' ')}`.toLowerCase()
        : a.title.toLowerCase();
      
      return lowerKeywords.some(kw => searchText.includes(kw));
    });
  }
  
  // Sort
  switch (filter.sortBy) {
    case 'date-desc':
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      break;
    case 'date-asc':
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      break;
    case 'journal':
      filtered.sort((a, b) => a.journal.localeCompare(b.journal));
      break;
  }
  
  return filtered;
}

/**
 * Get relative time string
 */
export function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
