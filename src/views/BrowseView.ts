import { App, Modal, Notice, setIcon } from 'obsidian';
import { Article, FilterConfig, JournalMonitorSettings, JournalMonitorData } from '../types';
import { filterArticles, formatDate, getRelativeTime, saveArticleNote } from '../utils';

export class BrowseView extends Modal {
  private settings: JournalMonitorSettings;
  private data: JournalMonitorData;
  private articles: Article[];
  private currentIndex: number;
  private onDataChange: () => void;
  private onOpenFilter: () => void;
  
  private cardEl: HTMLElement | null = null;
  
  constructor(
    app: App,
    settings: JournalMonitorSettings,
    data: JournalMonitorData,
    onDataChange: () => void,
    onOpenFilter: () => void
  ) {
    super(app);
    this.settings = settings;
    this.data = data;
    this.onDataChange = onDataChange;
    this.onOpenFilter = onOpenFilter;
    
    // Get filtered articles
    this.articles = filterArticles(
      Object.values(data.articles),
      settings.currentFilter,
      settings.journals.filter(j => j.enabled)
    );
    
    // Restore position or start at 0
    this.currentIndex = data.browsePosition.scrollIndex;
    if (this.currentIndex >= this.articles.length) {
      this.currentIndex = 0;
    }
  }
  
  onOpen() {
    const { contentEl } = this;
    this.contentEl = contentEl;
    
    contentEl.addClass('journal-monitor-browse');
    contentEl.empty();
    
    // Header
    const header = contentEl.createDiv({ cls: 'jm-browse-header' });
    
    const backBtn = header.createEl('button', { cls: 'jm-header-btn' });
    setIcon(backBtn, 'arrow-left');
    backBtn.addEventListener('click', () => this.close());
    
    header.createEl('span', { text: 'Journal Monitor', cls: 'jm-header-title' });
    
    const filterBtn = header.createEl('button', { cls: 'jm-header-btn' });
    setIcon(filterBtn, 'filter');
    filterBtn.addEventListener('click', () => {
      this.close();
      this.onOpenFilter();
    });
    
    // Main content area
    const main = contentEl.createDiv({ cls: 'jm-browse-main' });
    
    // Navigation hint (top)
    const navHintTop = main.createDiv({ cls: 'jm-nav-hint jm-nav-hint-top' });
    navHintTop.createEl('span', { text: '▲ Previous Article (↑ or k)' });
    
    // Article card container
    const cardContainer = main.createDiv({ cls: 'jm-card-container' });
    this.renderCard(cardContainer);
    
    // Navigation hint (bottom)
    const navHintBottom = main.createDiv({ cls: 'jm-nav-hint jm-nav-hint-bottom' });
    navHintBottom.createEl('span', { text: '▼ Next Article (↓ or j)' });
    
    // Action bar
    const actionBar = contentEl.createDiv({ cls: 'jm-action-bar' });
    
    // Skip button
    const skipBtn = actionBar.createEl('button', { cls: 'jm-action-btn jm-action-skip' });
    setIcon(skipBtn, 'x');
    skipBtn.createEl('span', { text: 'Skip' });
    skipBtn.addEventListener('click', () => this.skipArticle());
    
    // Save button
    const saveBtn = actionBar.createEl('button', { cls: 'jm-action-btn jm-action-save' });
    setIcon(saveBtn, 'star');
    saveBtn.createEl('span', { text: 'Save' });
    saveBtn.addEventListener('click', () => this.saveArticle());
    
    // Open button
    const openBtn = actionBar.createEl('button', { cls: 'jm-action-btn jm-action-open' });
    setIcon(openBtn, 'external-link');
    openBtn.createEl('span', { text: 'Open' });
    openBtn.addEventListener('click', () => this.openArticle());
    
    // Counter
    const counter = actionBar.createDiv({ cls: 'jm-counter' });
    counter.createEl('span', { 
      text: `Article ${this.currentIndex + 1}/${this.articles.length}`,
      cls: 'jm-counter-text'
    });
    
    // Register keyboard handlers
    this.scope.register([], 'ArrowDown', () => { this.nextArticle(); return false; });
    this.scope.register([], 'ArrowUp', () => { this.prevArticle(); return false; });
    this.scope.register([], 'j', () => { this.nextArticle(); return false; });
    this.scope.register([], 'k', () => { this.prevArticle(); return false; });
    this.scope.register([], 's', () => { this.saveArticle(); return false; });
    this.scope.register([], 'x', () => { this.skipArticle(); return false; });
    this.scope.register([], 'Enter', () => { this.openArticle(); return false; });
    this.scope.register([], 'f', () => { this.close(); this.onOpenFilter(); return false; });
    
    // Touch/swipe handling
    this.setupTouchHandlers(cardContainer);
    
    // Mark current as viewed
    this.markViewed();
  }
  
