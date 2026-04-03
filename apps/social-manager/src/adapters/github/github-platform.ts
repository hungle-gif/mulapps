/**
 * GitHub Platform Adapter — Tested & Verified
 *
 * Mục đích: Tìm trending repos + search repos thực tiễn → trả data thô về Hub
 * Tested live on Chrome DevTools 2026-03-31
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface GitHubRepo {
  rank: number;
  name: string;          // owner/repo
  url: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  stars_today: number;
  topics: string[];
}

// =============================================
// SCRAPE SCRIPTS (tested live)
// =============================================

/** Scrape GitHub Trending page — tested ✅ */
export const SCRAPE_TRENDING_SCRIPT = `() => {
  const repos = [];
  const rows = document.querySelectorAll('article.Box-row');
  rows.forEach((row, index) => {
    const nameLink = row.querySelector('h2 a');
    const desc = row.querySelector('p.col-9')?.textContent?.trim() || '';
    const lang = row.querySelector('[itemprop="programmingLanguage"]')?.textContent?.trim() || '';
    const starsEl = row.querySelector('a[href*="/stargazers"]');
    const starsText = starsEl?.textContent?.trim()?.replace(/,/g, '') || '0';
    const forksEl = row.querySelector('a[href*="/forks"]');
    const forksText = forksEl?.textContent?.trim()?.replace(/,/g, '') || '0';
    const todayText = row.querySelector('.float-sm-right')?.textContent?.trim() || '';
    const todayMatch = todayText.match(/([\\ \\d,]+)\\s*stars?/i);
    if (nameLink) {
      const fullName = nameLink.getAttribute('href')?.slice(1) || '';
      repos.push({
        rank: index + 1,
        name: fullName,
        url: 'https://github.com/' + fullName,
        description: desc.substring(0, 200),
        language: lang,
        stars: parseInt(starsText) || 0,
        forks: parseInt(forksText) || 0,
        stars_today: todayMatch ? parseInt(todayMatch[1].replace(/,/g, '').trim()) : 0,
      });
    }
  });
  return repos;
}`;

/** Scrape GitHub Search results — tested ✅ */
export const SCRAPE_SEARCH_SCRIPT = `() => {
  const results = [];
  const starLinks = document.querySelectorAll('a[href$="/stargazers"]');
  starLinks.forEach((starLink, idx) => {
    const starsRaw = starLink.textContent?.trim().replace(/,/g, '') || '0';
    let stars = starsRaw.endsWith('k') ? Math.round(parseFloat(starsRaw) * 1000) : parseInt(starsRaw) || 0;
    let el = starLink, repoName = '';
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) break;
      const links = el.querySelectorAll('a[href^="/"]');
      for (const link of links) {
        const h = link.getAttribute('href') || '';
        if (h.match(/^\\/[^\\/]+\\/[^\\/]+$/) && !h.includes('/topics/') && !h.includes('/stargazers') && !h.includes('/sponsors/') && !h.includes('/contact/') && !h.includes('/search')) {
          repoName = h.slice(1);
          break;
        }
      }
      if (repoName) break;
    }
    if (repoName && !results.find(r => r.name === repoName)) {
      results.push({ rank: idx + 1, name: repoName, url: 'https://github.com/' + repoName, stars });
    }
  });
  return results;
}`;

// =============================================
// URLS
// =============================================

export const GITHUB_URLS = {
  trending: (lang?: string, since?: string) => {
    let url = 'https://github.com/trending';
    const params: string[] = [];
    if (lang) params.push(`language=${encodeURIComponent(lang)}`);
    if (since) params.push(`since=${since}`); // daily, weekly, monthly
    return params.length ? `${url}?${params.join('&')}` : url;
  },
  search: (query: string, sort = 'stars') =>
    `https://github.com/search?q=${encodeURIComponent(query)}&type=repositories&s=${sort}&o=desc`,
  repo: (name: string) => `https://github.com/${name}`,
};

// =============================================
// ADAPTER CLASS
// =============================================

export class GitHubPlatformAdapter {
  private cdp: CDPConnector;

  constructor(cdp: CDPConnector) {
    this.cdp = cdp;
  }

  async getTrending(options?: { language?: string; since?: string; limit?: number }): Promise<{ repos: GitHubRepo[]; scraped_at: string }> {
    const url = GITHUB_URLS.trending(options?.language, options?.since);
    await this.cdp.navigate(url, 3000);

    // Dismiss popup if present
    await this.cdp.evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Got it!');
      if (btn) btn.click();
    `);
    await this.cdp.wait(500);

    const repos = await this.cdp.evaluateFunction(SCRAPE_TRENDING_SCRIPT);
    return {
      repos: (repos || []).slice(0, options?.limit || 25),
      scraped_at: new Date().toISOString(),
    };
  }

  async searchRepos(query: string, limit = 10): Promise<{ results: any[]; scraped_at: string }> {
    const url = GITHUB_URLS.search(query);
    await this.cdp.navigate(url, 3000);
    const results = await this.cdp.evaluateFunction(SCRAPE_SEARCH_SCRIPT);
    return {
      results: (results || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  async getRepoDetails(repoName: string): Promise<any> {
    await this.cdp.navigate(GITHUB_URLS.repo(repoName), 3000);
    return this.cdp.evaluateFunction(`() => {
      const desc = document.querySelector('[class*="BorderGrid"] p, .f4')?.textContent?.trim() || '';
      const about = document.querySelector('[class*="BorderGrid"]')?.textContent?.trim()?.substring(0, 300) || '';
      const stars = document.querySelector('#repo-stars-counter-star')?.textContent?.trim() || '0';
      const forks = document.querySelector('#repo-network-counter')?.textContent?.trim() || '0';
      const lang = document.querySelector('[class*="Language"]')?.textContent?.trim() || '';
      const readme = document.querySelector('#readme article')?.textContent?.trim()?.substring(0, 500) || '';
      return { name: '${repoName}', description: desc, about, stars, forks, language: lang, readme_preview: readme };
    }`);
  }
}

export default GitHubPlatformAdapter;
