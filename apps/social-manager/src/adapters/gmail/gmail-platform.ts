/**
 * Gmail Platform Adapter — Tested & Verified
 *
 * Tested live on Chrome DevTools 2026-03-31
 * Account: staff@operis.vn
 *
 * ✅ Inbox scrape: sender, subject, snippet, date, unread — 50 emails
 * ✅ Compose: To, Subject, Body, Send button found
 * ✅ Read email content
 */

import { CDPConnector } from '../../core/cdp-connector';

// =============================================
// TYPES
// =============================================

export interface GmailEmail {
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

export interface GmailComposeData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: string[]; // local file paths
}

// =============================================
// SCRAPE SCRIPTS (tested live ✅)
// =============================================

/** Scrape Gmail inbox — tested ✅ returns sender, subject, snippet, date, unread */
export const SCRAPE_INBOX_SCRIPT = `() => {
  const rows = document.querySelectorAll('tr[jscontroller]');
  const emails = [];
  rows.forEach((row, idx) => {
    const sender = row.querySelector('.yW span, .zF')?.textContent?.trim() ||
                   row.querySelector('[email]')?.getAttribute('name') || '';
    const subject = row.querySelector('.bog .bqe, .y6 span:first-child')?.textContent?.trim() || '';
    const snippet = row.querySelector('.y2')?.textContent?.trim() || '';
    const date = row.querySelector('.xW span, .a2')?.textContent?.trim() || '';
    const unread = row.classList.contains('zE') || !!row.querySelector('.zE');
    if (sender || subject) {
      emails.push({ sender, subject: subject.substring(0, 100), snippet: snippet.substring(0, 150), date, unread });
    }
  });
  return emails;
}`;

/** Scrape opened email content */
export const SCRAPE_EMAIL_CONTENT_SCRIPT = `() => {
  const subject = document.querySelector('h2[data-thread-perm-id], .hP')?.textContent?.trim() || '';
  const sender = document.querySelector('.gD')?.textContent?.trim() || '';
  const senderEmail = document.querySelector('.gD')?.getAttribute('email') || '';
  const date = document.querySelector('.g3')?.textContent?.trim() || '';
  const body = document.querySelector('.a3s, .ii')?.innerText?.trim() || '';
  const attachments = [];
  document.querySelectorAll('.aZo .aV3').forEach(a => {
    attachments.push(a.textContent?.trim());
  });
  return { subject, sender, senderEmail, date, body: body.substring(0, 3000), attachments };
}`;

// =============================================
// URLS
// =============================================

export const GMAIL_URLS = {
  inbox: 'https://mail.google.com/mail/u/0/#inbox',
  sent: 'https://mail.google.com/mail/u/0/#sent',
  drafts: 'https://mail.google.com/mail/u/0/#drafts',
  starred: 'https://mail.google.com/mail/u/0/#starred',
  trash: 'https://mail.google.com/mail/u/0/#trash',
  search: (query: string) => `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`,
  compose: 'https://mail.google.com/mail/u/0/#inbox?compose=new',
};

// =============================================
// ADAPTER CLASS
// =============================================

export class GmailPlatformAdapter {
  private cdp: CDPConnector;

  constructor(cdp: CDPConnector) {
    this.cdp = cdp;
  }

