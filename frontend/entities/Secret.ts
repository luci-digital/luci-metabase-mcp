import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Secret Entity
 * Tracks secrets and their 1Password references
 */
@Entity('secrets')
@Index(['vault', 'item', 'field'], { unique: true })
export class Secret {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  vault: string; // Development, Production, etc.

  @Column()
  item: string; // Item name in 1Password

  @Column()
  field: string; // Field name in item

  @Column()
  type: string; // api_key, password, token, connection_string, etc.

  @Column({ default: false })
  isRotated: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastRotated: Date;

  @Column({ type: 'datetime', nullable: true })
  nextRotation: Date;

  @Column({ type: 'json', nullable: true })
  usedBy: string[]; // List of services using this secret

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
