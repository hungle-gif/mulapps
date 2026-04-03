/**
 * Threads Platform Adapter — CDP Browser Automation
 *
 * Scrapes threads.net via Chrome DevTools Protocol.
 * Threads (by Meta) has a structure similar to X.com:
 * - Feed of text posts with optional media
 * - Like, reply, repost actions
 * - Profile pages with follower counts
 * - Search functionality
 *
 * Key DOM patterns (2026):
 * - Posts: div containers with data attributes, similar to Instagram web
 * - Post text: spans with dir="auto"
 * - Actions: buttons with aria-labels (Like, Reply, Repost, Share)
 * - Profile: header section with stats
 * - Threads uses React with data-pressable-container and role attributes
 *
 * NOTE: Threads is relatively new and its DOM structure changes frequently.
 * All selectors marked with "TODO: verify selector live" need periodic validation.
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface ThreadsPost {
  post_url: string;
  author: string;
  username: string;
  text: string;
  posted_at: string;
  likes: number;
  replies: number;
  reposts: number;
  has_image: boolean;
  has_video: boolean;
  image_urls: string[];
}

export interface ThreadsProfile {
  name: string;
  username: string;
  bio: string;
  followers: number;
  following: number;
  is_verified: boolean;
  profile_pic_url: string;
  profile_url: string;
  instagram_link: string;
}

export interface ThreadsSearchResult {
  type: 'post' | 'user';
  post_url?: string;
  username: string;
  display_name: string;
  text?: string;
  followers?: number;
  is_verified?: boolean;
}

// =============================================
// URLS
// =============================================

export const THREADS_URLS = {
  home: 'https://www.threads.net/',
  search: (query: string) =>
    `https://www.threads.net/search?q=${encodeURIComponent(query)}&serp_type=default`,
  searchUsers: (query: string) =>
    `https://www.threads.net/search?q=${encodeURIComponent(query)}&serp_type=profiles`,
  profile: (username: string) =>
    `https://www.threads.net/@${username.replace('@', '')}`,
  post: (username: string, postId: string) =>
    `https://www.threads.net/@${username.replace('@', '')}/post/${postId}`,
  activity: 'https://www.threads.net/activity',
  liked: 'https://www.threads.net/liked',
  saved: 'https://www.threads.net/saved',
};

// =============================================
// SCRAPE SCRIPTS
// =============================================

/**
 * Scrape Threads feed posts.
 * Threads renders posts in a vertical feed similar to X/Twitter.
 * Each post is a container with author info, text, media, and action buttons.
 */
