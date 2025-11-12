import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PleskServer } from './PleskServer';
import { Device } from './Device';

/**
 * Deployment Entity
 * Tracks deployment history
 */
@Entity('deployments')
export class Deployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PleskServer, server => server.deployments)
  @JoinColumn({ name: 'server_id' })
  server: PleskServer;

  @ManyToOne(() => Device, device => device.deployments, { nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column()
  branch: string;

  @Column()
  commit: string;

  @Column()
  deployer: string; // GitHub user or device ID

  @Column({ default: 'pending' })
  status: string; // pending, in_progress, success, failed, rolled_back

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'json', nullable: true })
  lighthouseAuditId: string; // Reference to LighthouseAudit

  @Column({ default: false })
  qualityGatePassed: boolean;

  @Column({ type: 'integer', nullable: true })
  durationMs: number;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'json', nullable: true })
  rollbackInfo: {
    previousCommit?: string;
    rolledBackAt?: string;
    reason?: string;
  };

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;
}
