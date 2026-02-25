# Copilot Instructions for Journal Monitor Plugin

This file provides context and instructions for GitHub Copilot (Claude model) when working on this Obsidian plugin.

## Project Overview

**Journal Monitor** is an Obsidian plugin that provides a TikTok-style interface for browsing academic journal articles. It fetches articles from academic APIs (OpenAlex, CrossRef), allows users to swipe through them, and saves interesting articles as Obsidian notes with full metadata.

## Architecture

```
src/
├── main.ts              # Plugin lifecycle, commands, ribbon icon
├── types.ts             # All TypeScript interfaces, default configs
├── api.ts               # API calls to OpenAlex and CrossRef
├── utils.ts             # Note generation, filtering, file operations
└── views/`
    ├── BrowseView.ts    # Main TikTok-style article browser (Modal)
    ├── DiscoveryView.ts # Historical article search (Modal)
    ├── FilterModal.ts   # Filter configuration (Modal)
    └── SettingsTab.ts   # Plugin settings (PluginSettingTab)
```

## Key Concepts

### Article States
Articles can be in four states (see `types.ts`):
- `unseen`: Never viewed, appears in browse queue
- `viewed`: Seen but no action taken
- `saved`: User saved to vault (creates note)
- `skipped`: User explicitly dismissed

### Data Persistence
Two separate data stores:
1. **Settings** (`JournalMonitorSettings`): User preferences, journal list, API config
2. **Data** (`JournalMonitorData`): Fetched articles, browse position, statistics

Both saved together via `this.saveData({ settings, data })`.

### API Integration
- **OpenAlex** (recommended): Better abstract coverage, inverted index for abstracts
- **CrossRef**: Alternative, good DOI coverage

Key functions in `api.ts`:
- `fetchFromOpenAlex()` / `fetchFromCrossRef()`: Fetch recent articles by journal
- `searchOpenAlex()`: Keyword search for discovery mode
- `lookupJournalByIssn()`: Add new journals by ISSN

### Note Generation
`utils.ts` handles creating markdown notes:
- `generateArticleNote()`: Full note with frontmatter + content
- `generateBibtex()`: BibTeX citation block
- `generateMasterIndex()`: Aggregated index with Dataview queries
- `generateJournalIndex()`: Per-journal article list

## Obsidian Plugin Patterns

### Modal Views
All views extend `Modal`:
```typescript
export class BrowseView extends Modal {
  onOpen() {
    // Build UI in this.contentEl
  }
  onClose() {
    // Cleanup
  }
}
```

### Settings Tab
Extends `PluginSettingTab`:
```typescript
export class JournalMonitorSettingTab extends PluginSettingTab {
  display(): void {
    // Build settings UI
  }
}
```

### Commands
Register in `main.ts onload()`:
```typescript
this.addCommand({
  id: 'command-id',
  name: 'Human readable name',
  callback: () => this.doSomething(),
});
```

### File Operations
Use Obsidian's vault API:
```typescript
await this.app.vault.create(path, content);  // Create file
await this.app.vault.modify(file, content);  // Update file
const file = this.app.vault.getAbstractFileByPath(path);
```

## Styling

All styles in `styles.css` use BEM-like naming with `jm-` prefix:
- `.jm-card` - Article card
- `.jm-action-btn` - Action buttons
- `.jm-browse-*` - Browse view elements

CSS variables from Obsidian:
- `--background-primary`, `--background-secondary`
- `--text-normal`, `--text-muted`
- `--interactive-accent`

## Common Tasks

### Adding a New Journal Property
1. Add to `Article` interface in `types.ts`
2. Extract from API response in `api.ts` (`openAlexToArticle` / `crossRefToArticle`)
3. Add to frontmatter in `utils.ts` (`generateFrontmatter`)
4. Display in `BrowseView.ts` card rendering

### Adding a New Filter
1. Add property to `FilterConfig` in `types.ts`
2. Add UI control in `FilterModal.ts`
3. Implement filtering logic in `utils.ts` (`filterArticles`)

### Adding a New Command
1. Add command in `main.ts` `onload()`
2. Implement the handler method
3. Document in README.md

### Adding a New Setting
1. Add property to `JournalMonitorSettings` in `types.ts`
2. Add default value in `DEFAULT_SETTINGS`
3. Add UI in `SettingsTab.ts`

## API Response Handling

### OpenAlex Work Structure
```typescript
interface OpenAlexWork {
  id: string;
  doi?: string;  // May be null
  display_name: string;
  publication_date: string;
  abstract_inverted_index?: Record<string, number[]>;  // Needs reconstruction
  authorships: Array<{ author: { display_name: string } }>;
  primary_location?: { source?: { display_name: string } };
  // ...
}
```

Abstract reconstruction (inverted index → text):
```typescript
function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  words.sort((a, b) => a[1] - b[1]);
  return words.map(w => w[0]).join(' ');
}
```

### CrossRef Work Structure
```typescript
interface CrossRefWork {
  DOI: string;
  title: string[];  // Array, use [0]
  author?: Array<{ given?: string; family?: string }>;
  abstract?: string;  // May contain HTML, strip tags
  'container-title'?: string[];  // Journal name
  published?: { 'date-parts': number[][] };
  // ...
}
```

## Testing

### Manual Testing Checklist
1. [ ] Fetch articles from all enabled journals
2. [ ] Browse view navigation (keyboard + swipe)
3. [ ] Save article creates correct note
4. [ ] Skip article updates state correctly
5. [ ] Filters work (date range, journals, keywords, state)
6. [ ] Discovery search returns results
7. [ ] Settings changes persist
8. [ ] Add custom journal by ISSN
9. [ ] Master index generates correctly
10. [ ] Mobile gestures work

### API Testing
Test endpoints manually:
```bash
# OpenAlex - fetch recent RSE articles
curl "https://api.openalex.org/works?filter=primary_location.source.issn:0034-4257,publication_date:>2024-01-01&sort=publication_date:desc&per-page=5"

# OpenAlex - journal lookup
curl "https://api.openalex.org/sources/issn:0034-4257"
```

## Build & Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build
```

Output: `main.js` in project root (loaded by Obsidian).

## Error Handling

Always wrap API calls:
```typescript
try {
  const response = await requestUrl({ url, method: 'GET' });
  // Process response
} catch (error) {
  console.error('API error:', error);
  return [];  // Return empty array, don't throw
}
```

Show user-friendly notices:
```typescript
new Notice('Error fetching articles. Check your internet connection.');
```

## Performance Considerations

- **Batch API calls** per journal, not per article
- **Lazy load** abstracts in browse view (show truncated first)
- **Debounce** filter changes
- **Cache** article data locally (don't re-fetch existing DOIs)

## Future Enhancement Ideas

1. **Zotero integration**: Export saved articles to Zotero
2. **RSS fallback**: For journals without good API coverage
3. **Recommendations**: Suggest articles based on saved papers
4. **Annotations**: Highlight and annotate within Obsidian
5. **Collaborative lists**: Share reading lists
6. **PDF download**: Fetch OA PDFs automatically
7. **Citation network**: Show related papers
8. **Reading statistics**: Track reading habits over time

## Contact & Resources

- **Obsidian Plugin Docs**: https://docs.obsidian.md/Plugins
- **OpenAlex Docs**: https://docs.openalex.org
- **CrossRef API**: https://api.crossref.org