export const SCRAPE_FEED_SCRIPT = `() => {
  const posts = [];
  const seen = new Set();

  // TODO: verify selector live — Threads post containers
  // Threads uses div containers with role attributes and data-pressable-container
  const postContainers = document.querySelectorAll(
    'div[data-pressable-container="true"], ' +
    'article, ' +
    'div[role="article"]'
  );

  postContainers.forEach(container => {
    try {
      // Find the post link to get URL and deduplicate
      // TODO: verify selector live — post permalink (usually on the timestamp)
      const postLink = container.querySelector(
        'a[href*="/post/"], ' +
        'a[role="link"][href*="/@"]'
      );
      const postHref = postLink?.getAttribute('href') || '';
      if (!postHref || seen.has(postHref)) return;

      // Only count links containing /post/ for dedup
      const postUrlCandidate = postHref.includes('/post/')
        ? (postHref.startsWith('http') ? postHref : 'https://www.threads.net' + postHref)
        : '';

      if (postUrlCandidate) seen.add(postHref);

      // Author info
      // TODO: verify selector live — author username and display name
      const authorLinks = container.querySelectorAll('a[href*="/@"]');
      let username = '', displayName = '';
      for (const link of authorLinks) {
        const href = link.getAttribute('href') || '';
        const userMatch = href.match(/\\/@([^\\/\\?]+)/);
        if (userMatch && !username) {
          username = userMatch[1];
          // Display name is often the first text node in the same link
          const nameSpan = link.querySelector('span[dir="ltr"], span[class]');
          displayName = nameSpan?.textContent?.trim() || username;
          break;
        }
      }

      // Post text content
      // TODO: verify selector live — post text spans
      const textElements = container.querySelectorAll(
        'div[dir="auto"] > span, ' +
        'span[dir="auto"], ' +
        'div[class*="x1a6qonq"] span'
      );
      let text = '';
      textElements.forEach(el => {
        // Skip if this is an author name or action button text
        const parent = el.closest('a[href*="/@"]');
        if (parent && !parent.closest('div[dir="auto"]')) return;
        const t = el.textContent?.trim() || '';
        if (t.length > text.length) text = t;
      });

      // Alternatively, grab the largest text block in the container
      if (!text) {
        const allSpans = container.querySelectorAll('span');
        allSpans.forEach(span => {
          const t = span.textContent?.trim() || '';
          if (t.length > 20 && t.length > text.length && t !== displayName) {
            text = t;
          }
        });
      }

      // Timestamp
      // TODO: verify selector live — time element or relative time text
      const timeEl = container.querySelector('time');
      const postedAt = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';
      // Fallback: look for relative time text like "2h", "3d"
      let relativeTime = postedAt;
      if (!relativeTime) {
        const timeSpans = container.querySelectorAll('span');
        for (const span of timeSpans) {
          const t = span.textContent?.trim() || '';
          if (t.match(/^\\d+[smhdw]$/)) {
            relativeTime = t;
            break;
          }
        }
      }

      // Engagement counts — from action buttons area
      // TODO: verify selector live — like, reply, repost count spans
      let likes = 0, replies = 0, reposts = 0;

      // Method 1: Parse aria-labels on action buttons
      const actionBtns = container.querySelectorAll('button, div[role="button"]');
      actionBtns.forEach(btn => {
        const label = btn.getAttribute('aria-label') || '';
        const likeMatch = label.match(/(\\d[\\d,]*)\\s*like/i);
        const replyMatch = label.match(/(\\d[\\d,]*)\\s*repl/i);
        const repostMatch = label.match(/(\\d[\\d,]*)\\s*repost/i);
        if (likeMatch) likes = parseInt(likeMatch[1].replace(/,/g, '')) || 0;
        if (replyMatch) replies = parseInt(replyMatch[1].replace(/,/g, '')) || 0;
        if (repostMatch) reposts = parseInt(repostMatch[1].replace(/,/g, '')) || 0;
      });

      // Method 2: Parse visible count text near action buttons
      if (likes === 0 && replies === 0) {
        const countTexts = container.querySelectorAll('span[class]');
        const countValues = [];
        countTexts.forEach(span => {
          const t = span.textContent?.trim() || '';
          if (t.match(/^\\d[\\d,.]*[KMkm]?$/) && t.length < 10) {
            let num = 0;
            const raw = t.replace(/,/g, '');
            if (raw.endsWith('K') || raw.endsWith('k')) num = Math.round(parseFloat(raw) * 1000);
            else if (raw.endsWith('M') || raw.endsWith('m')) num = Math.round(parseFloat(raw) * 1000000);
            else num = parseInt(raw) || 0;
            if (num > 0) countValues.push(num);
          }
        });
        // Typical order: likes, replies (or replies, reposts)
        if (countValues.length >= 1) likes = countValues[0];
        if (countValues.length >= 2) replies = countValues[1];
        if (countValues.length >= 3) reposts = countValues[2];
      }

      // Media detection
      // TODO: verify selector live — images and videos in post
      const images = Array.from(container.querySelectorAll('img[src*="scontent"], img[src*="cdninstagram"]'))
        .map(img => img.getAttribute('src') || '')
        .filter(src => src && !src.includes('profile'));
      const hasVideo = !!container.querySelector('video');
      const hasImage = images.length > 0;

      if (username && (text || hasImage || hasVideo)) {
        posts.push({
          post_url: postUrlCandidate || '',
          author: displayName,
          username: '@' + username,
          text: text.substring(0, 1000),
          posted_at: relativeTime,
          likes,
          replies,
          reposts,
          has_image: hasImage,
          has_video: hasVideo,
          image_urls: images.slice(0, 5),
        });
      }
    } catch (e) {
      // Skip malformed post containers
    }
  });

  return posts;
}`;

