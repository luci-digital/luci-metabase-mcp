import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Deployment } from './Deployment';

/**
 * PleskServer Entity
 * Represents a Plesk-managed server
 */
@Entity('plesk_servers')
export class PleskServer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  hostname: string;

  @Column()
  apiUrl: string;

  @Column({ nullable: true })
  apiKeyId: string; // Reference to Secret entity

  @Column({ default: 'active' })
  status: string; // active, inactive, maintenance, error

  @Column({ nullable: true })
  version: string; // Plesk version

  @Column({ nullable: true })
  osType: string; // ubuntu, debian, centos, etc.

  @Column({ nullable: true })
  osVersion: string;

  @Column({ type: 'json', nullable: true })
  domains: string[]; // List of domains hosted

  @Column({ type: 'json', nullable: true })
  services: Array<{
    name: string;
    status: string;
    version?: string;
  }>;

  @Column({ type: 'datetime', nullable: true })
  lastHealthCheck: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Deployment, deployment => deployment.server)
  deployments: Deployment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