  /**
   * Get inbox emails
   */
  async getInbox(limit = 50): Promise<{ emails: GmailEmail[]; total_unread: number; scraped_at: string }> {
    await this.cdp.navigate(GMAIL_URLS.inbox, 5000);
    const emails = await this.cdp.evaluateFunction(SCRAPE_INBOX_SCRIPT);
    const unreadCount = (emails || []).filter((e: any) => e.unread).length;
    return {
      emails: (emails || []).slice(0, limit),
      total_unread: unreadCount,
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Search emails
   */
  async searchEmails(query: string, limit = 20): Promise<{ emails: GmailEmail[]; scraped_at: string }> {
    await this.cdp.navigate(GMAIL_URLS.search(query), 5000);
    const emails = await this.cdp.evaluateFunction(SCRAPE_INBOX_SCRIPT);
    return {
      emails: (emails || []).slice(0, limit),
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Read a specific email — click on it and scrape content
   */
  async readEmail(index: number): Promise<any> {
    // Click on the email row by index
    await this.cdp.evaluate(`
      (() => {
        const rows = document.querySelectorAll('tr[jscontroller]');
        if (rows[${index}]) { rows[${index}].click(); return true; }
        return false;
      })()
    `);
    await this.cdp.wait(2000);
    return this.cdp.evaluateFunction(SCRAPE_EMAIL_CONTENT_SCRIPT);
  }

  /**
   * Send an email
   * Hub provides to, subject, body (already AI-generated if needed)
   */
  async sendEmail(data: GmailComposeData): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cdp.navigate(GMAIL_URLS.inbox, 5000);

      // Click compose button
      await this.cdp.evaluate(`
        (() => {
          const btn = document.querySelector('[gh="cm"], .T-I.T-I-KE');
          if (btn) { btn.click(); return true; }
          return false;
        })()
      `);
      await this.cdp.wait(1500);

      // Fill To
      const toField = '[aria-label="Đến"], [aria-label="To"], input[name="to"]';
      await this.cdp.click(toField);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(toField, data.to);
      await this.cdp.pressKey('Tab');
      await this.cdp.wait(500);

      // Fill Subject
      await this.cdp.fillInput('input[name="subjectbox"]', data.subject);
      await this.cdp.wait(300);

      // Fill Body
      const bodyField = '[aria-label="Nội dung thư"], [aria-label="Message Body"]';
      await this.cdp.click(bodyField);
      await this.cdp.wait(300);
      await this.cdp.typeIntoRichEditor(bodyField, data.body);
      await this.cdp.wait(500);

      // Upload attachments if any
      if (data.attachments && data.attachments.length > 0) {
        for (const filePath of data.attachments) {
          // Click attach button
          await this.cdp.evaluate(`
            (() => {
              const btn = document.querySelector('[aria-label*="Đính kèm"], [aria-label*="Attach"]');
              if (btn) btn.click();
            })()
          `);
          await this.cdp.wait(1000);
          await this.cdp.uploadFile('input[type="file"]', filePath);
          await this.cdp.wait(2000);
        }
      }

      // Click Send
      await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('[role="button"]');
          for (const btn of btns) {
            const label = btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || '';
            if (label === 'Gửi' || label === 'Send (⌘Enter)' || label === 'Send') {
              btn.click(); return true;
            }
          }
          return false;
        })()
      `);
      await this.cdp.wait(2000);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Reply to an email (must have email open first)
   */
  async replyEmail(replyText: string): Promise<{ success: boolean }> {
    try {
      // Click Reply button
      await this.cdp.evaluate(`
        (() => {
          const btn = document.querySelector('[aria-label*="Trả lời"], [aria-label*="Reply"]');
          if (btn) { btn.click(); return true; }
          return false;
        })()
      `);
      await this.cdp.wait(1500);

      // Type reply
      const bodyField = '[aria-label="Nội dung thư"], [aria-label="Message Body"], [g_editable="true"]';
      await this.cdp.click(bodyField);
      await this.cdp.typeIntoRichEditor(bodyField, replyText);
      await this.cdp.wait(500);

      // Click Send
      await this.cdp.evaluate(`
        (() => {
          const btns = document.querySelectorAll('[role="button"]');
          for (const btn of btns) {
            const label = btn.getAttribute('aria-label') || '';
            if (label === 'Gửi' || label === 'Send') { btn.click(); return true; }
          }
          return false;
        })()
      `);
      await this.cdp.wait(2000);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    await this.cdp.navigate(GMAIL_URLS.inbox, 5000);
    return this.cdp.evaluate(`
      (() => {
        const badge = document.querySelector('.aim .bsU');
        return badge ? parseInt(badge.textContent) || 0 : 0;
      })()
    `);
  }

  /**
   * Star/Unstar an email
   */
  async starEmail(index: number): Promise<boolean> {
    return this.cdp.evaluate(`
      (() => {
        const stars = document.querySelectorAll('.T-KT');
        if (stars[${index}]) { stars[${index}].click(); return true; }
        return false;
      })()
    `);
  }

  /**
   * Check session
   */
  async checkSession(): Promise<{ loggedIn: boolean; email?: string }> {
    await this.cdp.navigate(GMAIL_URLS.inbox, 8000);
    const loggedIn = await this.cdp.evaluate(`
      !!document.querySelector('[gh="cm"]') || !!document.querySelector('.T-I.T-I-KE')
    `);
    const email = await this.cdp.evaluate(`
      document.querySelector('[data-email]')?.getAttribute('data-email') || ''
    `);
    return { loggedIn, email };
  }
}

export default GmailPlatformAdapter;