/**
 * Scrape Threads search results (posts or users).
 */
export const SCRAPE_SEARCH_POSTS_SCRIPT = SCRAPE_FEED_SCRIPT;

export const SCRAPE_SEARCH_USERS_SCRIPT = `() => {
  const users = [];
  // TODO: verify selector live — user result items in search
  const items = document.querySelectorAll(
    'div[data-pressable-container="true"] a[href*="/@"], ' +
    'div[role="listitem"], ' +
    'div[role="button"][class]'
  );

  const seen = new Set();

  items.forEach(item => {
    try {
      const link = item.closest('a') || item.querySelector('a[href*="/@"]') || item;
      const href = link.getAttribute?.('href') || '';
      const userMatch = href.match(/\\/@([^\\/\\?]+)/);
      if (!userMatch) return;

      const username = userMatch[1];
      if (seen.has(username)) return;
      seen.add(username);

      // Display name — first bold/strong text or first span
      const nameEl = item.querySelector(
        'span[dir="ltr"] span, ' +
        'span[class*="x1lliihq"], ' +
        'span[style*="font-weight"]'
      );
      const displayName = nameEl?.textContent?.trim() || username;

      // Bio/subtitle — secondary text
      const spans = item.querySelectorAll('span');
      let bio = '';
      spans.forEach(span => {
        const t = span.textContent?.trim() || '';
        if (t.length > 10 && t !== displayName && t !== username && t !== '@' + username) {
          if (t.length > bio.length) bio = t;
        }
      });

      // Follower count from text
      let followers = 0;
      const allText = item.textContent || '';
      const followerMatch = allText.match(/([\\ \\d,.]+[KMkm]?)\\s*follower/i);
      if (followerMatch) {
        const raw = followerMatch[1].replace(/[, ]/g, '');
        if (raw.endsWith('K') || raw.endsWith('k')) followers = Math.round(parseFloat(raw) * 1000);
        else if (raw.endsWith('M') || raw.endsWith('m')) followers = Math.round(parseFloat(raw) * 1000000);
        else followers = parseInt(raw) || 0;
      }

      // Verified badge
      // TODO: verify selector live
      const isVerified = !!item.querySelector(
        'svg[aria-label="Verified"], ' +
        '[title="Verified"]'
      );

      users.push({
        type: 'user',
        username: '@' + username,
        display_name: displayName,
        text: bio.substring(0, 200),
        followers,
        is_verified: isVerified,
      });
    } catch (e) {
      // Skip
    }
  });

  return users;
}`;

/**
 * Scrape Threads profile page.
 */
