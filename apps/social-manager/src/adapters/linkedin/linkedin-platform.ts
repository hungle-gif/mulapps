/**
 * LinkedIn Platform Adapter — CDP Browser Automation
 *
 * Scrapes linkedin.com via Chrome DevTools Protocol.
 * LinkedIn uses class-based selectors primarily (BEM-like with hashed suffixes).
 * The DOM relies on Ember/React-like rendering with data attributes.
 *
 * Key DOM patterns (2026):
 * - Feed posts: div.feed-shared-update-v2 or [data-urn] containers
 * - Post actions: .social-actions-button (like, comment, repost, send)
 * - Profile: .pv-top-card for header section
 * - Messages: linkedin.com/messaging with thread list
 * - Search: linkedin.com/search/results/{type}
 * - Post composer: .share-box-feed-entry__trigger or modal
 *
 * NOTE: LinkedIn has aggressive bot detection. Rate-limit all operations.
 * All selectors marked with "TODO: verify selector live" need periodic validation.
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface LinkedInPost {
  post_url: string;
  post_urn: string;
  author: string;
  author_headline: string;
  author_profile_url: string;
  text: string;
  posted_at: string;
  reactions: number;
  comments: number;
  reposts: number;
  media_type: 'text' | 'image' | 'video' | 'article' | 'document' | 'poll';
}

export interface LinkedInProfile {
  name: string;
  headline: string;
  about: string;
  location: string;
  connections: number;
  followers: number;
  profile_url: string;
  profile_pic_url: string;
  current_company: string;
  current_role: string;
  education: string;
}

export interface LinkedInMessage {
  thread_id: string;
  contact_name: string;
  contact_headline: string;
  last_message: string;
  unread: boolean;
  timestamp: string;
}

export interface LinkedInSearchResult {
  type: 'people' | 'posts' | 'jobs' | 'companies';
  title: string;
  subtitle: string;
  url: string;
  snippet: string;
}

export interface LinkedInJob {
  title: string;
  company: string;
  location: string;
  posted_at: string;
  applicants: string;
  job_url: string;
  employment_type: string;
}

// =============================================
// URLS
// =============================================

export const LINKEDIN_URLS = {
  feed: 'https://www.linkedin.com/feed/',
  profile: (username: string) => `https://www.linkedin.com/in/${username.replace('@', '')}/`,
  searchPeople: (query: string) =>
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
  searchPosts: (query: string) =>
    `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}`,
  searchJobs: (query: string) =>
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`,
  searchCompanies: (query: string) =>
    `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query)}`,
  messaging: 'https://www.linkedin.com/messaging/',
  messagingThread: (threadId: string) =>
    `https://www.linkedin.com/messaging/thread/${threadId}/`,
  post: (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`,
  myNetwork: 'https://www.linkedin.com/mynetwork/',
  notifications: 'https://www.linkedin.com/notifications/',
  company: (slug: string) => `https://www.linkedin.com/company/${slug}/`,
};

// =============================================
// SCRAPE SCRIPTS
// =============================================

/**
 * Scrape LinkedIn feed posts.
 * LinkedIn feed items are wrapped in containers with data-urn attributes.
 * Each contains: actor (author), commentary (text), social counts, media.
 */
