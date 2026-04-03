/**
 * Self-Healing Selector System
 *
 * Khi MXH thay đổi UI → selectors hỏng → hệ thống tự phát hiện và sửa.
 *
 * Quy trình:
 * 1. Chạy action với selector hiện tại
 * 2. Nếu FAIL → chụp screenshot + lấy DOM snapshot
 * 3. Gửi cho AI phân tích → AI trả selector mới
 * 4. Test selector mới → nếu OK → lưu vào DB
 * 5. Nếu vẫn FAIL → thử fallback selectors → nếu hết → báo admin
 * 6. Health check định kỳ: test tất cả selectors mỗi 6 giờ
 */

// =============================================
// TYPES
// =============================================

export interface SelectorEntry {
  id: string;                    // e.g. "x.compose.textbox"
  platform: string;              // e.g. "x.com"
  purpose: string;               // e.g. "Tweet compose textbox"
  selectors: SelectorChain[];    // Ordered fallback chain
  lastVerified: Date;
  lastFailed?: Date;
  failCount: number;
  status: 'active' | 'degraded' | 'broken';
  history: SelectorChange[];
}

export interface SelectorChain {
  type: 'css' | 'data-testid' | 'aria-label' | 'xpath' | 'text' | 'uid';
  value: string;
  priority: number;              // Lower = try first
  addedAt: Date;
  addedBy: 'manual' | 'ai-healed';
}

export interface SelectorChange {
  date: Date;
  oldSelector: string;
  newSelector: string;
  reason: string;
  healedBy: 'ai' | 'manual';
}

export interface HealingResult {
  success: boolean;
  oldSelector: string;
  newSelector?: string;
  screenshotPath?: string;
  domSnippet?: string;
  error?: string;
}

// =============================================
// SELF-HEALING ENGINE
// =============================================

export class SelfHealingEngine {
  private selectorStore: Map<string, SelectorEntry> = new Map();

  /**
   * Try to find an element using fallback chain
   * Returns the first working selector
   */
  async findElement(
    cdp: any,
    selectorId: string,
  ): Promise<{ found: boolean; selector?: string; element?: any }> {
    const entry = this.selectorStore.get(selectorId);
    if (!entry) {
      return { found: false };
    }

    // Try each selector in priority order
    const sorted = [...entry.selectors].sort((a, b) => a.priority - b.priority);

    for (const sel of sorted) {
      try {
        const exists = await this.testSelector(cdp, sel);
        if (exists) {
          entry.lastVerified = new Date();
          entry.failCount = 0;
          entry.status = 'active';
          return { found: true, selector: sel.value };
        }
      } catch {
        // Try next selector
      }
    }

    // All selectors failed → trigger healing
    entry.failCount++;
    entry.lastFailed = new Date();
    entry.status = entry.failCount >= 3 ? 'broken' : 'degraded';

    return { found: false };
  }

  /**
   * Test if a selector exists on the page
   */
  private async testSelector(cdp: any, sel: SelectorChain): Promise<boolean> {
    switch (sel.type) {
      case 'css':
      case 'data-testid':
        return cdp.evaluate(`!!document.querySelector('${sel.value}')`);
      case 'aria-label':
        return cdp.evaluate(`!!document.querySelector('[aria-label="${sel.value}"]')`);
      case 'xpath':
        return cdp.evaluate(`!!document.evaluate('${sel.value}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`);
      case 'text':
        return cdp.evaluate(`!!Array.from(document.querySelectorAll('*')).find(el => el.textContent?.trim() === '${sel.value}')`);
      default:
        return false;
    }
  }

  /**
   * Attempt to heal a broken selector using AI
   */
  async healSelector(
    cdp: any,
    selectorId: string,
    aiClient: any,
  ): Promise<HealingResult> {
    const entry = this.selectorStore.get(selectorId);
    if (!entry) {
      return { success: false, oldSelector: '', error: 'Selector not found in store' };
    }

    const oldSelector = entry.selectors[0]?.value || '';

    try {
      // Step 1: Take screenshot for visual context
      const screenshot = await cdp.screenshot();

      // Step 2: Get DOM snapshot
      const domSnapshot = await cdp.evaluate(`
        document.querySelector('main')?.innerHTML?.substring(0, 5000) ||
        document.body.innerHTML.substring(0, 5000)
      `);

      // Step 3: Ask AI to find the new selector
      const prompt = `
        I'm automating ${entry.platform}. I need to find the element for: "${entry.purpose}"

        The old CSS selector was: ${oldSelector}
        But it no longer works (element not found on page).

        Here's the current DOM (truncated):
        ${domSnapshot}

        Please analyze and return a new CSS selector that matches this element.
        Return ONLY the selector string, nothing else.
        If you can't find it, return "NOT_FOUND".
      `;

      const aiResponse = await aiClient.complete(prompt);
      const newSelector = aiResponse.trim();

      if (newSelector === 'NOT_FOUND') {
        return {
          success: false,
          oldSelector,
          error: 'AI could not find replacement selector',
          domSnippet: domSnapshot.substring(0, 500),
        };
      }

      // Step 4: Test the new selector
      const works = await cdp.evaluate(`!!document.querySelector('${newSelector}')`);

      if (works) {
        // Step 5: Save new selector
        entry.selectors.unshift({
          type: 'css',
          value: newSelector,
          priority: 0,
          addedAt: new Date(),
          addedBy: 'ai-healed',
        });

        entry.history.push({
          date: new Date(),
          oldSelector,
          newSelector,
          reason: 'Platform UI changed, AI auto-healed',
          healedBy: 'ai',
        });

        entry.status = 'active';
        entry.failCount = 0;
        entry.lastVerified = new Date();

        return { success: true, oldSelector, newSelector };
      }

      return {
        success: false,
        oldSelector,
        error: 'AI suggested selector does not work',
      };
    } catch (error: any) {
      return {
        success: false,
        oldSelector,
        error: error.message,
      };
    }
  }

