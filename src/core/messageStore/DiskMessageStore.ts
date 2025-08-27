import * as fs from 'fs/promises';
import * as path from 'path';
import { Content } from '../../types/common';
import { IMessageStore } from './IMessageStore';

export class DiskMessageStore implements IMessageStore {
  private storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
    this.ensureStorePathExists();
  }

  private async ensureStorePathExists(): Promise<void> {
    try {
      await fs.mkdir(this.storePath, { recursive: true });
    } catch (error) {
      console.error(`Failed to create message store directory at ${this.storePath}:`, error);
    }
  }

  private getUserHistoryFilePath(userId: string): string {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storePath, `${safeUserId}.json`);
  }

  async getHistory(userId: string): Promise<Content[]> {
    const filePath = this.getUserHistoryFilePath(userId);
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent) as Content[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      console.error(`Error reading history for user ${userId} from ${filePath}:`, error);
      return [];
    }
  }

  async addInteraction(userId: string, userContent: Content, modelContent: Content): Promise<void> {
    const filePath = this.getUserHistoryFilePath(userId);
    let history = await this.getHistory(userId);
    
    history.push(userContent);
    history.push(modelContent);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing history for user ${userId} to ${filePath}:`, error);
    }
  }

  async clearHistory(userId: string): Promise<void> {
    const filePath = this.getUserHistoryFilePath(userId);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      console.error(`Error deleting history for user ${userId} at ${filePath}:`, error);
    }
  }
}