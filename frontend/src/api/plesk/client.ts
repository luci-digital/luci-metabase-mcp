import axios, { AxiosInstance } from 'axios';
import { getRepository } from '../../../config/database';
import { PleskServer } from '../../../entities/PleskServer';
import { Secret } from '../../../entities/Secret';

/**
 * Plesk API Client
 * Integrates with Plesk XML-RPC API
 */
export class PleskClient {
  private client: AxiosInstance;
  private serverId: string;

  constructor(serverId: string, apiUrl: string, apiKey: string) {
    this.serverId = serverId;
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'HTTP_AUTH_LOGIN': 'admin',
        'HTTP_AUTH_PASSWD': apiKey,
        'Content-Type': 'text/xml',
      },
      timeout: 30000,
    });
  }

  /**
   * Create from database server record
   */
  static async fromDatabase(serverId: string): Promise<PleskClient> {
    const serverRepo = getRepository<PleskServer>(PleskServer);
    const secretRepo = getRepository<Secret>(Secret);

    const server = await serverRepo.findOne({ where: { id: serverId } });
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const secret = await secretRepo.findOne({ where: { id: server.apiKeyId! } });
    if (!secret) {
      throw new Error(`API key not found for server: ${serverId}`);
    }

    // In production, fetch actual secret from 1Password
    const apiKey = process.env.NODE_ENV === 'production'
      ? await this.fetchFrom1Password(secret)
      : process.env.PLESK_API_KEY || '';

    return new PleskClient(serverId, server.apiUrl, apiKey);
  }

  /**
   * Fetch secret from 1Password (integrates with existing system)
   */
  private static async fetchFrom1Password(secret: Secret): Promise<string> {
    const { execSync } = require('child_process');
    const opRef = `op://${secret.vault}/${secret.item}/${secret.field}`;

    try {
      const result = execSync(`op read "${opRef}"`, { encoding: 'utf8' });
      return result.trim();
    } catch (error) {
      throw new Error(`Failed to fetch secret from 1Password: ${error.message}`);
    }
  }

  /**
   * Execute Plesk XML-RPC request
   */
  private async request(packet: string): Promise<any> {
    try {
      const response = await this.client.post('/enterprise/control/agent.php', packet);
      return this.parseXMLResponse(response.data);
    } catch (error) {
      throw new Error(`Plesk API error: ${error.message}`);
    }
  }

  /**
   * Parse XML response (simplified)
   */
  private parseXMLResponse(xml: string): any {
    // In production, use proper XML parser like xml2js
    // This is a simplified version
    return xml;
  }

  /**
   * Get server info
   */
  async getServerInfo(): Promise<any> {
    const packet = `
      <packet>
        <server>
          <get>
            <stat/>
            <gen_info/>
            <prefs/>
          </get>
        </server>
      </packet>
    `;

    return await this.request(packet);
  }

  /**
   * List domains
   */
  async listDomains(): Promise<any[]> {
    const packet = `
      <packet>
        <webspace>
          <get>
            <filter/>
            <dataset>
              <gen_info/>
              <hosting/>
            </dataset>
          </get>
        </webspace>
      </packet>
    `;

    return await this.request(packet);
  }

  /**
   * Deploy site to domain
   */
  async deploySite(domain: string, gitUrl: string, branch: string = 'main'): Promise<any> {
    const packet = `
      <packet>
        <git>
          <deploy>
            <domain>${domain}</domain>
            <repository>${gitUrl}</repository>
            <branch>${branch}</branch>
          </deploy>
        </git>
      </packet>
    `;

    return await this.request(packet);
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<any> {
    const packet = `
      <packet>
        <git>
          <get-info>
            <filter>
              <id>${deploymentId}</id>
            </filter>
          </get-info>
        </git>
      </packet>
    `;

    return await this.request(packet);
  }

  /**
   * Install SSL certificate
   */
  async installSSL(domain: string, certificate: {
    cert: string;
    key: string;
    ca?: string;
  }): Promise<any> {
    const packet = `
      <packet>
        <certificate>
          <install>
            <domain>${domain}</domain>
            <content>
              <crt>${Buffer.from(certificate.cert).toString('base64')}</crt>
              <key>${Buffer.from(certificate.key).toString('base64')}</key>
              ${certificate.ca ? `<ca>${Buffer.from(certificate.ca).toString('base64')}</ca>` : ''}
            </content>
          </install>
        </certificate>
      </packet>
    `;

    return await this.request(packet);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update server status in database
   */
  async updateServerStatus(): Promise<void> {
    const serverRepo = getRepository<PleskServer>(PleskServer);

    const isHealthy = await this.healthCheck();
    const info = isHealthy ? await this.getServerInfo() : null;
    const domains = isHealthy ? await this.listDomains() : [];

    await serverRepo.update(this.serverId, {
      status: isHealthy ? 'active' : 'error',
      lastHealthCheck: new Date(),
      version: info?.version || null,
      domains: domains.map((d: any) => d.name),
      metadata: { lastCheck: new Date().toISOString(), info },
    });
  }
}

/**
 * Get all Plesk servers
 */
export async function getAllPleskServers(): Promise<PleskServer[]> {
  const repo = getRepository<PleskServer>(PleskServer);
  return await repo.find();
}

/**
 * Register new Plesk server
 */
export async function registerPleskServer(data: {
  hostname: string;
  apiUrl: string;
  apiKeyVault: string;
  apiKeyItem: string;
  apiKeyField: string;
}): Promise<PleskServer> {
  const serverRepo = getRepository<PleskServer>(PleskServer);
  const secretRepo = getRepository<Secret>(Secret);

  // Create secret reference
  const secret = secretRepo.create({
    name: `Plesk API Key - ${data.hostname}`,
    vault: data.apiKeyVault,
    item: data.apiKeyItem,
    field: data.apiKeyField,
    type: 'api_key',
  });

  await secretRepo.save(secret);

  // Create server
  const server = serverRepo.create({
    hostname: data.hostname,
    apiUrl: data.apiUrl,
    apiKeyId: secret.id,
    status: 'inactive',
  });

  await serverRepo.save(server);

  // Test connection
  try {
    const client = await PleskClient.fromDatabase(server.id);
    await client.updateServerStatus();
  } catch (error) {
    console.error(`Failed to connect to Plesk server: ${error.message}`);
  }

  return server;
}
