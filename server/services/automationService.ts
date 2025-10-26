/**
 * Automation Service - Agents & Automations (Slackbots, Telegram, Cron)
 */

import { db } from '../db';
import { automationTemplates, automationRuns, type InsertAutomationTemplate, type AutomationTemplate, type InsertAutomationRun, type AutomationRun } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';

export class AutomationService extends EventEmitter {
  /**
   * Create an automation template
   */
  async createTemplate(params: {
    name: string;
    category: string;
    description?: string;
    icon?: string;
    connectorType?: string;
    configSchema: any;
    codeTemplate: string;
    isOfficial?: boolean;
  }): Promise<string> {
    const result = await db.insert(automationTemplates).values({
      name: params.name,
      category: params.category,
      description: params.description,
      icon: params.icon,
      connectorType: params.connectorType,
      configSchema: params.configSchema,
      codeTemplate: params.codeTemplate,
      isOfficial: params.isOfficial || false,
      usageCount: 0,
    }).returning();

    const templateId = result[0].id;
    this.emit('template:created', { templateId, ...params });
    
    return templateId;
  }

  /**
   * Get all automation templates
   */
  async getTemplates(category?: string): Promise<AutomationTemplate[]> {
    if (category) {
      return await db.query.automationTemplates.findMany({
        where: eq(automationTemplates.category, category),
        orderBy: (templates, { desc }) => [desc(templates.usageCount)],
      });
    }

    return await db.query.automationTemplates.findMany({
      orderBy: (templates, { desc }) => [desc(templates.usageCount)],
    });
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<AutomationTemplate | null> {
    const result = await db.query.automationTemplates.findFirst({
      where: eq(automationTemplates.id, templateId),
    });

    return result || null;
  }

  /**
   * Deploy an automation from template
   */
  async deployAutomation(params: {
    userId: string;
    projectId?: string;
    templateId?: string;
    name: string;
    category: string;
    config: any;
  }): Promise<string> {
    const result = await db.insert(automationRuns).values({
      userId: params.userId,
      projectId: params.projectId,
      templateId: params.templateId,
      name: params.name,
      category: params.category,
      config: params.config,
      status: 'active',
      executionCount: 0,
      errorCount: 0,
    }).returning();

    const runId = result[0].id;

    // Increment template usage if from template
    if (params.templateId) {
      await db.update(automationTemplates)
        .set({ usageCount: db.query.automationTemplates.findFirst({ where: eq(automationTemplates.id, params.templateId) }).then(t => (t?.usageCount || 0) + 1) as any })
        .where(eq(automationTemplates.id, params.templateId));
    }

    this.emit('automation:deployed', { runId, ...params });
    
    return runId;
  }

  /**
   * Get user's automation runs
   */
  async getUserAutomations(userId: string): Promise<AutomationRun[]> {
    return await db.query.automationRuns.findMany({
      where: eq(automationRuns.userId, userId),
      orderBy: (runs, { desc }) => [desc(runs.createdAt)],
    });
  }

  /**
   * Get automation run details
   */
  async getAutomationRun(runId: string): Promise<AutomationRun | null> {
    const result = await db.query.automationRuns.findFirst({
      where: eq(automationRuns.id, runId),
    });

    return result || null;
  }

  /**
   * Update automation status
   */
  async updateAutomationStatus(runId: string, status: string): Promise<void> {
    await db.update(automationRuns)
      .set({ status })
      .where(eq(automationRuns.id, runId));

    this.emit('automation:status_changed', { runId, status });
  }

  /**
   * Record automation execution
   */
  async recordExecution(runId: string, success: boolean): Promise<void> {
    const run = await this.getAutomationRun(runId);
    if (!run) return;

    await db.update(automationRuns)
      .set({
        lastRunAt: new Date(),
        executionCount: (run.executionCount || 0) + 1,
        errorCount: success ? (run.errorCount || 0) : (run.errorCount || 0) + 1,
      })
      .where(eq(automationRuns.id, runId));

    this.emit('automation:executed', { runId, success });
  }

  /**
   * Set deployment URL for automation
   */
  async setDeploymentUrl(runId: string, deploymentUrl: string): Promise<void> {
    await db.update(automationRuns)
      .set({ deploymentUrl })
      .where(eq(automationRuns.id, runId));

    this.emit('automation:deployed_url', { runId, deploymentUrl });
  }

  /**
   * Seed official automation templates
   */
  async seedOfficialTemplates(): Promise<void> {
    const templates = [
      {
        name: 'Slack Research Bot',
        category: 'slackbot',
        description: 'Answer research questions in Slack using Perplexity API',
        icon: 'MessageSquare',
        connectorType: 'slack',
        configSchema: {
          slackToken: { type: 'string', required: true },
          perplexityApiKey: { type: 'string', required: true },
          channelId: { type: 'string', required: true },
        },
        codeTemplate: `// Slack Research Bot
import { WebClient } from '@slack/web-api';
import { Perplexity } from 'perplexity-sdk';

const slack = new WebClient(process.env.SLACK_TOKEN);
const perplexity = new Perplexity(process.env.PERPLEXITY_API_KEY);

slack.on('message', async (event) => {
  if (event.channel === process.env.CHANNEL_ID && event.text) {
    const answer = await perplexity.query(event.text);
    await slack.chat.postMessage({
      channel: event.channel,
      text: answer,
    });
  }
});`,
        isOfficial: true,
      },
      {
        name: 'Telegram Scheduler Bot',
        category: 'telegram',
        description: 'Schedule emails via Telegram and Outlook calendar',
        icon: 'Calendar',
        connectorType: 'telegram',
        configSchema: {
          telegramToken: { type: 'string', required: true },
          outlookClientId: { type: 'string', required: true },
          outlookClientSecret: { type: 'string', required: true },
        },
        codeTemplate: `// Telegram Scheduler Bot
import TelegramBot from 'node-telegram-bot-api';
import { OutlookClient } from 'outlook-sdk';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const outlook = new OutlookClient({
  clientId: process.env.OUTLOOK_CLIENT_ID,
  clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
});

bot.onText(/\\/schedule (.+)/, async (msg, match) => {
  const text = match[1];
  // Parse and schedule
  await outlook.calendar.createEvent({
    subject: text,
    start: new Date(),
  });
  bot.sendMessage(msg.chat.id, 'Scheduled!');
});`,
        isOfficial: true,
      },
      {
        name: 'Daily Linear Tasks Summary',
        category: 'scheduled',
        description: 'Send daily summary of Linear tasks via email',
        icon: 'Clock',
        connectorType: 'linear',
        configSchema: {
          linearApiKey: { type: 'string', required: true },
          emailRecipient: { type: 'string', required: true },
          schedule: { type: 'string', default: '0 9 * * *' }, // 9 AM daily
        },
        codeTemplate: `// Daily Linear Summary
import { LinearClient } from '@linear/sdk';
import nodemailer from 'nodemailer';

const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

export async function handler() {
  const tasks = await linear.issues({ filter: { assignee: { id: { eq: 'me' } } } });
  
  const summary = tasks.nodes.map(t => 
    \`- [\${t.state.name}] \${t.title}\`
  ).join('\\n');

  const transport = nodemailer.createTransport(/* config */);
  await transport.sendMail({
    to: process.env.EMAIL_RECIPIENT,
    subject: 'Daily Linear Tasks',
    text: summary,
  });
}`,
        isOfficial: true,
      },
    ];

    for (const template of templates) {
      await this.createTemplate(template);
    }

    console.log(`[AUTOMATION] Seeded ${templates.length} official automation templates`);
  }
}

// Export singleton instance
export const automationService = new AutomationService();