  private renderCard(container: HTMLElement) {
    container.empty();
    
    if (this.articles.length === 0) {
      const emptyCard = container.createDiv({ cls: 'jm-card jm-card-empty' });
      emptyCard.createEl('h3', { text: 'No Articles' });
      emptyCard.createEl('p', { text: 'No articles match your current filters. Try adjusting your filter settings or fetching new articles.' });
      return;
    }
    
    const article = this.articles[this.currentIndex];
    if (!article) return;
    
    const card = container.createDiv({ cls: 'jm-card' });
    this.cardEl = card;
    
    // Journal and date header
    const cardHeader = card.createDiv({ cls: 'jm-card-header' });
    cardHeader.createEl('span', { text: article.journal.toUpperCase(), cls: 'jm-card-journal' });
    const dateText = article.date 
      ? `${formatDate(article.date)} (${getRelativeTime(article.date)})`
      : getRelativeTime(article.date);
    cardHeader.createEl('span', { text: dateText, cls: 'jm-card-date' });
    
    card.createEl('hr', { cls: 'jm-card-divider' });
    
    // Title
    const titleEl = card.createEl('h2', { text: article.title, cls: 'jm-card-title' });
    titleEl.addEventListener('click', () => this.openArticle());
    
    // Authors
    const authorsText = article.authors.length > 3
      ? `${article.authors.slice(0, 3).join(', ')} et al.`
      : article.authors.join(', ');
    card.createEl('p', { text: authorsText, cls: 'jm-card-authors' });
    
    card.createEl('hr', { cls: 'jm-card-divider' });
    
    // Abstract
    const abstractContainer = card.createDiv({ cls: 'jm-card-abstract-container' });
    if (article.abstract) {
      const abstractText = article.abstract.length > 800
        ? article.abstract.substring(0, 800) + '...'
        : article.abstract;
      
      const abstractEl = abstractContainer.createEl('p', { 
        text: abstractText, 
        cls: 'jm-card-abstract' 
      });
      
      if (article.abstract.length > 800) {
        const moreBtn = abstractContainer.createEl('button', { 
          text: '[show more]', 
          cls: 'jm-card-more-btn' 
        });
        moreBtn.addEventListener('click', () => {
          abstractEl.setText(article.abstract!);
          moreBtn.remove();
        });
      }
    } else {
      abstractContainer.createEl('p', { 
        text: 'No abstract available', 
        cls: 'jm-card-abstract jm-card-no-abstract' 
      });
    }
    
    card.createEl('hr', { cls: 'jm-card-divider' });
    
    // Metadata footer
    const meta = card.createDiv({ cls: 'jm-card-meta' });
    
    const doiLink = meta.createEl('a', { 
      text: `DOI: ${article.doi}`, 
      cls: 'jm-card-doi',
      href: article.url
    });
    doiLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openArticle();
    });
    
    if (article.volume || article.issue || article.pages) {
      const citation = [];
      if (article.volume) citation.push(`Vol. ${article.volume}`);
      if (article.issue) citation.push(`Issue ${article.issue}`);
      if (article.pages) citation.push(`pp. ${article.pages}`);
      meta.createEl('p', { text: citation.join(', '), cls: 'jm-card-citation' });
    }
    
    // Keywords
    if (article.keywords && article.keywords.length > 0) {
      const keywordsEl = meta.createDiv({ cls: 'jm-card-keywords' });
      keywordsEl.createEl('span', { text: 'Keywords: ', cls: 'jm-card-keywords-label' });
      keywordsEl.createEl('span', { 
        text: article.keywords.slice(0, 5).join(', '),
        cls: 'jm-card-keywords-text'
      });
    }
    
    // State indicator
    if (article.state !== 'unseen') {
      const stateEl = card.createDiv({ cls: `jm-card-state jm-state-${article.state}` });
      const stateText = {
        viewed: '👁 Viewed',
        saved: '★ Saved',
        skipped: '✗ Skipped'
      };
      stateEl.createEl('span', { text: stateText[article.state] || '' });
    }
  }
  
  private setupTouchHandlers(container: HTMLElement) {
    let touchStartY = 0;
    let touchStartX = 0;
    
    container.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    });
    
    container.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndX = e.changedTouches[0].clientX;
      
      const diffY = touchStartY - touchEndY;
      const diffX = touchStartX - touchEndX;
      
      // Minimum swipe distance
      const minSwipe = 50;
      
      // Vertical swipe (prioritize over horizontal)
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > minSwipe) {
        if (diffY > 0) {
          this.nextArticle();
        } else {
          this.prevArticle();
        }
      }
      // Horizontal swipe
      else if (Math.abs(diffX) > minSwipe) {
        if (diffX > 0) {
          // Swipe left = skip
          this.skipArticle();
        } else {
          // Swipe right = save
          this.saveArticle();
        }
      }
    });
  }
  
  private updateCounter() {
    const counterText = this.contentEl.querySelector('.jm-counter-text');
    if (counterText) {
      counterText.textContent = `Article ${this.currentIndex + 1}/${this.articles.length}`;
    }
  }
  
  private markViewed() {
    if (this.articles.length === 0) return;
    
    const article = this.articles[this.currentIndex];
    if (article && article.state === 'unseen') {
      article.state = 'viewed';
      article.viewedAt = new Date().toISOString();
      this.data.articles[article.doi] = article;
      this.onDataChange();
    }
  }
  
  private savePosition() {
    this.data.browsePosition.scrollIndex = this.currentIndex;
    if (this.articles.length > 0) {
      this.data.browsePosition.currentDoi = this.articles[this.currentIndex]?.doi || null;
    }
    this.onDataChange();
  }
  
  nextArticle() {
    if (this.currentIndex < this.articles.length - 1) {
      this.currentIndex++;
      this.renderCard(this.contentEl.querySelector('.jm-card-container')!);
      this.updateCounter();
      this.markViewed();
      this.savePosition();
    } else {
      new Notice('No more articles');
    }
  }
  
  prevArticle() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCard(this.contentEl.querySelector('.jm-card-container')!);
      this.updateCounter();
      this.markViewed();
      this.savePosition();
    } else {
      new Notice('Already at first article');
    }
  }
  
  async saveArticle() {
    if (this.articles.length === 0) return;
    
    const article = this.articles[this.currentIndex];
    if (!article) return;
    
    try {
      const path = await saveArticleNote(this.app, article, this.settings);
      
      article.state = 'saved';
      article.savedAt = new Date().toISOString();
      article.savedPath = path;
      this.data.articles[article.doi] = article;
      this.data.statistics.totalSaved++;
      
      // Update journal stats
      if (!this.data.statistics.byJournal[article.journalIssn]) {
        this.data.statistics.byJournal[article.journalIssn] = { fetched: 0, saved: 0, skipped: 0 };
      }
      this.data.statistics.byJournal[article.journalIssn].saved++;
      
      this.onDataChange();
      
      new Notice(`Saved: ${article.title.substring(0, 50)}...`);
      
      // Move to next if in unseen-only mode
      if (this.settings.currentFilter.showState === 'unseen') {
        this.articles.splice(this.currentIndex, 1);
        if (this.currentIndex >= this.articles.length) {
          this.currentIndex = Math.max(0, this.articles.length - 1);
        }
        this.renderCard(this.contentEl.querySelector('.jm-card-container')!);
        this.updateCounter();
      } else {
        this.renderCard(this.contentEl.querySelector('.jm-card-container')!);
      }
      
    } catch (error) {
      console.error('Error saving article:', error);
      new Notice('Error saving article');
    }
  }
  
  skipArticle() {
    if (this.articles.length === 0) return;
    
    const article = this.articles[this.currentIndex];
    if (!article) return;
    
    article.state = 'skipped';
    this.data.articles[article.doi] = article;
    this.data.statistics.totalSkipped++;
    
    // Update journal stats
    if (!this.data.statistics.byJournal[article.journalIssn]) {
      this.data.statistics.byJournal[article.journalIssn] = { fetched: 0, saved: 0, skipped: 0 };
    }
    this.data.statistics.byJournal[article.journalIssn].skipped++;
    
    this.onDataChange();
    
    // Remove from list if in unseen-only mode
    if (this.settings.currentFilter.showState === 'unseen') {
      this.articles.splice(this.currentIndex, 1);
      if (this.currentIndex >= this.articles.length) {
        this.currentIndex = Math.max(0, this.articles.length - 1);
      }
    } else {
      this.currentIndex++;
      if (this.currentIndex >= this.articles.length) {
        this.currentIndex = this.articles.length - 1;
      }
    }
    
    this.renderCard(this.contentEl.querySelector('.jm-card-container')!);
    this.updateCounter();
    this.savePosition();
  }
  
  openArticle() {
    if (this.articles.length === 0) return;
    
    const article = this.articles[this.currentIndex];
    if (!article) return;
    
    window.open(article.url, '_blank');
  }
  
  onClose() {
    this.savePosition();
    this.contentEl.empty();
  }
}
