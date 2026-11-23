import { Exclude } from 'class-transformer';
import { INSIGHTS_MAP } from '../insights/insight-objects';
import {
  AfterLoad,
  BaseEntity,
  Column,
  Entity,
  Index,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DesktopNotifModel } from '../notification/desktop-notif.entity';
import { QueueModel } from '../queue/queue.entity';
import { EventModel } from './event-model.entity';
import { UserCourseModel } from './user-course.entity';
import { AlertModel } from '../alerts/alerts.entity';

// NOTE: emails are unique only among legacy rows (no Keycloak sub); a Keycloak user may share an email with one
@Index('IDX_user_model_email_legacy', ['email'], {
  unique: true,
  where: '"keycloakSub" IS NULL',
})
@Entity('user_model')
export class UserModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  email: string;

  // The user's Northeastern ID, from the Keycloak token's `nuid` claim. Null
  // for users created by the Khoury Admin Portal login, or whose token has none.
  // Excluded from responses: it's a student ID, and users are serialized into
  // responses other users see (queues, staff lists).
  @Column('text', { nullable: true })
  @Exclude()
  nuid: string | null;

  // The user's permanent Keycloak ID (the ID token's `sub`). Null for users
  // created by the Khoury Admin Portal login, which are not linked to Keycloak.
  @Index('IDX_user_model_keycloakSub', { unique: true })
  @Column('text', { nullable: true })
  @Exclude()
  keycloakSub: string | null;

  @Column('text', { nullable: true })
  firstName: string;

  @Column('text', { nullable: true })
  lastName: string;

  @Column('text', { nullable: true })
  photoURL: string | null;

  @Column('text', { nullable: true })
  defaultMessage: string | null;

  @Column({ type: 'boolean', default: true })
  includeDefaultMessage: boolean;

  @OneToMany((type) => UserCourseModel, (ucm) => ucm.user)
  @Exclude()
  courses: UserCourseModel[];

  @Column({ type: 'boolean', default: false })
  @Exclude()
  desktopNotifsEnabled: boolean; // Does user want notifications sent to their desktops?

  @OneToMany((type) => DesktopNotifModel, (notif) => notif.user)
  @Exclude()
  desktopNotifs: DesktopNotifModel[];

  @Exclude()
  @ManyToMany((type) => QueueModel, (queue) => queue.staffList)
  queues: QueueModel[];

  @Exclude()
  @OneToMany((type) => EventModel, (event) => event.user)
  events: EventModel[];

  @OneToMany((type) => AlertModel, (alert) => alert.user)
  alerts: AlertModel[];

  @Exclude()
  @Column({ type: 'simple-array', nullable: true })
  hideInsights: string[];

  insights: string[];

  @AfterLoad()
  computeInsights(): void {
    let hideInsights = this.hideInsights;
    if (!hideInsights) {
      hideInsights = [];
    }
    const insightNames = Object.keys(INSIGHTS_MAP);
    this.insights = insightNames.filter((name) => !hideInsights.includes(name));
  }

  name: string;

  @AfterLoad()
  setFullNames(): void {
    this.name = this.firstName + ' ' + this.lastName;
  }

  // Used by the admin panel to label this user in lists and dropdowns
  toString(): string {
    return `${this.firstName} ${this.lastName} <${this.email}> (#${this.id})`;
  }
}
