import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { RequestHandler } from '../core/requestHandler';
import { FileMetadata, UploadFileResponse, GetFileResponse, ListFilesResponse } from '../types';

export class FileManager {
  private requestHandler: RequestHandler;
  private fileApiBaseUrl: string;

  constructor(requestHandler: RequestHandler, apiBaseUrl: string) {
    this.requestHandler = requestHandler;
    this.fileApiBaseUrl = apiBaseUrl;
  }

  async uploadFile(
    filePath: string,
    displayName?: string,
    mimeType?: string
  ): Promise<FileMetadata> {
    const resolvedMimeType = mimeType || this.inferMimeType(filePath);
    const fileName = path.basename(filePath);

    const newForm = new FormData();
    const metadataPart = {
        file: {
            displayName: displayName || fileName,
            mime_type: resolvedMimeType,
        }
    };
    newForm.append('metadata', JSON.stringify(metadataPart), { contentType: 'application/json' });
    newForm.append('file', fs.createReadStream(filePath), { 
        filename: path.basename(filePath),
        contentType: resolvedMimeType,
    });

    const uploadUrl = `${this.fileApiBaseUrl}/upload/v1beta/files`;

    const response = await this.requestHandler.request<UploadFileResponse>(
      'POST',
      uploadUrl,
      newForm,
      false,
      true
    ) as UploadFileResponse;
    return response.file;
  }

  private inferMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.txt': return 'text/plain';
      case '.json': return 'application/json';
      case '.pdf': return 'application/pdf';
      case '.jpg': case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      case '.webp': return 'image/webp';
      case '.heic': return 'image/heic';
      case '.heif': return 'image/heif';
      default: return 'application/octet-stream';
    }
  }

  async getFile(fileIdOrName: string): Promise<FileMetadata> {
    const name = fileIdOrName.startsWith('files/') ? fileIdOrName : `files/${fileIdOrName}`;
    const response = await this.requestHandler.request<GetFileResponse>(
      'GET',
      name,
      undefined,
      false
    ) as GetFileResponse;
    return response.file;
  }

  async listFiles(pageSize?: number, pageToken?: string): Promise<ListFilesResponse> {
    let query = 'files';
    const params = new URLSearchParams();
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (pageToken) params.append('pageToken', pageToken);
    if (params.toString()) query += `?${params.toString()}`;

    return this.requestHandler.request<ListFilesResponse>(
      'GET',
      query,
      undefined,
      false
    ) as Promise<ListFilesResponse>;
  }

  async deleteFile(fileIdOrName: string): Promise<void> {
    const name = fileIdOrName.startsWith('files/') ? fileIdOrName : `files/${fileIdOrName}`;
    await this.requestHandler.request<Record<string, never>>(
      'DELETE',
      name,
      undefined,
      false
    );
  }
}