export const SCRAPE_FEED_SCRIPT = `() => {
  const posts = [];
  // TODO: verify selector live — feed update containers
  const updates = document.querySelectorAll(
    '.feed-shared-update-v2, ' +
    'div[data-urn*="urn:li:activity"], ' +
    '[data-id*="urn:li:activity"]'
  );

  updates.forEach(update => {
    try {
      const urn = update.getAttribute('data-urn') ||
                  update.getAttribute('data-id') || '';

      // Author info
      // TODO: verify selector live — actor/author section in post
      const actorContainer = update.querySelector(
        '.update-components-actor, ' +
        '.feed-shared-actor, ' +
        'div[class*="update-components-actor"]'
      );
      const authorLink = actorContainer?.querySelector('a[href*="/in/"], a[href*="/company/"]');
      const author = actorContainer?.querySelector(
        '.update-components-actor__name span, ' +
        '.feed-shared-actor__name span, ' +
        'span[dir="ltr"] span[aria-hidden="true"]'
      )?.textContent?.trim() || '';
      const authorHeadline = actorContainer?.querySelector(
        '.update-components-actor__description, ' +
        '.feed-shared-actor__description, ' +
        'span[class*="actor__description"]'
      )?.textContent?.trim() || '';
      const authorProfileUrl = authorLink?.getAttribute('href')?.split('?')[0] || '';

      // Post text/commentary
      // TODO: verify selector live — post text content
      const textContainer = update.querySelector(
        '.feed-shared-update-v2__commentary, ' +
        '.update-components-text, ' +
        '.feed-shared-text, ' +
        'div[class*="update-components-text"]'
      );
      let text = '';
      if (textContainer) {
        // Expand "...see more" if present
        const seeMore = textContainer.querySelector('button[class*="see-more"]');
        if (seeMore) seeMore.click();
        text = textContainer.textContent?.trim() || '';
      }

      // Timestamp
      // TODO: verify selector live — post timestamp
      const timeEl = update.querySelector(
        '.update-components-actor__sub-description span, ' +
        '.feed-shared-actor__sub-description span, ' +
        'time, ' +
        'span[class*="actor__sub-description"] span'
      );
      const postedAt = timeEl?.textContent?.trim() || '';

      // Social counts: reactions, comments, reposts
      // TODO: verify selector live — social counts bar
      const socialBar = update.querySelector(
        '.social-details-social-counts, ' +
        'div[class*="social-details-social-counts"]'
      );

      let reactions = 0, comments = 0, reposts = 0;
      if (socialBar) {
        const reactionsEl = socialBar.querySelector(
          '.social-details-social-counts__reactions-count, ' +
          'button[aria-label*="reaction"], ' +
          'span[class*="reactions-count"]'
        );
        const reactionsText = reactionsEl?.textContent?.trim() || '0';
        reactions = parseInt(reactionsText.replace(/[^\\d]/g, '')) || 0;

        const countsText = socialBar.textContent || '';
        const commentsMatch = countsText.match(/(\\d[\\d,]*)\\s*comment/i);
        const repostsMatch = countsText.match(/(\\d[\\d,]*)\\s*repost/i);
        if (commentsMatch) comments = parseInt(commentsMatch[1].replace(/,/g, '')) || 0;
        if (repostsMatch) reposts = parseInt(repostsMatch[1].replace(/,/g, '')) || 0;
      }

      // Media type detection
      // TODO: verify selector live — media detection in post
      let mediaType = 'text';
      if (update.querySelector('video, div[class*="video"]')) mediaType = 'video';
      else if (update.querySelector('img[class*="feed-shared-image"], div[class*="update-components-image"]')) mediaType = 'image';
      else if (update.querySelector('article, a[class*="update-components-article"]')) mediaType = 'article';
      else if (update.querySelector('div[class*="document"], div[class*="carousel"]')) mediaType = 'document';
      else if (update.querySelector('div[class*="poll"]')) mediaType = 'poll';

      // Post URL from URN
      let postUrl = '';
      if (urn) {
        postUrl = 'https://www.linkedin.com/feed/update/' + urn + '/';
      } else {
        const postLink = update.querySelector('a[href*="/feed/update/"]');
        postUrl = postLink?.getAttribute('href')?.split('?')[0] || '';
        if (postUrl && !postUrl.startsWith('http')) postUrl = 'https://www.linkedin.com' + postUrl;
      }

      if (author || text) {
        posts.push({
          post_url: postUrl,
          post_urn: urn,
          author,
          author_headline: authorHeadline.substring(0, 200),
          author_profile_url: authorProfileUrl.startsWith('http')
            ? authorProfileUrl
            : authorProfileUrl ? 'https://www.linkedin.com' + authorProfileUrl : '',
          text: text.substring(0, 1000),
          posted_at: postedAt,
          reactions,
          comments,
          reposts,
          media_type: mediaType,
        });
      }
    } catch (e) {
      // Skip malformed posts
    }
  });

  return posts;
}`;

/**
 * Scrape LinkedIn search results (people, posts, jobs, companies).
 */
