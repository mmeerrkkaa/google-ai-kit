import { Content } from '../../types/common';
import { IMessageStore } from './IMessageStore';


export class MemoryMessageStore implements IMessageStore {
  private store: Map<string, Content[]> = new Map();

  async getHistory(userId: string): Promise<Content[]> {
    return this.store.get(userId) || [];
  }

  async addInteraction(userId: string, userContent: Content, modelContent: Content): Promise<void> {
    if (!this.store.has(userId)) {
      this.store.set(userId, []);
    }
    const history = this.store.get(userId)!;
    history.push(userContent);
    history.push(modelContent);
  }

  async clearHistory(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}