import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { SyncLog } from './SyncLog';
import { Deployment } from './Deployment';

/**
 * Device Entity
 * Represents a synced device in the network
 */
@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  deviceId: string;

  @Column()
  hostname: string;

  @Column()
  platform: string; // macos, linux, windows

  @Column({ nullable: true })
  arch: string; // x64, arm64

  @Column({ nullable: true })
  syncUrl: string;

  @Column({ nullable: true })
  webhookSecret: string;

  @Column({ default: 'inactive' })
  status: string; // active, inactive, offline, error

  @Column({ type: 'datetime', nullable: true })
  lastSeen: Date;

  @Column({ type: 'datetime', nullable: true })
  lastSync: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => SyncLog, syncLog => syncLog.device)
  syncLogs: SyncLog[];

  @OneToMany(() => Deployment, deployment => deployment.device)
  deployments: Deployment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