export const SCRAPE_SEARCH_PEOPLE_SCRIPT = `() => {
  const results = [];
  // TODO: verify selector live — people search result items
  const items = document.querySelectorAll(
    '.reusable-search__result-container, ' +
    'li.reusable-search__result-container, ' +
    'div[class*="entity-result"]'
  );

  items.forEach(item => {
    try {
      const nameLink = item.querySelector('a[href*="/in/"], span.entity-result__title-text a');
      const name = nameLink?.querySelector('span[aria-hidden="true"], span[dir="ltr"]')?.textContent?.trim() ||
                   nameLink?.textContent?.trim() || '';
      const profileUrl = nameLink?.getAttribute('href')?.split('?')[0] || '';

      const headline = item.querySelector(
        '.entity-result__primary-subtitle, ' +
        'div[class*="entity-result__primary-subtitle"]'
      )?.textContent?.trim() || '';

      const location = item.querySelector(
        '.entity-result__secondary-subtitle, ' +
        'div[class*="entity-result__secondary-subtitle"]'
      )?.textContent?.trim() || '';

      const snippet = item.querySelector(
        '.entity-result__summary, ' +
        'p[class*="entity-result__summary"]'
      )?.textContent?.trim() || '';

      if (name) {
        results.push({
          type: 'people',
          title: name,
          subtitle: headline.substring(0, 200),
          url: profileUrl.startsWith('http') ? profileUrl : 'https://www.linkedin.com' + profileUrl,
          snippet: (location + ' ' + snippet).trim().substring(0, 300),
        });
      }
    } catch (e) {
      // Skip
    }
  });

  return results;
}`;

/**
 * Scrape LinkedIn search results for content/posts.
 */
export const SCRAPE_SEARCH_POSTS_SCRIPT = `() => {
  const results = [];
  // TODO: verify selector live — content search result items
  const items = document.querySelectorAll(
    '.feed-shared-update-v2, ' +
    'div[data-urn*="urn:li:activity"], ' +
    'div[class*="search-content"]'
  );

  items.forEach(item => {
    try {
      const authorEl = item.querySelector(
        '.update-components-actor__name span[aria-hidden="true"], ' +
        'span[class*="actor__name"] span'
      );
      const author = authorEl?.textContent?.trim() || '';

      const textEl = item.querySelector(
        '.update-components-text span, ' +
        '.feed-shared-text span'
      );
      const text = textEl?.textContent?.trim()?.substring(0, 500) || '';

      const urn = item.getAttribute('data-urn') || '';
      const postUrl = urn ? 'https://www.linkedin.com/feed/update/' + urn + '/' : '';

      if (author || text) {
        results.push({
          type: 'posts',
          title: author,
          subtitle: text.substring(0, 100),
          url: postUrl,
          snippet: text.substring(0, 300),
        });
      }
    } catch (e) {
      // Skip
    }
  });

  return results;
}`;

/**
 * Scrape LinkedIn job search results.
 */
export const SCRAPE_SEARCH_JOBS_SCRIPT = `() => {
  const jobs = [];
  // TODO: verify selector live — job listing cards
  const cards = document.querySelectorAll(
    '.job-card-container, ' +
    '.jobs-search-results__list-item, ' +
    'li[class*="jobs-search-results"]'
  );

  cards.forEach(card => {
    try {
      const titleLink = card.querySelector(
        'a[class*="job-card-list__title"], ' +
        'a.job-card-container__link, ' +
        'a[href*="/jobs/view/"]'
      );
      const title = titleLink?.querySelector('strong, span')?.textContent?.trim() ||
                    titleLink?.textContent?.trim() || '';
      const jobUrl = titleLink?.getAttribute('href')?.split('?')[0] || '';

      const company = card.querySelector(
        '.job-card-container__primary-description, ' +
        'a[class*="job-card-container__company-name"], ' +
        'span[class*="company-name"]'
      )?.textContent?.trim() || '';

      const location = card.querySelector(
        '.job-card-container__metadata-item, ' +
        'li[class*="job-card-container__metadata-item"]'
      )?.textContent?.trim() || '';

      const timeEl = card.querySelector('time, span[class*="listed-time"]');
      const postedAt = timeEl?.textContent?.trim() || '';

      const applicantsEl = card.querySelector('span[class*="applicant-count"]');
      const applicants = applicantsEl?.textContent?.trim() || '';

      if (title) {
        jobs.push({
          title,
          company,
          location: location.substring(0, 100),
          posted_at: postedAt,
          applicants,
          job_url: jobUrl.startsWith('http') ? jobUrl : 'https://www.linkedin.com' + jobUrl,
          employment_type: '',
        });
      }
    } catch (e) {
      // Skip
    }
  });

  return jobs;
}`;

/**
 * Scrape LinkedIn profile page.
 */
