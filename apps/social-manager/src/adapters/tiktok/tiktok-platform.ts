/**
 * TikTok Platform Adapter — Tested & Verified
 *
 * Scrape approach: TikTok uses virtual rendering.
 * - Video URLs + likes: from anchor .href property + innerText
 * - Descriptions + creators + hashtags: from img alt attribute (accessibility)
 * - Combined via 2-pass scrape
 *
 * Tested live on Chrome DevTools 2026-03-31
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface TikTokVideo {
  url: string;
  description: string;
  creator: string;
  username: string;
  likes: number;
  hashtags: string[];
}

// =============================================
// SCRAPE SCRIPTS (tested live ✅)
// =============================================

/** Scrape TikTok Explore / trending videos — tested ✅ */
export const SCRAPE_EXPLORE_SCRIPT = `() => {
  const videos = [];
  const anchors = document.getElementsByTagName('a');
  const likesMap = {};

  // Pass 1: likes from video links (innerText = "202.5K")
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const href = a.href || '';
    if (!href.includes('/video/')) continue;
    const text = (a.innerText || '').trim();
    const match = text.match(/^([\\d,.]+[KMB]?)$/);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      let likes = 0;
      if (raw.endsWith('K')) likes = Math.round(parseFloat(raw) * 1000);
      else if (raw.endsWith('M')) likes = Math.round(parseFloat(raw) * 1000000);
      else likes = parseInt(raw) || 0;
      likesMap[href] = likes;
    }
  }

  // Pass 2: descriptions from img alt
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const href = a.href || '';
    if (!href.includes('/video/')) continue;

    const img = a.querySelector('img');
    const fullDesc = img?.getAttribute('alt') || '';
    if (fullDesc.length < 5) continue;
    if (videos.find(v => v.url === href)) continue;

    const descMatch = fullDesc.match(/^([\\s\\S]+?)\\s*created by/i);
    const description = descMatch ? descMatch[1].trim() : fullDesc.substring(0, 200);
    const creatorMatch = fullDesc.match(/created by\\s+([\\s\\S]+?)\\s+with/i);
    const creator = creatorMatch ? creatorMatch[1].trim() : '';
    const userMatch = href.match(/@([^\\/]+)/);
    const username = userMatch ? '@' + userMatch[1] : '';
    const hashtags = (description.match(/#[\\w\\u00C0-\\u024F\\u1EA0-\\u1EF9]+/g) || []).slice(0, 5);

    videos.push({
      url: href,
      description: description.substring(0, 200),
      creator,
      username,
      likes: likesMap[href] || 0,
      hashtags,
    });
  }

  return videos;
}`;

/** Scrape TikTok search results — same structure as explore */
export const SCRAPE_SEARCH_SCRIPT = SCRAPE_EXPLORE_SCRIPT;

// =============================================
// URLS
// =============================================

export const TIKTOK_URLS = {
  explore: 'https://www.tiktok.com/explore',
  forYou: 'https://www.tiktok.com/',
  search: (query: string) => `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
  searchVideos: (query: string) => `https://www.tiktok.com/search/video?q=${encodeURIComponent(query)}`,
  profile: (username: string) => `https://www.tiktok.com/@${username.replace('@', '')}`,
  upload: 'https://www.tiktok.com/tiktokstudio/upload?from=webapp',
};

// =============================================
// ADAPTER CLASS
// =============================================

export class TikTokPlatformAdapter {
  private cdp: CDPConnector;

  constructor(cdp: CDPConnector) {
    this.cdp = cdp;
  }

  /**
   * Get trending/explore videos
   */
  async getTrending(limit = 15): Promise<{ videos: TikTokVideo[]; scraped_at: string }> {
    await this.cdp.navigate(TIKTOK_URLS.explore, 4000);
    const videos = await this.cdp.evaluateFunction(SCRAPE_EXPLORE_SCRIPT);
    return {
      videos: (videos || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Search videos by keyword
   */
  async searchVideos(query: string, limit = 15): Promise<{ results: TikTokVideo[]; scraped_at: string }> {
    await this.cdp.navigate(TIKTOK_URLS.searchVideos(query), 4000);
    // Scroll to load more
    for (let i = 0; i < 3; i++) {
      await this.cdp.scrollDown(800);
    }
    const results = await this.cdp.evaluateFunction(SCRAPE_SEARCH_SCRIPT);
    return {
      results: (results || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Get videos from a specific user's profile
   */
  async getUserVideos(username: string, limit = 10): Promise<{ videos: TikTokVideo[]; scraped_at: string }> {
    await this.cdp.navigate(TIKTOK_URLS.profile(username), 4000);
    const videos = await this.cdp.evaluateFunction(SCRAPE_EXPLORE_SCRIPT);
    return {
      videos: (videos || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Get profile info
   */
  async getProfile(username: string): Promise<any> {
    await this.cdp.navigate(TIKTOK_URLS.profile(username), 4000);
    return this.cdp.evaluateFunction(`() => {
      const name = document.querySelector('h1[data-e2e="user-title"], h2[data-e2e="user-subtitle"]')?.textContent?.trim() || '';
      const bio = document.querySelector('[data-e2e="user-bio"]')?.textContent?.trim() || '';
      const following = document.querySelector('[data-e2e="following-count"]')?.textContent?.trim() || '0';
      const followers = document.querySelector('[data-e2e="followers-count"]')?.textContent?.trim() || '0';
      const likes = document.querySelector('[data-e2e="likes-count"]')?.textContent?.trim() || '0';
      return {
        name,
        username: '${username}',
        bio,
        following,
        followers,
        total_likes: likes,
        profile_url: window.location.href,
      };
    }`);
  }

  /**
   * Post a video (requires login)
   * Navigate to upload page → fill description → upload file
   */
  async postVideo(videoPath: string, description: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(TIKTOK_URLS.upload, 5000);

      // Upload file
      const fileInput = 'input[type="file"]';
      const found = await this.cdp.waitForSelector(fileInput, 5000);
      if (!found) throw new Error('Upload input not found — are you logged in?');

      await this.cdp.uploadFile(fileInput, videoPath);
      await this.cdp.wait(5000); // Wait for video processing

      // Fill description
      const descInput = '[data-e2e="caption-textarea"], [contenteditable="true"]';
      const descFound = await this.cdp.waitForSelector(descInput, 5000);
      if (descFound) {
        await this.cdp.click(descInput);
        await this.cdp.wait(500);
        // Clear existing and type new
        await this.cdp.evaluate(`
          const el = document.querySelector('${descInput}');
          if (el) { el.textContent = ''; el.focus(); }
        `);
        await this.cdp.typeIntoRichEditor(descInput, description);
      }

      // Click Post button
      const postBtn = 'button[data-e2e="post-button"], button:has-text("Post")';
      await this.cdp.wait(2000);
      // Don't auto-post — let Hub decide
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check login session
   */
  async checkSession(): Promise<{ loggedIn: boolean; username?: string }> {
    await this.cdp.navigate('https://www.tiktok.com/', 3000);
    const profileLink = await this.cdp.evaluate(`
      document.querySelector('a[href*="/@"][data-e2e="nav-profile"]')?.getAttribute('href') || ''
    `);
    if (profileLink && profileLink.includes('/@')) {
      const username = profileLink.replace(/.*@/, '@');
      return { loggedIn: true, username };
    }
    // Check if login button is visible
    const hasLogin = await this.cdp.exists('button:has-text("Log in")');
    return { loggedIn: !hasLogin };
  }
}

export default TikTokPlatformAdapter;
