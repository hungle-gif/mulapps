/**
 * Hugging Face Platform Adapter — Tested & Verified
 *
 * Mục đích: Tìm trending models/spaces → trả data thô về Hub
 * Tested live on Chrome DevTools 2026-03-31
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface HFModel {
  name: string;          // org/model
  url: string;
  task: string;          // Text Generation, Image-to-Video, etc.
  size: string;          // 7B, 13B, etc.
  updated: string;
  downloads: number;
  likes: number;
}

export interface HFSpace {
  name: string;
  url: string;
  description: string;
  likes: number;
}

// =============================================
// SCRAPE SCRIPTS (tested live)
// =============================================

/** Scrape HF trending models — tested ✅ */
export const SCRAPE_MODELS_SCRIPT = `() => {
  const models = [];
  const seen = new Set();
  const allLinks = document.querySelectorAll('a[href^="/"]');

  allLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    const skipPatterns = ['/models', '/datasets', '/spaces', '/docs', '/pricing', '/login', '/join', '/search', '/settings', '/new', '/organizations'];
    if (!href.match(/^\\/[^\\/]+\\/[^\\/]+$/) || skipPatterns.some(p => href.includes(p))) return;

    const name = href.slice(1);
    if (seen.has(name) || name.includes('?') || name.includes('#')) return;
    seen.add(name);

    const ctx = link.textContent?.trim() || '';
    const taskMatch = ctx.match(/(Text Generation|Image-Text-to-Text|Automatic Speech Recognition|Text-to-Speech|Image-to-Video|Audio-to-Audio|Text-to-Image|Image-to-Image|Any-to-Any|Feature Extraction|Translation|Summarization|Question Answering|Fill-Mask|Token Classification|Sentence Similarity)/);
    const sizeMatch = ctx.match(/(\\d+[BM])\\b/);
    const updatedMatch = ctx.match(/Updated\\s+(.+?ago)/);

    // Parse downloads and likes from pattern: "• 337k • 1.82k"
    const numPattern = ctx.match(/([\\d,.]+[kKmM]?)\\s*•?\\s*([\\d,.]+[kKmM]?)?\\s*$/);

    const parseNum = (s) => {
      if (!s) return 0;
      s = s.replace(/,/g, '');
      if (s.endsWith('k') || s.endsWith('K')) return Math.round(parseFloat(s) * 1000);
      if (s.endsWith('M') || s.endsWith('m')) return Math.round(parseFloat(s) * 1000000);
      return parseInt(s) || 0;
    };

    models.push({
      name,
      url: 'https://huggingface.co/' + name,
      task: taskMatch ? taskMatch[1] : '',
      size: sizeMatch ? sizeMatch[1] : '',
      updated: updatedMatch ? updatedMatch[1] : '',
      downloads: numPattern ? parseNum(numPattern[1]) : 0,
      likes: numPattern && numPattern[2] ? parseNum(numPattern[2]) : 0,
    });
  });

  return models;
}`;

/** Scrape HF Spaces — tested structure */
export const SCRAPE_SPACES_SCRIPT = `() => {
  const spaces = [];
  const seen = new Set();
  const allLinks = document.querySelectorAll('a[href^="/spaces/"]');

  allLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    const name = href.replace('/spaces/', '');
    if (seen.has(name) || !name.includes('/')) return;
    seen.add(name);

    const parent = link.closest('article') || link.parentElement?.parentElement;
    const desc = parent?.querySelector('p')?.textContent?.trim() || '';
    const likesMatch = parent?.textContent?.match(/(\\d[\\d,.]*[kKmM]?)\\s*$/);

    const parseNum = (s) => {
      if (!s) return 0;
      s = s.replace(/,/g, '');
      if (s.endsWith('k') || s.endsWith('K')) return Math.round(parseFloat(s) * 1000);
      if (s.endsWith('M') || s.endsWith('m')) return Math.round(parseFloat(s) * 1000000);
      return parseInt(s) || 0;
    };

    spaces.push({
      name,
      url: 'https://huggingface.co/spaces/' + name,
      description: desc.substring(0, 200),
      likes: likesMatch ? parseNum(likesMatch[1]) : 0,
    });
  });

  return spaces;
}`;

// =============================================
// URLS
// =============================================

export const HF_URLS = {
  trendingModels: (task?: string) => {
    let url = 'https://huggingface.co/models?sort=trending';
    if (task) url += `&pipeline_tag=${encodeURIComponent(task)}`;
    return url;
  },
  trendingSpaces: 'https://huggingface.co/spaces?sort=trending',
  searchModels: (query: string) =>
    `https://huggingface.co/models?search=${encodeURIComponent(query)}&sort=trending`,
  searchSpaces: (query: string) =>
    `https://huggingface.co/spaces?search=${encodeURIComponent(query)}&sort=trending`,
  model: (name: string) => `https://huggingface.co/${name}`,
};

// =============================================
// ADAPTER CLASS
// =============================================

export class HuggingFacePlatformAdapter {
  private cdp: CDPConnector;

  constructor(cdp: CDPConnector) {
    this.cdp = cdp;
  }

  async getTrendingModels(options?: { task?: string; limit?: number }): Promise<{ models: HFModel[]; scraped_at: string }> {
    const url = HF_URLS.trendingModels(options?.task);
    await this.cdp.navigate(url, 4000);

    const models = await this.cdp.evaluateFunction(SCRAPE_MODELS_SCRIPT);
    return {
      models: (models || []).slice(0, options?.limit || 20),
      scraped_at: new Date().toISOString(),
    };
  }

  async getTrendingSpaces(limit = 20): Promise<{ spaces: HFSpace[]; scraped_at: string }> {
    await this.cdp.navigate(HF_URLS.trendingSpaces, 4000);

    const spaces = await this.cdp.evaluateFunction(SCRAPE_SPACES_SCRIPT);
    return {
      spaces: (spaces || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  async searchModels(query: string, limit = 20): Promise<{ models: HFModel[]; scraped_at: string }> {
    const url = HF_URLS.searchModels(query);
    await this.cdp.navigate(url, 4000);

    const models = await this.cdp.evaluateFunction(SCRAPE_MODELS_SCRIPT);
    return {
      models: (models || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  async getModelDetails(modelName: string): Promise<any> {
    await this.cdp.navigate(HF_URLS.model(modelName), 4000);
    return this.cdp.evaluateFunction(`() => {
      const title = document.querySelector('h1')?.textContent?.trim() || '';
      const desc = document.querySelector('[class*="model-desc"], .prose')?.textContent?.trim()?.substring(0, 500) || '';
      const tags = Array.from(document.querySelectorAll('a[href*="/models?"]')).map(a => a.textContent?.trim()).filter(Boolean);
      const downloads = document.querySelector('[title*="download"], [class*="download"]')?.textContent?.trim() || '';
      const likes = document.querySelector('[class*="like"]')?.textContent?.trim() || '';
      return { name: '${modelName}', title, description: desc, tags: tags.slice(0, 10), downloads, likes };
    }`);
  }
}

export default HuggingFacePlatformAdapter;