export const SCRAPE_PROFILE_SCRIPT = `() => {
  // TODO: verify selector live — profile top card section
  const topCard = document.querySelector(
    '.pv-top-card, ' +
    'section[class*="pv-top-card"], ' +
    'div[class*="scaffold-layout__main"]'
  );
  if (!topCard) return null;

  const name = topCard.querySelector(
    'h1, ' +
    '.pv-top-card--list li:first-child, ' +
    'h1[class*="text-heading-xlarge"]'
  )?.textContent?.trim() || '';

  const headline = topCard.querySelector(
    '.text-body-medium, ' +
    'div[class*="text-body-medium"]'
  )?.textContent?.trim() || '';

  const location = topCard.querySelector(
    '.text-body-small[class*="pv-top-card--list-bullet"] span, ' +
    'span[class*="text-body-small"][class*="t-black--light"]'
  )?.textContent?.trim() || '';

  // Connection/follower counts
  const connectionsEl = topCard.querySelector(
    'a[href*="/connections/"] span, ' +
    'span[class*="t-bold"]:first-of-type'
  );
  const connectionsText = connectionsEl?.textContent?.trim() || '0';
  const connections = parseInt(connectionsText.replace(/[^\\d]/g, '')) || 0;

  const followersEl = document.querySelector(
    'span[class*="pvs-header__subtitle"] span, ' +
    'p[class*="pvs-header__subtitle"]'
  );
  let followers = 0;
  const followersText = followersEl?.textContent?.trim() || '';
  const followersMatch = followersText.match(/([\\ \\d,.]+[KMkm]?)\\s*follower/i);
  if (followersMatch) {
    const raw = followersMatch[1].replace(/[, ]/g, '');
    if (raw.endsWith('K') || raw.endsWith('k')) followers = Math.round(parseFloat(raw) * 1000);
    else if (raw.endsWith('M') || raw.endsWith('m')) followers = Math.round(parseFloat(raw) * 1000000);
    else followers = parseInt(raw) || 0;
  }

  // Profile picture
  const profilePic = topCard.querySelector(
    'img[class*="pv-top-card-profile-picture__image"], ' +
    'img[class*="profile-photo-edit__preview"], ' +
    'img[alt*="photo"]'
  )?.getAttribute('src') || '';

  // About section
  // TODO: verify selector live — about section
  const aboutSection = document.querySelector(
    '#about ~ div .pv-shared-text-with-see-more, ' +
    'section[class*="pv-about-section"], ' +
    'div[class*="display-flex"][class*="full-width"] span[aria-hidden="true"]'
  );
  const about = aboutSection?.textContent?.trim()?.substring(0, 500) || '';

  // Current position — from Experience section first entry
  // TODO: verify selector live — experience section
  const experienceSection = document.querySelector(
    '#experience ~ div, ' +
    'section[class*="experience"]'
  );
  const currentRole = experienceSection?.querySelector(
    'span[aria-hidden="true"], ' +
    '.pv-entity__summary-info h3'
  )?.textContent?.trim() || '';
  const currentCompany = experienceSection?.querySelector(
    'span[class*="t-14"][class*="t-normal"] span[aria-hidden="true"], ' +
    '.pv-entity__secondary-title'
  )?.textContent?.trim() || '';

  // Education — first entry
  const educationSection = document.querySelector(
    '#education ~ div, ' +
    'section[class*="education"]'
  );
  const education = educationSection?.querySelector(
    'span[aria-hidden="true"]'
  )?.textContent?.trim() || '';

  return {
    name,
    headline: headline.substring(0, 200),
    about,
    location,
    connections,
    followers,
    profile_url: window.location.href.split('?')[0],
    profile_pic_url: profilePic,
    current_company: currentCompany.substring(0, 100),
    current_role: currentRole.substring(0, 100),
    education: education.substring(0, 100),
  };
}`;

/**
 * Scrape LinkedIn messaging inbox.
 */
export const SCRAPE_MESSAGING_SCRIPT = `() => {
  const threads = [];
  // TODO: verify selector live — messaging thread list items
  const items = document.querySelectorAll(
    '.msg-conversation-listitem, ' +
    'li[class*="msg-conversation-listitem"], ' +
    'div[class*="msg-overlay-list-bubble"]'
  );

  items.forEach(item => {
    try {
      const nameEl = item.querySelector(
        '.msg-conversation-listitem__participant-names, ' +
        'h3[class*="msg-conversation-listitem__participant-names"], ' +
        'span[class*="truncate"]'
      );
      const contactName = nameEl?.textContent?.trim() || '';

      const headlineEl = item.querySelector(
        '.msg-conversation-card__message-snippet-body, ' +
        'p[class*="msg-conversation-card__message-snippet"]'
      );
      const lastMessage = headlineEl?.textContent?.trim() || '';

      const timeEl = item.querySelector(
        '.msg-conversation-listitem__time-stamp, ' +
        'time[class*="msg-conversation-listitem__time-stamp"]'
      );
      const timestamp = timeEl?.textContent?.trim() || '';

      // Unread indicator
      // TODO: verify selector live
      const unread = !!item.querySelector(
        '.msg-conversation-listitem__unread-count, ' +
        'span[class*="notification-badge"]'
      );

      // Thread ID from data attribute or link
      const threadLink = item.querySelector('a[href*="/messaging/thread/"]');
      const threadHref = threadLink?.getAttribute('href') || '';
      const threadMatch = threadHref.match(/\\/messaging\\/thread\\/([^\\/\\?]+)/);
      const threadId = threadMatch ? threadMatch[1] : '';

      if (contactName) {
        threads.push({
          thread_id: threadId,
          contact_name: contactName,
          contact_headline: '',
          last_message: lastMessage.substring(0, 200),
          unread,
          timestamp,
        });
      }
    } catch (e) {
      // Skip
    }
  });

  return threads;
}`;

