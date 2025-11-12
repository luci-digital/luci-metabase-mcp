import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * LighthouseAudit Entity
 * Stores Lighthouse CI audit results
 */
@Entity('lighthouse_audits')
@Index(['url', 'createdAt'])
export class LighthouseAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column()
  branch: string;

  @Column()
  commit: string;

  @Column({ type: 'float' })
  performanceScore: number;

  @Column({ type: 'float' })
  accessibilityScore: number;

  @Column({ type: 'float' })
  bestPracticesScore: number;

  @Column({ type: 'float' })
  seoScore: number;

  @Column({ type: 'integer', nullable: true })
  firstContentfulPaint: number; // ms

  @Column({ type: 'integer', nullable: true })
  largestContentfulPaint: number; // ms

  @Column({ type: 'float', nullable: true })
  cumulativeLayoutShift: number;

  @Column({ type: 'integer', nullable: true })
  totalBlockingTime: number; // ms

  @Column({ type: 'integer', nullable: true })
  speedIndex: number;

  @Column({ default: false })
  passed: boolean;

  @Column({ type: 'json', nullable: true })
  secretsFound: Array<{
    severity: string;
    pattern: string;
    file?: string;
    line?: number;
  }>;

  @Column({ type: 'json', nullable: true })
  vulnerabilities: any[];

  @Column({ type: 'json', nullable: true })
  rawReport: any;

  @CreateDateColumn()
  createdAt: Date;
}