export const SCRAPE_PROFILE_SCRIPT = `() => {
  // TODO: verify selector live — profile header section
  const header = document.querySelector(
    'header, ' +
    'div[class*="x6s0dn4"][class*="x78zum5"]'
  );

  // Name
  const nameEl = document.querySelector(
    'h1, ' +
    'span[class*="x1lliihq"][class*="x1plvlek"], ' +
    'header span[dir="ltr"]'
  );
  const name = nameEl?.textContent?.trim() || '';

  // Username from URL
  const pathMatch = window.location.pathname.match(/\\/@([^\\/]+)/);
  const username = pathMatch ? pathMatch[1] : '';

  // Bio
  // TODO: verify selector live — bio text below name
  const bioEl = document.querySelector(
    'meta[name="description"]'
  );
  let bio = bioEl?.getAttribute('content') || '';
  // Also try DOM-based bio
  if (!bio) {
    const bioSpans = document.querySelectorAll('span[dir="auto"]');
    bioSpans.forEach(span => {
      const t = span.textContent?.trim() || '';
      if (t.length > 20 && t !== name && t !== username && !t.includes('follower') && !t.includes('Threads')) {
        if (t.length > bio.length) bio = t;
      }
    });
  }

  // Follower / following counts
  // TODO: verify selector live — stat counts on profile
  let followers = 0, following = 0;
  const allText = document.body.textContent || '';

  const parseCount = (text) => {
    if (!text) return 0;
    text = text.replace(/,/g, '').trim();
    if (text.endsWith('K') || text.endsWith('k')) return Math.round(parseFloat(text) * 1000);
    if (text.endsWith('M') || text.endsWith('m')) return Math.round(parseFloat(text) * 1000000);
    if (text.endsWith('B') || text.endsWith('b')) return Math.round(parseFloat(text) * 1000000000);
    return parseInt(text) || 0;
  };

  const followersMatch = allText.match(/([\\ \\d,.]+[KMBkmb]?)\\s*followers?/i);
  if (followersMatch) followers = parseCount(followersMatch[1]);

  // Threads profile shows "followers" as a link — try clicking-based approach
  const statLinks = document.querySelectorAll('a[href*="/followers"], span[role="link"]');
  statLinks.forEach(link => {
    const t = link.textContent?.trim() || '';
    const numMatch = t.match(/([\\ \\d,.]+[KMBkmb]?)/);
    if (numMatch && t.toLowerCase().includes('follower')) {
      followers = parseCount(numMatch[1]);
    }
  });

  // Verified badge
  // TODO: verify selector live
  const isVerified = !!document.querySelector(
    'svg[aria-label="Verified"], ' +
    '[title="Verified"], ' +
    'span[class*="verified"]'
  );

  // Profile picture
  const profilePic = document.querySelector(
    'img[alt*="profile photo"], ' +
    'img[data-testid="user-avatar"], ' +
    'header img[src*="scontent"]'
  )?.getAttribute('src') || '';

  // Instagram link — Threads profiles often link to Instagram
  const instagramLink = document.querySelector(
    'a[href*="instagram.com"]'
  )?.getAttribute('href') || '';

  return {
    name,
    username: '@' + username,
    bio: bio.substring(0, 500),
    followers,
    following,
    is_verified: isVerified,
    profile_pic_url: profilePic,
    profile_url: window.location.href,
    instagram_link: instagramLink,
  };
}`;

/**
 * Scrape replies/comments on a specific Threads post.
 */
export const SCRAPE_POST_REPLIES_SCRIPT = `() => {
  const replies = [];
  // TODO: verify selector live — reply containers below the main post
  // The first post container is the OP, subsequent ones are replies
  const containers = document.querySelectorAll(
    'div[data-pressable-container="true"], ' +
    'article, ' +
    'div[role="article"]'
  );

  let isFirst = true;
  containers.forEach(container => {
    // Skip the first container (it's the original post)
    if (isFirst) { isFirst = false; return; }

    try {
      // Author
      const authorLink = container.querySelector('a[href*="/@"]');
      const href = authorLink?.getAttribute('href') || '';
      const userMatch = href.match(/\\/@([^\\/\\?]+)/);
      const username = userMatch ? userMatch[1] : '';
      const nameSpan = authorLink?.querySelector('span')
      const displayName = nameSpan?.textContent?.trim() || username;

      // Reply text
      const textEls = container.querySelectorAll('span[dir="auto"], div[dir="auto"] span');
      let text = '';
      textEls.forEach(el => {
        const t = el.textContent?.trim() || '';
        if (t.length > text.length && t !== displayName && t !== username) {
          text = t;
        }
      });

      // Likes on reply
      let likes = 0;
      const btns = container.querySelectorAll('button, div[role="button"]');
      btns.forEach(btn => {
        const label = btn.getAttribute('aria-label') || '';
        const likeMatch = label.match(/(\\d[\\d,]*)\\s*like/i);
        if (likeMatch) likes = parseInt(likeMatch[1].replace(/,/g, '')) || 0;
      });

      // Timestamp
      const timeEl = container.querySelector('time');
      const postedAt = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

      if (username && text) {
        replies.push({
          author: displayName,
          username: '@' + username,
          text: text.substring(0, 500),
          likes,
          posted_at: postedAt,
        });
      }
    } catch (e) {
      // Skip
    }
  });

  return replies;
}`;

