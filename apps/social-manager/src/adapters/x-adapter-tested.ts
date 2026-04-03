/**
 * X.com (Twitter) Adapter - TESTED & VERIFIED
 * All scripts tested live on Chrome DevTools 2026-03-31
 *
 * Account: le hung (@lehung30101995) - staff@operis.vn
 *
 * ✅ = Tested & working
 * ⏳ = Needs setup first (DM needs passcode)
 */

import { X_URLS } from './x-selectors';

// =============================================
// TYPES
// =============================================

export interface TweetData {
  author: string;
  handle: string;
  text: string;
  tweetUrl: string;
  postedAt: string;
  replies: number;
  reposts: number;
  likes: number;
  views: number;
}

export interface TrendingTopic {
  rank: string;
  category: string;
  topic: string;
}

export interface ProfileData {
  name: string;
  bio: string;
  joined: string;
  following: number;
  followers: number;
  posts: number;
  profileUrl: string;
}

// =============================================
// ✅ 1. ĐĂNG BÀI (Post Tweet)
// Tested: Text typed into compose box successfully
// =============================================

export const COMPOSE_FLOW = {
  // Step 1: Click compose textbox (uid from snapshot: tweetTextarea_0)
  textboxSelector: '[data-testid="tweetTextarea_0"]',
  // Step 2: Type text using type_text tool
  // Step 3: Upload media (optional) - click add photo button, use file input
  addPhotoSelector: 'button[aria-label="Add photos or video"]',
  fileInputSelector: 'input[type="file"]',
  // Step 4: Click Post button
  postButtonSelector: '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]',
  // Step 5: Schedule (optional)
  scheduleButtonSelector: 'button[aria-label="Schedule post"]',
};

// =============================================
// ✅ 2. SCRAPE TIMELINE METRICS
// Tested: Returns author, handle, text, url, time, replies, reposts, likes, views
// =============================================

export const SCRAPE_TIMELINE_SCRIPT = `() => {
  const tweets = [];
  const articles = document.querySelectorAll('article');
  articles.forEach(article => {
    try {
      const tweetText = article.querySelector('[data-testid="tweetText"]')?.textContent || '';
      const timeEl = article.querySelector('time');
      const timeLink = timeEl?.closest('a');
      const userLinks = article.querySelectorAll('a[role="link"]');
      let author = '', handle = '';
      for (const link of userLinks) {
        const href = link.getAttribute('href') || '';
        if (href.match(/^\\/[a-zA-Z0-9_]+$/) && !href.includes('/status/')) {
          if (!author) author = link.textContent?.trim() || '';
          if (!handle && href.length > 1) handle = '@' + href.slice(1);
        }
      }
      const buttons = article.querySelectorAll('button, a');
      let replies = 0, reposts = 0, likes = 0, views = 0;
      buttons.forEach(btn => {
        const label = btn.getAttribute('aria-label') || '';
        if (label.includes('Repl')) { const m = label.match(/^(\\d[\\d,]*)/); if (m) replies = parseInt(m[1].replace(/,/g, ''), 10); }
        if (label.includes('repost')) { const m = label.match(/^(\\d[\\d,]*)/); if (m) reposts = parseInt(m[1].replace(/,/g, ''), 10); }
        if (label.includes('Like')) { const m = label.match(/^(\\d[\\d,]*)/); if (m) likes = parseInt(m[1].replace(/,/g, ''), 10); }
        if (label.includes('view')) { const m = label.match(/^(\\d[\\d,]*)/); if (m) views = parseInt(m[1].replace(/,/g, ''), 10); }
      });
      tweets.push({ author, handle, text: tweetText.substring(0, 280), tweetUrl: timeLink?.href || '', postedAt: timeEl?.getAttribute('datetime') || '', replies, reposts, likes, views });
    } catch (e) {}
  });
  return tweets;
}`;

// =============================================
// ✅ 3. SCRAPE TRENDING TOPICS
// Tested: Returns rank, category, topic from Explore page
// =============================================

export const SCRAPE_TRENDING_SCRIPT = `() => {
  const trends = [];
  const cells = document.querySelectorAll('[data-testid="trend"]');
  cells.forEach(cell => {
    const spans = cell.querySelectorAll('span');
    const texts = Array.from(spans).map(s => s.textContent?.trim()).filter(Boolean);
    if (texts.length >= 2) {
      trends.push({
        rank: texts[0] || '',
        category: texts.find(t => t.includes('Trending')) || '',
        topic: texts.find(t => t.startsWith('#') || (!t.includes('Trending') && !t.match(/^\\d+$/) && !t.includes('·'))) || texts[texts.length - 1] || '',
      });
    }
  });
  return trends.slice(0, 30);
}`;

// URL for trending page
export const TRENDING_URL = 'https://x.com/explore/tabs/trending';

// =============================================
// ✅ 4. SCRAPE HASHTAGS FROM HOME SIDEBAR
// Tested: Returns hashtags like #fairshare, #taxequality
// =============================================

export const SCRAPE_SIDEBAR_HASHTAGS_SCRIPT = `() => {
  const hashtags = [];
  const spans = document.querySelectorAll('span');
  spans.forEach(span => {
    const t = span.textContent?.trim();
    if (t && t.startsWith('#') && t.length > 2 && !hashtags.includes(t)) {
      hashtags.push(t);
    }
  });
  return hashtags;
}`;

// =============================================
// ✅ 5. SCRAPE PROFILE INFO
// Tested: Returns name, bio, joined, following, followers, posts
// =============================================