  /**
   * Health check: test all selectors for a platform
   */
  async healthCheck(cdp: any, platform: string): Promise<{
    total: number;
    active: number;
    degraded: number;
    broken: number;
    details: { id: string; status: string; lastVerified: Date }[];
  }> {
    const results = {
      total: 0,
      active: 0,
      degraded: 0,
      broken: 0,
      details: [] as { id: string; status: string; lastVerified: Date }[],
    };

    for (const [id, entry] of this.selectorStore) {
      if (entry.platform !== platform) continue;

      results.total++;
      const { found } = await this.findElement(cdp, id);

      if (found) {
        results.active++;
        results.details.push({ id, status: 'active', lastVerified: new Date() });
      } else {
        if (entry.failCount >= 3) {
          results.broken++;
          results.details.push({ id, status: 'broken', lastVerified: entry.lastVerified });
        } else {
          results.degraded++;
          results.details.push({ id, status: 'degraded', lastVerified: entry.lastVerified });
        }
      }
    }

    return results;
  }

  /**
   * Register a selector with fallback chain
   */
  registerSelector(entry: SelectorEntry): void {
    this.selectorStore.set(entry.id, entry);
  }

  /**
   * Get all broken selectors (for admin notification)
   */
  getBrokenSelectors(): SelectorEntry[] {
    return Array.from(this.selectorStore.values()).filter(e => e.status === 'broken');
  }
}

// =============================================
// DEFAULT SELECTORS REGISTRY — X.com
// =============================================

export const X_SELECTOR_REGISTRY: SelectorEntry[] = [
  {
    id: 'x.compose.textbox',
    platform: 'x.com',
    purpose: 'Tweet compose textbox',
    selectors: [
      { type: 'data-testid', value: '[data-testid="tweetTextarea_0"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'aria-label', value: '[aria-label="Post text"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'css', value: 'div[role="textbox"][data-contents]', priority: 2, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
  {
    id: 'x.compose.postButton',
    platform: 'x.com',
    purpose: 'Post/Tweet submit button',
    selectors: [
      { type: 'data-testid', value: '[data-testid="tweetButton"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'css', value: 'button[data-testid="tweetButton"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
  {
    id: 'x.tweet.replyButton',
    platform: 'x.com',
    purpose: 'Reply button on a tweet',
    selectors: [
      { type: 'data-testid', value: '[data-testid="reply"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'aria-label', value: 'button[aria-label*="Repl"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
  {
    id: 'x.tweet.likeButton',
    platform: 'x.com',
    purpose: 'Like button on a tweet',
    selectors: [
      { type: 'data-testid', value: '[data-testid="like"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'aria-label', value: 'button[aria-label*="Like"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
  {
    id: 'x.tweet.retweetButton',
    platform: 'x.com',
    purpose: 'Retweet/Repost button on a tweet',
    selectors: [
      { type: 'data-testid', value: '[data-testid="retweet"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'aria-label', value: 'button[aria-label*="repost"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
  {
    id: 'x.profile.editButton',
    platform: 'x.com',
    purpose: 'Edit Profile button',
    selectors: [
      { type: 'css', value: 'a[href="/settings/profile"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'data-testid', value: '[data-testid="editProfileButton"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
  {
    id: 'x.profile.nameInput',
    platform: 'x.com',
    purpose: 'Name input in Edit Profile',
    selectors: [
      { type: 'css', value: 'input[name="displayName"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'aria-label', value: 'input[aria-label="Name"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
  {
    id: 'x.profile.bioInput',
    platform: 'x.com',
    purpose: 'Bio textarea in Edit Profile',
    selectors: [
      { type: 'css', value: 'textarea[name="description"]', priority: 0, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
      { type: 'aria-label', value: 'textarea[aria-label="Bio"]', priority: 1, addedAt: new Date('2026-03-31'), addedBy: 'manual' },
    ],
    lastVerified: new Date('2026-03-31'),
    failCount: 0,
    status: 'active',
    history: [],
  },
];

export default SelfHealingEngine;