// =============================================
// ADAPTER CLASS
// =============================================

export class LinkedInPlatformAdapter {
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
   * Scrape posts from LinkedIn feed.
   * Requires logged-in session.
   */
  async scrapeFeed(limit = 10): Promise<{ posts: LinkedInPost[]; scraped_at: string }> {
    await this.cdp.navigate(LINKEDIN_URLS.feed, 5000);

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
  async getTrending(limit = 10): Promise<{ posts: LinkedInPost[]; scraped_at: string }> {
    return this.scrapeFeed(limit);
  }

  // =============================================
  // 2. SEARCH CONTENT
  // =============================================

  /**
   * Search LinkedIn by type: people, posts, jobs, companies.
   */
  async searchContent(
    query: string,
    type: 'people' | 'posts' | 'jobs' | 'companies' = 'posts',
    limit = 20,
  ): Promise<{ results: any[]; scraped_at: string }> {
    let url: string;
    let script: string;

    switch (type) {
      case 'people':
        url = LINKEDIN_URLS.searchPeople(query);
        script = SCRAPE_SEARCH_PEOPLE_SCRIPT;
        break;
      case 'jobs':
        url = LINKEDIN_URLS.searchJobs(query);
        script = SCRAPE_SEARCH_JOBS_SCRIPT;
        break;
      case 'companies':
        url = LINKEDIN_URLS.searchCompanies(query);
        script = SCRAPE_SEARCH_PEOPLE_SCRIPT; // Reuse people script structure
        break;
      case 'posts':
      default:
        url = LINKEDIN_URLS.searchPosts(query);
        script = SCRAPE_SEARCH_POSTS_SCRIPT;
        break;
    }

    await this.cdp.navigate(url, 5000);

    // Scroll to load more results
    for (let i = 0; i < Math.ceil(limit / 5); i++) {
      await this.cdp.scrollDown(800);
    }

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
   * Create a LinkedIn post (text or article).
   * Steps: Click "Start a post" → type content → click Post.
   */
  async postContent(input: {
    text: string;
    hashtags?: string[];
    media_path?: string;
    article_url?: string;
  }): Promise<{ success: boolean; post_url?: string; error?: string }> {
    try {
      const fullText = input.hashtags
        ? `${input.text}\n\n${input.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`
        : input.text;

      await this.cdp.navigate(LINKEDIN_URLS.feed, 4000);

      // Click "Start a post" button
      // TODO: verify selector live — post composer trigger
      const composerClicked = await this.cdp.evaluate(`
        (() => {
          const triggers = document.querySelectorAll(
            '.share-box-feed-entry__trigger, ' +
            'button[class*="share-box-feed-entry__trigger"], ' +
            'button[aria-label*="Start a post"], ' +
            'div[class*="share-box"] button'
          );
          for (const btn of triggers) {
            btn.click(); return true;
          }
          return false;
        })()
      `);

      if (!composerClicked) throw new Error('Post composer trigger not found');

      await this.cdp.wait(2000);

      // Type post content in the modal editor
      // TODO: verify selector live — post composer text area in modal
      const editorSelector = '.ql-editor[data-placeholder], div[contenteditable="true"][role="textbox"], div[aria-label*="Text editor"]';
      const editorFound = await this.cdp.waitForSelector(editorSelector, 5000);
      if (!editorFound) throw new Error('Post editor not found');

      await this.cdp.click(editorSelector);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(editorSelector, fullText);
      await this.cdp.wait(500);

      // Upload media if provided
      if (input.media_path) {
        // TODO: verify selector live — media upload button in composer
        const mediaBtn = await this.cdp.evaluate(`
          (() => {
            const btns = document.querySelectorAll(
              'button[aria-label*="Add a photo"], ' +
              'button[aria-label*="Add media"], ' +
              'button[class*="image-sharing"]'
            );
            for (const btn of btns) {
              btn.click(); return true;
            }
            return false;
          })()
        `);

        if (mediaBtn) {
          await this.cdp.wait(1000);
          const fileInput = 'input[type="file"]';
          if (await this.cdp.exists(fileInput)) {
            await this.cdp.uploadFile(fileInput, input.media_path);
            await this.cdp.wait(3000); // Wait for upload
          }
        }
      }

      // Share an article URL if provided
      if (input.article_url) {
        // Paste the URL — LinkedIn auto-generates preview
        await this.cdp.typeIntoRichEditor(editorSelector, `\n${input.article_url}`);
        await this.cdp.wait(3000); // Wait for link preview
      }

      // Click "Post" button
      // TODO: verify selector live — post submit button in modal
      const posted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll(
            'button[class*="share-actions__primary-action"], ' +
            'button[aria-label="Post"], ' +
            'button.artdeco-button--primary'
          );
          for (const btn of btns) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
            if (text === 'post' || label === 'post' || text.includes('post')) {
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
  // 4. REPLY TO COMMENTS
  // =============================================

  /**
   * Reply to a comment on a LinkedIn post.
   */
  async replyToComment(
    postUrl: string,
    commentAuthor: string,
    replyText: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(postUrl, 5000);

      // Scroll to load comments
      await this.cdp.scrollDown(500);
      await this.cdp.wait(1500);

      // Click "Comment" button to expand comments section if collapsed
      // TODO: verify selector live — comment toggle button
      await this.cdp.evaluate(`
        (() => {
          const commentBtn = document.querySelector(
            'button[aria-label*="Comment"], ' +
            'button[class*="comment-button"]'
          );
          if (commentBtn) commentBtn.click();
        })()
      `);
      await this.cdp.wait(1500);

      // Find the specific comment and click reply
      // TODO: verify selector live — individual comment items and reply buttons
      const replyClicked = await this.cdp.evaluate(`
        (() => {
          const comments = document.querySelectorAll(
            '.comments-comment-item, ' +
            'article[class*="comments-comment-item"]'
          );
          for (const comment of comments) {
            const authorEl = comment.querySelector(
              '.comments-post-meta__name-text span[aria-hidden="true"], ' +
              'a[class*="comments-post-meta"] span'
            );
            const author = authorEl?.textContent?.trim() || '';
            if (author.toLowerCase().includes('${commentAuthor.toLowerCase().replace(/'/g, "\\'")}')) {
              const replyBtn = comment.querySelector(
                'button[aria-label*="Reply"], ' +
                'button[class*="comments-comment-social-bar__reply"]'
              );
              if (replyBtn) { replyBtn.click(); return true; }
            }
          }
          return false;
        })()
      `);

      if (!replyClicked) throw new Error(`Comment by ${commentAuthor} not found or Reply button missing`);

      await this.cdp.wait(1000);

      // Type reply in the reply input
      // TODO: verify selector live — reply input field
      const replyInput = '.ql-editor[data-placeholder*="reply"], div[contenteditable="true"][role="textbox"]';
      const found = await this.cdp.waitForSelector(replyInput, 3000);
      if (!found) throw new Error('Reply input not found');

      await this.cdp.click(replyInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(replyInput, replyText);
      await this.cdp.wait(500);

      // Submit reply
      // TODO: verify selector live — reply submit button
      const submitted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll(
            'button[class*="comments-comment-box__submit-button"], ' +
            'button.artdeco-button--primary'
          );
          // Find the visible submit button closest to the reply input
          for (const btn of btns) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text === 'reply' || text === 'post' || text === 'submit') {
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
  // 5. MESSAGES
  // =============================================

  /**
   * Get list of messaging conversations.
   */
  async getMessages(): Promise<LinkedInMessage[]> {
    await this.cdp.navigate(LINKEDIN_URLS.messaging, 5000);

    // Wait for messaging UI to load
    // TODO: verify selector live — messaging container
    await this.cdp.waitForSelector(
      '.msg-conversations-container, div[class*="msg-conversations"]',
      8000,
    );

    const threads = await this.cdp.evaluateFunction(SCRAPE_MESSAGING_SCRIPT);
    return threads || [];
  }

  /**
   * Send a message in a specific thread.
   */
  async sendMessage(threadId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(LINKEDIN_URLS.messagingThread(threadId), 5000);

      // TODO: verify selector live — message compose input
      const msgInput = '.msg-form__contenteditable[contenteditable="true"], div[role="textbox"][aria-label*="Write a message"]';
      const found = await this.cdp.waitForSelector(msgInput, 5000);
      if (!found) throw new Error('Message input not found');

      await this.cdp.click(msgInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(msgInput, text);
      await this.cdp.wait(500);

      // Click send button
      // TODO: verify selector live — send message button
      const sent = await this.cdp.evaluate(`
        (() => {
          const sendBtn = document.querySelector(
            'button[class*="msg-form__send-button"], ' +
            'button[aria-label="Send"], ' +
            'button.msg-form__send-button'
          );
          if (sendBtn) { sendBtn.click(); return true; }
          return false;
        })()
      `);

      if (!sent) {
        // Fallback: press Enter
        await this.cdp.pressKey('Enter');
      }

      await this.cdp.wait(1000);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a new message to a LinkedIn user (not existing thread).
   * Opens the messaging overlay from the user's profile.
   */
  async sendNewMessage(profileUrl: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(profileUrl, 4000);

      // Click "Message" button on profile
      // TODO: verify selector live — Message button on profile page
      const messageClicked = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button, a');
          for (const btn of btns) {
            const text = btn.textContent?.trim() || '';
            const label = btn.getAttribute('aria-label') || '';
            if (text === 'Message' || label.includes('Message')) {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (!messageClicked) throw new Error('Message button not found on profile');

      await this.cdp.wait(2000);

      // Type message in the overlay
      const msgInput = '.msg-form__contenteditable[contenteditable="true"], div[role="textbox"]';
      const found = await this.cdp.waitForSelector(msgInput, 5000);
      if (!found) throw new Error('Message input not found in overlay');

      await this.cdp.click(msgInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(msgInput, text);
      await this.cdp.wait(500);

      // Send
      await this.cdp.evaluate(`
        (() => {
          const sendBtn = document.querySelector(
            'button[class*="msg-form__send-button"], ' +
            'button[aria-label="Send"]'
          );
          if (sendBtn) sendBtn.click();
        })()
      `);

      await this.cdp.wait(1000);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // 6. PROFILE SCRAPE
  // =============================================

  /**
   * Get profile information for a LinkedIn user.
   */
  async getProfile(username?: string): Promise<LinkedInProfile | null> {
    const user = username || this.username;
    if (!user) throw new Error('Username required');

    await this.cdp.navigate(LINKEDIN_URLS.profile(user), 5000);

    // Scroll to load full profile
    await this.cdp.scrollDown(500);
    await this.cdp.wait(1000);

    const profile = await this.cdp.evaluateFunction(SCRAPE_PROFILE_SCRIPT);
    if (!profile) return null;

    return {
      name: profile.name || '',
      headline: profile.headline || '',
      about: profile.about || '',
      location: profile.location || '',
      connections: profile.connections || 0,
      followers: profile.followers || 0,
      profile_url: profile.profile_url || LINKEDIN_URLS.profile(user),
      profile_pic_url: profile.profile_pic_url || '',
      current_company: profile.current_company || '',
      current_role: profile.current_role || '',
      education: profile.education || '',
    };
  }

  // =============================================
  // 7. ENGAGEMENT ACTIONS
  // =============================================

  /**
   * Like a post (default reaction).
   */
  async likePost(postUrl: string): Promise<boolean> {
    await this.cdp.navigate(postUrl, 4000);

    // TODO: verify selector live — like/react button on post
    return this.cdp.evaluate(`
      (() => {
        const likeBtn = document.querySelector(
          'button[aria-label*="Like"], ' +
          'button[class*="react-button"], ' +
          'button[class*="social-actions-button"][aria-pressed="false"]'
        );
        if (likeBtn) {
          const pressed = likeBtn.getAttribute('aria-pressed');
          if (pressed !== 'true') {
            likeBtn.click(); return true;
          }
        }
        return false;
      })()
    `);
  }

  /**
   * Comment on a post.
   */
  async commentOnPost(postUrl: string, text: string): Promise<boolean> {
    try {
      await this.cdp.navigate(postUrl, 4000);

      // Click "Comment" button to open comment section
      // TODO: verify selector live
      await this.cdp.evaluate(`
        (() => {
          const commentBtn = document.querySelector(
            'button[aria-label*="Comment"], ' +
            'button[class*="comment-button"]'
          );
          if (commentBtn) commentBtn.click();
        })()
      `);
      await this.cdp.wait(1500);

      // Type comment
      const commentInput = '.ql-editor[data-placeholder], div[contenteditable="true"][role="textbox"]';
      const found = await this.cdp.waitForSelector(commentInput, 5000);
      if (!found) return false;

      await this.cdp.click(commentInput);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(commentInput, text);
      await this.cdp.wait(500);

      // Submit comment
      const posted = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll(
            'button[class*="comments-comment-box__submit-button"], ' +
            'button.artdeco-button--primary'
          );
          for (const btn of btns) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text === 'post' || text === 'comment' || text === 'submit') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      await this.cdp.wait(2000);
      return !!posted;
    } catch {
      return false;
    }
  }

  /**
   * Connect with a user (send connection request).
   */
  async connectWithUser(profileUrl: string, note?: string): Promise<boolean> {
    await this.cdp.navigate(profileUrl, 4000);

    // TODO: verify selector live — Connect button on profile
    const connectClicked = await this.cdp.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          const text = btn.textContent?.trim() || '';
          const label = btn.getAttribute('aria-label') || '';
          if (text === 'Connect' || label.includes('Connect')) {
            btn.click(); return true;
          }
        }
        return false;
      })()
    `);

    if (!connectClicked) return false;

    await this.cdp.wait(1500);

    // If a note is provided, click "Add a note" and type it
    if (note) {
      // TODO: verify selector live — "Add a note" button in connection modal
      const addNoteClicked = await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Add a note') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);

      if (addNoteClicked) {
        await this.cdp.wait(1000);
        const noteInput = 'textarea[name="message"], textarea#custom-message';
        if (await this.cdp.exists(noteInput)) {
          await this.cdp.fillInput(noteInput, note);
        }
      }
    }

    // Click "Send" to confirm connection
    // TODO: verify selector live
    await this.cdp.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          const text = btn.textContent?.trim() || '';
          const label = btn.getAttribute('aria-label') || '';
          if (text === 'Send' || text === 'Send now' || label.includes('Send')) {
            btn.click(); return true;
          }
        }
        return false;
      })()
    `);

    await this.cdp.wait(1500);
    return true;
  }

  /**
   * Follow a LinkedIn user (without connecting).
   */
  async followUser(profileUrl: string): Promise<boolean> {
    await this.cdp.navigate(profileUrl, 4000);

    // TODO: verify selector live — Follow button (may be in "More" dropdown)
    return this.cdp.evaluate(`
      (() => {
        // Try direct Follow button first
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          const text = btn.textContent?.trim() || '';
          if (text === 'Follow') {
            btn.click(); return true;
          }
        }
        // Try "More" dropdown → Follow
        const moreBtn = document.querySelector('button[aria-label*="More actions"], button[class*="pvs-overflow-actions"]');
        if (moreBtn) {
          moreBtn.click();
          setTimeout(() => {
            const items = document.querySelectorAll('div[role="option"], li[role="option"]');
            for (const item of items) {
              if (item.textContent?.includes('Follow')) {
                item.click(); return;
              }
            }
          }, 500);
          return true;
        }
        return false;
      })()
    `);
  }

  // =============================================
  // 8. SESSION CHECK
  // =============================================

  /**
   * Check if the current browser session is logged into LinkedIn.
   */
  async checkSession(): Promise<{ loggedIn: boolean; username?: string }> {
    await this.cdp.navigate(LINKEDIN_URLS.feed, 5000);

    const sessionData = await this.cdp.evaluate(`
      (() => {
        // Check for nav profile link (visible when logged in)
        const navProfile = document.querySelector(
          'a[href*="/in/"][class*="global-nav__me"], ' +
          'img[class*="global-nav__me-photo"], ' +
          'a[href*="/in/me/"]'
        );
        if (navProfile) {
          const href = navProfile.getAttribute('href') || '';
          const match = href.match(/\\/in\\/([^\\/\\?]+)/);
          return match ? match[1] : 'logged_in';
        }

        // Check for feed composer (only visible when logged in)
        const composer = document.querySelector(
          '.share-box-feed-entry__trigger, ' +
          'button[aria-label*="Start a post"]'
        );
        if (composer) return 'logged_in';

        // Check for login page indicators
        const loginForm = document.querySelector(
          'input[name="session_key"], ' +
          'form[class*="login"]'
        );
        if (loginForm) return '';

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

export default LinkedInPlatformAdapter;
