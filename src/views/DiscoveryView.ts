import { App, Modal, Notice, setIcon, Setting } from 'obsidian';
import { Article, JournalMonitorSettings, JournalMonitorData } from '../types';
import { searchOpenAlex, getDateRange } from '../api';
import { saveArticleNote, formatDate } from '../utils';

export class DiscoveryView extends Modal {
  private settings: JournalMonitorSettings;
  private data: JournalMonitorData;
  private onDataChange: () => void;
  
  private searchQuery: string = '';
  private dateFrom: string;
  private dateTo: string;
  private useAllJournals: boolean = true;
  private selectedJournals: string[] = [];
  private results: Article[] = [];
  private isLoading: boolean = false;
  
  private resultsContainer: HTMLElement | null = null;
  
  constructor(
    app: App,
    settings: JournalMonitorSettings,
    data: JournalMonitorData,
    onDataChange: () => void
  ) {
    super(app);
    this.settings = settings;
    this.data = data;
    this.onDataChange = onDataChange;
    
    // Default date range: last year
    const now = new Date();
    this.dateTo = now.toISOString().split('T')[0];
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    this.dateFrom = yearAgo.toISOString().split('T')[0];
    
    // Default to all enabled journals
    this.selectedJournals = settings.journals
      .filter(j => j.enabled)
      .map(j => j.issn);
  }
  
