import { CrmSettingsResolver } from '../api/crm-settings.resolver';
import { CustomerCrmFieldsResolver, CustomerStatusResolver } from '../api/customer-crm.resolver';
import { CustomerGroupCrmFieldsResolver } from '../api/customer-group-crm-fields.resolver';
import { CustomerGroupGuardResolver } from '../api/customer-group-guard.resolver';
import { CustomerNoteGuardResolver } from '../api/customer-note-guard.resolver';
import { GroupAddressResolver } from '../api/group-address.resolver';
import { CrmGroupNoteFieldsResolver, CrmJournalEntryFieldsResolver, GroupNoteResolver } from '../api/group-note.resolver';
import { CustomerGroupHierarchyFieldsResolver, HierarchyResolver } from '../api/hierarchy.resolver';
import { OrderCompanyResolver, OrderCrmFieldsResolver } from '../api/order-company.resolver';
import { CrmTaskFieldsResolver, TaskResolver } from '../api/task.resolver';
import { CrmJournalEntry } from '../entities/crm-journal-entry.entity';
import { CrmNotification } from '../entities/crm-notification.entity';
import { CrmSettings } from '../entities/crm-settings.entity';
import { CrmTask } from '../entities/crm-task.entity';
import { CustomerGroupAddress } from '../entities/customer-group-address.entity';
import { CustomerGroupEdge } from '../entities/customer-group-edge.entity';
import { CustomerGroupNote } from '../entities/customer-group-note.entity';
import { CrmSettingsService } from '../services/crm-settings.service';
import { CustomerMembershipService } from '../services/customer-membership.service';
import { CustomerStatusService } from '../services/customer-status.service';
import { GroupAddressService } from '../services/group-address.service';
import { GroupNoteService } from '../services/group-note.service';
import { GroupSalesService } from '../services/group-sales.service';
import { HierarchyService } from '../services/hierarchy.service';
import { JournalService } from '../services/journal.service';
import { LifecycleService } from '../services/lifecycle.service';
import { MentionService } from '../services/mention.service';
import { MembershipRulesService } from '../services/membership-rules.service';
import { NoteOwnershipService } from '../services/note-ownership.service';
import { NotificationService } from '../services/notification.service';
import { OrderCompanyService } from '../services/order-company.service';
import { TaskService } from '../services/task.service';

/** Everything the CRM plugin registers, grouped so crm.plugin.ts stays a short manifest. */
export const CRM_ENTITIES = [CrmSettings, CustomerGroupEdge, CustomerGroupNote, CrmJournalEntry, CrmTask, CrmNotification, CustomerGroupAddress];

export const CRM_PROVIDERS = [
    CrmSettingsService,
    CustomerStatusService,
    MembershipRulesService,
    NoteOwnershipService,
    HierarchyService,
    CustomerMembershipService,
    JournalService,
    GroupNoteService,
    NotificationService,
    MentionService,
    TaskService,
    LifecycleService,
    OrderCompanyService,
    GroupSalesService,
    GroupAddressService,
];

export const CRM_ADMIN_RESOLVERS = [
    CrmSettingsResolver,
    CustomerCrmFieldsResolver,
    CustomerStatusResolver,
    CustomerGroupCrmFieldsResolver,
    CustomerGroupGuardResolver,
    CustomerNoteGuardResolver,
    HierarchyResolver,
    CustomerGroupHierarchyFieldsResolver,
    GroupNoteResolver,
    CrmGroupNoteFieldsResolver,
    CrmJournalEntryFieldsResolver,
    TaskResolver,
    CrmTaskFieldsResolver,
    OrderCompanyResolver,
    OrderCrmFieldsResolver,
    GroupAddressResolver,
];