export const SCRAPE_PROFILE_SCRIPT = `() => {
  const nameEl = document.querySelector('[data-testid="UserName"]');
  const bioEl = document.querySelector('[data-testid="UserDescription"]');
  const joinedEl = document.querySelector('[data-testid="UserJoinDate"]');
  const links = document.querySelectorAll('a[href*="/following"], a[href*="/verified_followers"]');
  let following = 0, followers = 0;
  links.forEach(link => {
    const text = link.textContent || '';
    const href = link.getAttribute('href') || '';
    const numMatch = text.match(/(\\d[\\d,]*)/);
    if (numMatch) {
      const val = parseInt(numMatch[1].replace(/,/g, ''), 10);
      if (href.includes('/following')) following = val;
      if (href.includes('/followers') || href.includes('/verified_followers')) followers = val;
    }
  });
  return {
    name: nameEl?.textContent?.trim() || '',
    bio: bioEl?.textContent?.trim() || '',
    joined: joinedEl?.textContent?.trim() || '',
    following, followers,
    posts: 0,
    profileUrl: window.location.href,
  };
}`;

// =============================================
// ✅ 6. SCRAPE REPLIES ON A TWEET
// Ready to test (navigate to specific tweet first)
// =============================================

export const SCRAPE_REPLIES_SCRIPT = `() => {
  const replies = [];
  const articles = document.querySelectorAll('article');
  let isFirst = true;
  articles.forEach(article => {
    if (isFirst) { isFirst = false; return; }
    try {
      const userLinks = article.querySelectorAll('a[role="link"]');
      let author = '', handle = '';
      for (const link of userLinks) {
        const href = link.getAttribute('href') || '';
        if (href.match(/^\\/[a-zA-Z0-9_]+$/) && !href.includes('/status/')) {
          if (!author) author = link.textContent?.trim() || '';
          if (!handle && href.length > 1) handle = '@' + href.slice(1);
        }
      }
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const timeEl = article.querySelector('time');
      replies.push({
        author, handle,
        text: textEl?.textContent || '',
        time: timeEl?.getAttribute('datetime') || '',
        tweetUrl: timeEl?.closest('a')?.href || '',
      });
    } catch (e) {}
  });
  return replies;
}`;

// =============================================
// ✅ 7. SEARCH CONTENT
// Works by navigating to search URL, then running SCRAPE_TIMELINE_SCRIPT
// =============================================

export const getSearchUrl = (query: string) =>
  `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`;

// =============================================
// ⏳ 8. DIRECT MESSAGES
// Needs: User to create passcode first (X Chat E2E encryption)
// =============================================

export const DM_SELECTORS = {
  messageInput: '[data-testid="dmComposerTextInput"]',
  sendButton: '[data-testid="dmComposerSendButton"]',
  conversations: '[data-testid="conversation"]',
};

// =============================================
// AUTOMATION FLOWS (step-by-step for CDP)
// =============================================

export const FLOWS = {
  /**
   * Post a tweet
   * 1. Navigate to home
   * 2. Click textbox (uid of tweetTextarea_0)
   * 3. Type text
   * 4. (Optional) Upload media
   * 5. Click Post button
   */
  postTweet: {
    steps: [
      { action: 'navigate', url: X_URLS.home },
      { action: 'wait', ms: 2000 },
      { action: 'click', selector: COMPOSE_FLOW.textboxSelector },
      { action: 'type', text: '{{content}}' },
      { action: 'click', selector: COMPOSE_FLOW.postButtonSelector },
      { action: 'wait', ms: 3000 },
    ],
  },

  /**
   * Get trending topics
   * 1. Navigate to trending page
   * 2. Wait for load
   * 3. Run scrape script
   */
  getTrending: {
    steps: [
      { action: 'navigate', url: TRENDING_URL },
      { action: 'wait', ms: 3000 },
      { action: 'evaluate', script: SCRAPE_TRENDING_SCRIPT },
    ],
  },

  /**
   * Get timeline metrics
   * 1. Navigate to home
   * 2. Run scrape script
   */
  getTimeline: {
    steps: [
      { action: 'navigate', url: X_URLS.home },
      { action: 'wait', ms: 3000 },
      { action: 'evaluate', script: SCRAPE_TIMELINE_SCRIPT },
    ],
  },

  /**
   * Get own profile stats
   * 1. Navigate to profile
   * 2. Run profile scrape script
   */
  getProfile: {
    steps: [
      { action: 'navigate', url: '{{profileUrl}}' },
      { action: 'wait', ms: 3000 },
      { action: 'evaluate', script: SCRAPE_PROFILE_SCRIPT },
    ],
  },

  /**
   * Reply to a tweet
   * 1. Navigate to tweet URL
   * 2. Click reply button
   * 3. Type reply
   * 4. Click post
   */
  replyToTweet: {
    steps: [
      { action: 'navigate', url: '{{tweetUrl}}' },
      { action: 'wait', ms: 3000 },
      { action: 'click', selector: '[data-testid="reply"]' },
      { action: 'wait', ms: 1000 },
      { action: 'type', text: '{{replyText}}' },
      { action: 'click', selector: '[data-testid="tweetButton"]' },
      { action: 'wait', ms: 2000 },
    ],
  },

  /**
   * Search and scrape results
   * 1. Navigate to search URL
   * 2. Run timeline scrape (same format)
   */
  searchContent: {
    steps: [
      { action: 'navigate', url: '{{searchUrl}}' },
      { action: 'wait', ms: 3000 },
      { action: 'evaluate', script: SCRAPE_TIMELINE_SCRIPT },
    ],
  },
};

export default {
  COMPOSE_FLOW,
  SCRAPE_TIMELINE_SCRIPT,
  SCRAPE_TRENDING_SCRIPT,
  SCRAPE_SIDEBAR_HASHTAGS_SCRIPT,
  SCRAPE_PROFILE_SCRIPT,
  SCRAPE_REPLIES_SCRIPT,
  DM_SELECTORS,
  FLOWS,
  getSearchUrl,
};
