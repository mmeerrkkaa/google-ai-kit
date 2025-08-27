import { Content } from '../../types/common';

export interface IMessageStore {
  getHistory(userId: string): Promise<Content[]>;

  addInteraction(userId: string, userContent: Content, modelContent: Content): Promise<void>;

  clearHistory(userId: string): Promise<void>;
}