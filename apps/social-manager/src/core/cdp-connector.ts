/**
 * Chrome DevTools Protocol Connector
 *
 * Kết nối với Chrome browser thật qua CDP.
 * Quản lý tabs, navigate, evaluate scripts, click, type.
 * Dùng chung cho tất cả platform adapters.
 */

import CDP from 'chrome-remote-interface';

export interface CDPConfig {
  host: string;
  port: number;
}

export interface PageInfo {
  id: string;
  url: string;
  title: string;
}

export class CDPConnector {
  private config: CDPConfig;
  private client: any = null;
  private connected = false;

  constructor(config?: Partial<CDPConfig>) {
    this.config = {
      host: config?.host || process.env.CHROME_HOST || 'localhost',
      port: config?.port || parseInt(process.env.CHROME_DEBUG_PORT || '9222', 10),
    };
  }

  // =============================================
  // CONNECTION
  // =============================================

  async connect(): Promise<void> {
    try {
      this.client = await CDP({
        host: this.config.host,
        port: this.config.port,
      });
      await this.client.Page.enable();
      await this.client.Runtime.enable();
      await this.client.DOM.enable();
      await this.client.Network.enable();
      this.connected = true;
      console.log(`[CDP] Connected to Chrome at ${this.config.host}:${this.config.port}`);
    } catch (error: any) {
      this.connected = false;
      throw new Error(`Cannot connect to Chrome: ${error.message}. Is Chrome running with --remote-debugging-port=${this.config.port}?`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      console.log('[CDP] Disconnected from Chrome');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // =============================================
  // NAVIGATION
  // =============================================

  async navigate(url: string, waitMs = 3000): Promise<void> {
    this.ensureConnected();
    await this.client.Page.navigate({ url });
    await this.client.Page.loadEventFired();
    if (waitMs > 0) await this.wait(waitMs);
  }

  async getCurrentUrl(): Promise<string> {
    this.ensureConnected();
    const result = await this.evaluate('window.location.href');
    return result;
  }

  // =============================================
  // JAVASCRIPT EVALUATION
  // =============================================

  async evaluate(expression: string): Promise<any> {
    this.ensureConnected();
    const { result } = await this.client.Runtime.evaluate({
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.subtype === 'error') {
      throw new Error(result.description || 'Script evaluation failed');
    }

    return result.value;
  }

  /**
   * Evaluate a function that returns JSON-serializable data
   * Use this for scraping scripts
   */
  async evaluateFunction(fn: string): Promise<any> {
    const expression = `(${fn})()`;
    const result = await this.evaluate(expression);
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    return result;
  }

  // =============================================
  // DOM INTERACTION
  // =============================================

  async click(selector: string): Promise<void> {
    this.ensureConnected();
    const clicked = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return false;
        el.click();
        return true;
      })()
    `);
    if (!clicked) {
      throw new Error(`Element not found: ${selector}`);
    }
  }

  async type(selector: string, text: string): Promise<void> {
    this.ensureConnected();
    // Focus the element first
    await this.click(selector);
    await this.wait(300);

    // Type character by character using Input.dispatchKeyEvent
    for (const char of text) {
      await this.client.Input.dispatchKeyEvent({
        type: 'keyDown',
        text: char,
      });
      await this.client.Input.dispatchKeyEvent({
        type: 'keyUp',
        text: char,
      });
    }
  }

  /**
   * Type into a contenteditable div (like tweet compose box)
   * Uses insertText command which works better for rich text editors
   */
  async typeIntoRichEditor(selector: string, text: string): Promise<void> {
    this.ensureConnected();
    await this.click(selector);
    await this.wait(300);

    await this.client.Input.insertText({ text });
  }

  async clearInput(selector: string): Promise<void> {
    this.ensureConnected();
    await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          el.textContent = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
  }

  async fillInput(selector: string, value: string): Promise<void> {
    await this.clearInput(selector);
    await this.wait(200);
    await this.click(selector);
    await this.wait(200);

    // For regular inputs
    const isInput = await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      })()
    `);

    if (isInput) {
      await this.evaluate(`
        (() => {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          el.value = '${value.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `);
    } else {
      // Rich text editor
      await this.client.Input.insertText({ text: value });
    }
  }

  async uploadFile(selector: string, filePath: string): Promise<void> {
    this.ensureConnected();
    // Get the file input node
    const { root } = await this.client.DOM.getDocument();
    const { nodeId } = await this.client.DOM.querySelector({
      nodeId: root.nodeId,
      selector,
    });

    if (!nodeId) {
      throw new Error(`File input not found: ${selector}`);
    }

    await this.client.DOM.setFileInputFiles({
      nodeId,
      files: [filePath],
    });
  }

  async pressKey(key: string): Promise<void> {
    this.ensureConnected();
    await this.client.Input.dispatchKeyEvent({
      type: 'keyDown',
      key,
    });
    await this.client.Input.dispatchKeyEvent({
      type: 'keyUp',
      key,
    });
  }

  // =============================================
  // ELEMENT QUERIES
  // =============================================

  async exists(selector: string): Promise<boolean> {
    return this.evaluate(`!!document.querySelector('${selector.replace(/'/g, "\\'")}')`);
  }

  async getText(selector: string): Promise<string> {
    return this.evaluate(`document.querySelector('${selector.replace(/'/g, "\\'")}')?.textContent?.trim() || ''`);
  }

  async getAttribute(selector: string, attr: string): Promise<string> {
    return this.evaluate(`document.querySelector('${selector.replace(/'/g, "\\'")}')?.getAttribute('${attr}') || ''`);
  }

  async waitForSelector(selector: string, timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const found = await this.exists(selector);
      if (found) return true;
      await this.wait(500);
    }
    return false;
  }

  // =============================================
  // SCREENSHOT
  // =============================================

  async screenshot(format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
    this.ensureConnected();
    const { data } = await this.client.Page.captureScreenshot({ format });
    return Buffer.from(data, 'base64');
  }

  // =============================================
  // TABS MANAGEMENT
  // =============================================

  async listTabs(): Promise<PageInfo[]> {
    const targets = await CDP.List({
      host: this.config.host,
      port: this.config.port,
    });
    return targets
      .filter((t: any) => t.type === 'page')
      .map((t: any) => ({ id: t.id, url: t.url, title: t.title }));
  }

  async switchToTab(tabId: string): Promise<void> {
    await CDP.Activate({
      host: this.config.host,
      port: this.config.port,
      id: tabId,
    });
    // Reconnect client to new tab
    await this.disconnect();
    this.client = await CDP({
      host: this.config.host,
      port: this.config.port,
      target: tabId,
    });
    await this.client.Page.enable();
    await this.client.Runtime.enable();
    this.connected = true;
  }

  async newTab(url: string): Promise<string> {
    const target = await CDP.New({
      host: this.config.host,
      port: this.config.port,
      url,
    });
    return target.id;
  }

  async closeTab(tabId: string): Promise<void> {
    await CDP.Close({
      host: this.config.host,
      port: this.config.port,
      id: tabId,
    });
  }

  // =============================================
  // SCROLL
  // =============================================

  async scrollDown(pixels = 500): Promise<void> {
    await this.evaluate(`window.scrollBy(0, ${pixels})`);
    await this.wait(500);
  }

  async scrollToBottom(): Promise<void> {
    await this.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await this.wait(1000);
  }

  // =============================================
  // UTILITIES
  // =============================================

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to Chrome. Call connect() first.');
    }
  }
}

export default CDPConnector;