// =============================================
// ADAPTER CLASS
// =============================================

export class ThreadsPlatformAdapter {
  private cdp: CDPConnector;
  private username: string;

  constructor(cdp: CDPConnector, username?: string) {
    this.cdp = cdp;
    this.username = username || '';
  }

  // =============================================
  // 1. SCRAPE FEED
  // =============================================

  /**
   * Scrape posts from Threads home feed.
   * Requires logged-in session.
   */
  async scrapeFeed(limit = 10): Promise<{ posts: ThreadsPost[]; scraped_at: string }> {
    await this.cdp.navigate(THREADS_URLS.home, 4000);

    // Scroll to load more posts
    for (let i = 0; i < Math.ceil(limit / 3); i++) {
      await this.cdp.scrollDown(1000);
    }

    const posts = await this.cdp.evaluateFunction(SCRAPE_FEED_SCRIPT);
    return {
      posts: (posts || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Alias for scrapeFeed — matches pattern of other adapters.
   */
  async getTrending(limit = 10): Promise<{ posts: ThreadsPost[]; scraped_at: string }> {
    return this.scrapeFeed(limit);
  }

  // =============================================
  // 2. SEARCH CONTENT
  // =============================================

  /**
   * Search Threads for posts or users.
   */
  async searchContent(
    query: string,
    type: 'posts' | 'users' = 'posts',
    limit = 20,
  ): Promise<{ results: any[]; scraped_at: string }> {
    const url = type === 'users'
      ? THREADS_URLS.searchUsers(query)
      : THREADS_URLS.search(query);

    await this.cdp.navigate(url, 4000);

    // Scroll to load more results
    for (let i = 0; i < Math.ceil(limit / 5); i++) {
      await this.cdp.scrollDown(800);
    }

    const script = type === 'users' ? SCRAPE_SEARCH_USERS_SCRIPT : SCRAPE_SEARCH_POSTS_SCRIPT;
    const results = await this.cdp.evaluateFunction(script);

    return {
      results: (results || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  // =============================================
  // 3. POST CONTENT
  // =============================================

  /**
   * Create a new Threads post (text with optional image).
   * Threads compose UI is typically a modal or inline composer on the feed.
   */
  async postContent(input: {
    text: string;
    media_path?: string;
  }): Promise<{ success: boolean; post_url?: string; error?: string }> {
    try {
      await this.cdp.navigate(THREADS_URLS.home, 4000);

      // Click the compose/new post button
      // TODO: verify selector live — compose trigger (usually a "+" button or "Start a thread" area)
      const composerClicked = await this.cdp.evaluate(`
        (() => {
          // Method 1: Look for "New thread" or compose button
          const btns = document.querySelectorAll('button, div[role="button"], a');
          for (const btn of btns) {
            const label = btn.getAttribute('aria-label') || '';
            const text = btn.textContent?.trim() || '';
            if (label.includes('New thread') || label.includes('Create') ||
                text === 'Start a thread' || text === 'New thread') {
              btn.click(); return true;
            }
          }
          // Method 2: SVG compose icon
          const svgBtns = document.querySelectorAll('svg[aria-label*="New"], svg[aria-label*="Create"]');
          for (const svg of svgBtns) {
            const btn = svg.closest('button') || svg.closest('div[role="button"]') || svg.closest('a');
            if (btn) { btn.click(); return true; }
          }
          return false;
        })()
      `);

      if (!composerClicked) throw new Error('Compose button not found');

      await this.cdp.wait(2000);

      // Type post text in the composer
      // TODO: verify selector live — thread compose text input
      const editorSelector = 'div[contenteditable="true"][role="textbox"], p[contenteditable="true"], div[aria-label*="thread"] div[contenteditable="true"]';
      const editorFound = await this.cdp.waitForSelector(editorSelector, 5000);
      if (!editorFound) throw new Error('Thread composer editor not found');

      await this.cdp.click(editorSelector);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(editorSelector, input.text);
      await this.cdp.wait(500);

      // Upload media if provided
      if (input.media_path) {
        // TODO: verify selector live — media attach button in composer
        const attachClicked = await this.cdp.evaluate(`
          (() => {
            const btns = document.querySelectorAll('button, div[role="button"]');
            for (const btn of btns) {
              const label = btn.getAttribute('aria-label') || '';
              if (label.includes('Attach') || label.includes('media') || label.includes('photo') || label.includes('image')) {
                btn.click(); return true;
              }
            }
            // Try the paperclip/image icon
            const svgBtns = document.querySelectorAll('svg[aria-label*="Attach"], svg[aria-label*="image"]');
            for (const svg of svgBtns) {
              const btn = svg.closest('button') || svg.closest('div[role="button"]');
              if (btn) { btn.click(); return true; }
            }
            return false;
          })()
        `);

        if (attachClicked) {
          await this.cdp.wait(1000);
          const fileInput = 'input[type="file"]';
          if (await this.cdp.exists(fileInput)) {
            await this.cdp.uploadFile(fileInput, input.media_path);
            await this.cdp.wait(3000); // Wait for upload processing
          }
        }
      }

      // Click "Post" button
      // TODO: verify selector live — post/publish button in composer
      const posted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button, div[role="button"]');
          for (const btn of btns) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
            if (text === 'post' || text === 'publish' || label === 'post' || label.includes('post thread')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!posted) throw new Error('Post button not found');

      await this.cdp.wait(3000);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // 4. REPLY TO POST
  // =============================================

  /**
   * Reply to a specific Threads post.
   */
  async replyToPost(
    postUrl: string,
    replyText: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(postUrl, 4000);

      // Click the reply button or reply input area
      // TODO: verify selector live — reply action button on the post
      const replyClicked = await this.cdp.evaluate(`
        (() => {
          // Method 1: Click reply icon button
          const btns = document.querySelectorAll('button, div[role="button"]');
          for (const btn of btns) {
            const label = btn.getAttribute('aria-label') || '';
            if (label.includes('Reply') || label.includes('Comment')) {
              btn.click(); return true;
            }
          }
          // Method 2: Click reply SVG icon
          const svgBtns = document.querySelectorAll('svg[aria-label*="Reply"], svg[aria-label*="Comment"]');
          for (const svg of svgBtns) {
            const btn = svg.closest('button') || svg.closest('div[role="button"]');
            if (btn) { btn.click(); return true; }
          }
          return false;
        })()
      `);

      if (!replyClicked) throw new Error('Reply button not found');

      await this.cdp.wait(2000);

      // Type reply in the reply composer
      // TODO: verify selector live — reply text input
      const replyInput = 'div[contenteditable="true"][role="textbox"], p[contenteditable="true"]';
      const found = await this.cdp.waitForSelector(replyInput, 5000);
      if (!found) throw new Error('Reply input not found');

      await this.cdp.click(replyInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(replyInput, replyText);
      await this.cdp.wait(500);

      // Click Post/Reply to submit
      // TODO: verify selector live — submit reply button
      const submitted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button, div[role="button"]');
          for (const btn of btns) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
            if (text === 'post' || text === 'reply' || label === 'post' || label.includes('reply')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!submitted) throw new Error('Reply submit button not found');

      await this.cdp.wait(2000);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // 5. GET POST REPLIES
  // =============================================

  /**
   * Scrape replies on a specific Threads post.
   */
  async getPostReplies(postUrl: string, limit = 20): Promise<{ replies: any[]; scraped_at: string }> {
    await this.cdp.navigate(postUrl, 4000);

    // Scroll to load more replies
    for (let i = 0; i < Math.ceil(limit / 5); i++) {
      await this.cdp.scrollDown(800);
    }

    const replies = await this.cdp.evaluateFunction(SCRAPE_POST_REPLIES_SCRIPT);
    return {
      replies: (replies || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  // =============================================
  // 6. PROFILE SCRAPE
  // =============================================

  /**
   * Get profile information for a Threads user.
   */
  async getProfile(username?: string): Promise<ThreadsProfile | null> {
    const user = username || this.username;
    if (!user) throw new Error('Username required');

    await this.cdp.navigate(THREADS_URLS.profile(user), 4000);

    const profile = await this.cdp.evaluateFunction(SCRAPE_PROFILE_SCRIPT);
    if (!profile) return null;

    return {
      name: profile.name || '',
      username: profile.username || `@${user}`,
      bio: profile.bio || '',
      followers: profile.followers || 0,
      following: profile.following || 0,
      is_verified: profile.is_verified || false,
      profile_pic_url: profile.profile_pic_url || '',
      profile_url: profile.profile_url || THREADS_URLS.profile(user),
      instagram_link: profile.instagram_link || '',
    };
  }

  /**
   * Get posts from a specific user's profile.
   */
  async getUserPosts(username: string, limit = 10): Promise<{ posts: ThreadsPost[]; scraped_at: string }> {
    await this.cdp.navigate(THREADS_URLS.profile(username), 4000);

    // Scroll to load posts
    for (let i = 0; i < Math.ceil(limit / 3); i++) {
      await this.cdp.scrollDown(1000);
    }

    const posts = await this.cdp.evaluateFunction(SCRAPE_FEED_SCRIPT);
    return {
      posts: (posts || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  // =============================================
  // 7. ENGAGEMENT ACTIONS
  // =============================================

  /**
   * Like a Threads post.
   */
  async likePost(postUrl: string): Promise<boolean> {
    await this.cdp.navigate(postUrl, 3000);

    // TODO: verify selector live — like button (heart icon)
    return this.cdp.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button, div[role="button"]');
        for (const btn of btns) {
          const label = btn.getAttribute('aria-label') || '';
          if (label.includes('Like') && !label.includes('Unlike')) {
            btn.click(); return true;
          }
        }
        // Fallback: find SVG heart that is not filled
        const svgs = document.querySelectorAll('svg[aria-label="Like"]');
        for (const svg of svgs) {
          const btn = svg.closest('button') || svg.closest('div[role="button"]');
          if (btn) { btn.click(); return true; }
        }
        return false;
      })()
    `);
  }

  /**
   * Repost a Threads post.
   */
  async repost(postUrl: string): Promise<boolean> {
    await this.cdp.navigate(postUrl, 3000);

    // TODO: verify selector live — repost button
    const repostClicked = await this.cdp.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button, div[role="button"]');
        for (const btn of btns) {
          const label = btn.getAttribute('aria-label') || '';
          if (label.includes('Repost') && !label.includes('Undo')) {
            btn.click(); return true;
          }
        }
        const svgs = document.querySelectorAll('svg[aria-label*="Repost"]');
        for (const svg of svgs) {
          const btn = svg.closest('button') || svg.closest('div[role="button"]');
          if (btn) { btn.click(); return true; }
        }
        return false;
      })()
    `);

    if (!repostClicked) return false;

    await this.cdp.wait(1000);

    // Confirm repost in dropdown/modal if needed
    // TODO: verify selector live — repost confirmation
    await this.cdp.evaluate(`
      (() => {
        const items = document.querySelectorAll('div[role="menuitem"], div[role="option"], button');
        for (const item of items) {
          const text = item.textContent?.trim() || '';
          if (text === 'Repost') {
            item.click(); return true;
          }
        }
        return false;
      })()
    `);

    await this.cdp.wait(1000);
    return true;
  }

  /**
   * Follow a Threads user.
   */
  async followUser(username: string): Promise<boolean> {
    await this.cdp.navigate(THREADS_URLS.profile(username), 3000);

    // TODO: verify selector live — Follow button on profile
    return this.cdp.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button, div[role="button"]');
        for (const btn of btns) {
          const text = btn.textContent?.trim() || '';
          if (text === 'Follow') {
            btn.click(); return true;
          }
        }
        return false;
      })()
    `);
  }

  // =============================================
  // 8. QUOTE POST
  // =============================================

  /**
   * Create a quote post (repost with comment).
   */
  async quotePost(postUrl: string, quoteText: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(postUrl, 3000);

      // Click repost button to get options
      // TODO: verify selector live — repost button
      await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button, div[role="button"]');
          for (const btn of btns) {
            const label = btn.getAttribute('aria-label') || '';
            if (label.includes('Repost')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      await this.cdp.wait(1000);

      // Select "Quote" option from dropdown
      // TODO: verify selector live — quote option in repost menu
      const quoteClicked = await this.cdp.evaluate(`
        (() => {
          const items = document.querySelectorAll('div[role="menuitem"], div[role="option"], button');
          for (const item of items) {
            const text = item.textContent?.trim() || '';
            if (text === 'Quote' || text.includes('Quote')) {
              item.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!quoteClicked) throw new Error('Quote option not found in repost menu');

      await this.cdp.wait(2000);

      // Type quote text in the composer
      const editorSelector = 'div[contenteditable="true"][role="textbox"], p[contenteditable="true"]';
      const found = await this.cdp.waitForSelector(editorSelector, 5000);
      if (!found) throw new Error('Quote composer not found');

      await this.cdp.click(editorSelector);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(editorSelector, quoteText);
      await this.cdp.wait(500);

      // Post the quote
      const posted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button, div[role="button"]');
          for (const btn of btns) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text === 'post') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!posted) throw new Error('Post button not found for quote');

      await this.cdp.wait(2000);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // 9. SESSION CHECK
  // =============================================

  /**
   * Check if the current browser session is logged into Threads.
   */
  async checkSession(): Promise<{ loggedIn: boolean; username?: string }> {
    await this.cdp.navigate(THREADS_URLS.home, 4000);

    const sessionData = await this.cdp.evaluate(`
      (() => {
        // Method 1: Check for compose/new thread button (only visible when logged in)
        const composeBtn = document.querySelector(
          'svg[aria-label*="New"], ' +
          'svg[aria-label*="Create"], ' +
          'a[href="/create"]'
        );
        if (composeBtn) {
          // Try to find username from profile nav link
          const profileLink = document.querySelector(
            'a[href*="/@"][role="link"], ' +
            'nav a[href*="/@"]'
          );
          if (profileLink) {
            const href = profileLink.getAttribute('href') || '';
            const match = href.match(/\\/@([^\\/\\?]+)/);
            return match ? match[1] : 'logged_in';
          }
          return 'logged_in';
        }

        // Method 2: Check for the home feed content (only loads when logged in)
        const feedPosts = document.querySelectorAll(
          'div[data-pressable-container="true"], ' +
          'article'
        );
        if (feedPosts.length > 0) return 'logged_in';

        // Method 3: Check for login prompt
        const loginBtn = document.querySelector(
          'a[href*="/login"], ' +
          'button[class*="login"]'
        );
        if (loginBtn) return '';

        return '';
      })()
    `);

    if (sessionData) {
      return {
        loggedIn: true,
        username: sessionData === 'logged_in' ? this.username : sessionData,
      };
    }

    return { loggedIn: false };
  }
}

export default ThreadsPlatformAdapter;