  onOpen() {
    const { contentEl } = this;
    
    contentEl.addClass('journal-monitor-discovery');
    contentEl.empty();
    
    // Header
    const header = contentEl.createDiv({ cls: 'jm-discovery-header' });
    
    const backBtn = header.createEl('button', { cls: 'jm-header-btn' });
    setIcon(backBtn, 'arrow-left');
    backBtn.addEventListener('click', () => this.close());
    
    header.createEl('span', { text: 'Discovery Search', cls: 'jm-header-title' });
    
    // Search form
    const form = contentEl.createDiv({ cls: 'jm-discovery-form' });
    
    // Search input
    const searchSection = form.createDiv({ cls: 'jm-form-section' });
    searchSection.createEl('label', { text: '🔍 Search Articles', cls: 'jm-form-label' });
    
    const searchInput = searchSection.createEl('input', {
      type: 'text',
      placeholder: 'Enter keywords (e.g., NISAR forest biomass L-band)',
      cls: 'jm-search-input'
    });
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
    });
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });
    
    // Date range
    const dateSection = form.createDiv({ cls: 'jm-form-section jm-form-row' });
    
    const dateFromDiv = dateSection.createDiv({ cls: 'jm-form-col' });
    dateFromDiv.createEl('label', { text: '📅 From', cls: 'jm-form-label' });
    const dateFromInput = dateFromDiv.createEl('input', {
      type: 'date',
      cls: 'jm-date-input'
    });
    dateFromInput.value = this.dateFrom;
    dateFromInput.addEventListener('change', (e) => {
      this.dateFrom = (e.target as HTMLInputElement).value;
    });
    
    const dateToDiv = dateSection.createDiv({ cls: 'jm-form-col' });
    dateToDiv.createEl('label', { text: '📅 To', cls: 'jm-form-label' });
    const dateToInput = dateToDiv.createEl('input', {
      type: 'date',
      cls: 'jm-date-input'
    });
    dateToInput.value = this.dateTo;
    dateToInput.addEventListener('change', (e) => {
      this.dateTo = (e.target as HTMLInputElement).value;
    });
    
    // Journals
    const journalSection = form.createDiv({ cls: 'jm-form-section' });
    journalSection.createEl('label', { text: '📚 Journals', cls: 'jm-form-label' });
    
    const journalOptions = journalSection.createDiv({ cls: 'jm-journal-options' });
    
    const allJournalsLabel = journalOptions.createEl('label', { cls: 'jm-radio-label' });
    const allJournalsInput = allJournalsLabel.createEl('input', { type: 'radio' });
    allJournalsInput.name = 'journal-scope';
    allJournalsInput.checked = this.useAllJournals;
    allJournalsInput.addEventListener('change', () => {
      this.useAllJournals = true;
    });
    allJournalsLabel.appendText(' All subscribed journals');
    
    const specificJournalsLabel = journalOptions.createEl('label', { cls: 'jm-radio-label' });
    const specificJournalsInput = specificJournalsLabel.createEl('input', { type: 'radio' });
    specificJournalsInput.name = 'journal-scope';
    specificJournalsInput.checked = !this.useAllJournals;
    specificJournalsInput.addEventListener('change', () => {
      this.useAllJournals = false;
    });
    specificJournalsLabel.appendText(' Select specific...');
    
    // Journal checkboxes (collapsed by default)
    const journalList = journalSection.createDiv({ cls: 'jm-journal-list' });
    if (!this.useAllJournals) {
      journalList.addClass('jm-journal-list-visible');
    }
    
    for (const journal of this.settings.journals.filter(j => j.enabled)) {
      const label = journalList.createEl('label', { cls: 'jm-checkbox-label' });
      const checkbox = label.createEl('input', { type: 'checkbox' });
      checkbox.checked = this.selectedJournals.includes(journal.issn);
      checkbox.addEventListener('change', (e) => {
        if ((e.target as HTMLInputElement).checked) {
          this.selectedJournals.push(journal.issn);
        } else {
          this.selectedJournals = this.selectedJournals.filter(i => i !== journal.issn);
        }
      });
      label.appendText(` ${journal.name}`);
    }
    
    specificJournalsInput.addEventListener('change', () => {
      journalList.toggleClass('jm-journal-list-visible', !this.useAllJournals);
    });
    
    // Search button
    const searchBtn = form.createEl('button', { 
      text: '🔍 Search (via OpenAlex)', 
      cls: 'jm-search-btn' 
    });
    searchBtn.addEventListener('click', () => this.performSearch());
    
    // Results section
    const resultsSection = contentEl.createDiv({ cls: 'jm-discovery-results' });
    this.resultsContainer = resultsSection;
    
    resultsSection.createEl('p', { 
      text: 'Enter keywords and click Search to find articles.',
      cls: 'jm-results-placeholder'
    });
  }
  
  private async performSearch() {
    if (!this.searchQuery.trim()) {
      new Notice('Please enter search keywords');
      return;
    }
    
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    // Show loading
    if (this.resultsContainer) {
      this.resultsContainer.empty();
      const loading = this.resultsContainer.createDiv({ cls: 'jm-results-loading' });
      loading.createEl('span', { text: '⏳ Searching...' });
    }
    
    try {
      const issns = this.useAllJournals
        ? this.settings.journals.filter(j => j.enabled).map(j => j.issn)
        : this.selectedJournals;
      
      this.results = await searchOpenAlex(
        this.searchQuery,
        issns,
        this.dateFrom,
        this.dateTo,
        50,
        this.settings.openAlexEmail
      );
      
      this.renderResults();
      
    } catch (error) {
      console.error('Search error:', error);
      new Notice('Search failed. Please try again.');
      
      if (this.resultsContainer) {
        this.resultsContainer.empty();
        this.resultsContainer.createEl('p', { 
          text: 'Search failed. Please try again.',
          cls: 'jm-results-error'
        });
      }
    }
    
    this.isLoading = false;
  }
  
  private renderResults() {
    if (!this.resultsContainer) return;
    
    this.resultsContainer.empty();
    
    if (this.results.length === 0) {
      this.resultsContainer.createEl('p', { 
        text: 'No results found. Try different keywords or date range.',
        cls: 'jm-results-empty'
      });
      return;
    }
    
    // Results header
    const header = this.resultsContainer.createDiv({ cls: 'jm-results-header' });
    header.createEl('span', { text: `Found ${this.results.length} results` });
    
    // Results list
    const list = this.resultsContainer.createDiv({ cls: 'jm-results-list' });
    
    for (const article of this.results) {
      const item = list.createDiv({ cls: 'jm-result-item' });
      
      // Check if already saved
      const existingArticle = this.data.articles[article.doi];
      const isSaved = existingArticle?.state === 'saved';
      
      if (isSaved) {
        item.addClass('jm-result-saved');
      }
      
      // Title
      const title = item.createEl('h4', { 
        text: article.title, 
        cls: 'jm-result-title' 
      });
      title.addEventListener('click', () => {
        window.open(article.url, '_blank');
      });
      
      // Meta line
      const meta = item.createDiv({ cls: 'jm-result-meta' });
      
      const authors = article.authors.length > 2
        ? `${article.authors[0]} et al.`
        : article.authors.join(', ');
      meta.createEl('span', { text: authors, cls: 'jm-result-authors' });
      meta.createEl('span', { text: ' • ' });
      meta.createEl('span', { text: article.journal, cls: 'jm-result-journal' });
      meta.createEl('span', { text: ' • ' });
      meta.createEl('span', { text: formatDate(article.date), cls: 'jm-result-date' });
      
      // Actions
      const actions = item.createDiv({ cls: 'jm-result-actions' });
      
      if (isSaved) {
        actions.createEl('span', { text: '★ Saved', cls: 'jm-result-saved-badge' });
      } else {
        const saveBtn = actions.createEl('button', { text: 'Save', cls: 'jm-result-btn' });
        saveBtn.addEventListener('click', async () => {
          await this.saveResult(article, item);
        });
      }
      
      const openBtn = actions.createEl('button', { text: 'Open', cls: 'jm-result-btn' });
      openBtn.addEventListener('click', () => {
        window.open(article.url, '_blank');
      });
    }
  }
  
  private async saveResult(article: Article, itemEl: HTMLElement) {
    try {
      const path = await saveArticleNote(this.app, article, this.settings);
      
      article.state = 'saved';
      article.savedAt = new Date().toISOString();
      article.savedPath = path;
      this.data.articles[article.doi] = article;
      this.data.statistics.totalSaved++;
      
      this.onDataChange();
      
      // Update UI
      itemEl.addClass('jm-result-saved');
      const actions = itemEl.querySelector('.jm-result-actions');
      if (actions) {
        actions.empty();
        actions.createEl('span', { text: '★ Saved', cls: 'jm-result-saved-badge' });
        
        const openBtn = actions.createEl('button', { text: 'Open', cls: 'jm-result-btn' });
        openBtn.addEventListener('click', () => {
          window.open(article.url, '_blank');
        });
      }
      
      new Notice(`Saved: ${article.title.substring(0, 50)}...`);
      
    } catch (error) {
      console.error('Error saving article:', error);
      new Notice('Error saving article');
    }
  }
  
  onClose() {
    this.contentEl.empty();
  }
}
