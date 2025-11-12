import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Device } from './Device';

/**
 * SyncLog Entity
 * Records all sync operations
 */
@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Device, device => device.syncLogs)
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column()
  type: string; // manual, automatic, scheduled, webhook

  @Column()
  status: string; // success, failed, partial

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'json', nullable: true })
  secretsSynced: string[]; // List of secret IDs synced

  @Column({ type: 'integer', default: 0 })
  secretsCount: number;

  @Column({ type: 'integer', nullable: true })
  durationMs: number;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
