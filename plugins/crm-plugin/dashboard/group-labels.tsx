import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';

/** Labels for the values of `crmGroupType` / `crmMemberScope` (see ../constants.ts). */
export const GROUP_TYPE_LABELS: Record<string, MessageDescriptor> = {
    company: msg`Company`,
    companyGroup: msg`Group of companies`,
    portfolio: msg`Sales portfolio`,
    segment: msg`Segment`,
    other: msg`Other`,
};

export const MEMBER_SCOPE_LABELS: Record<string, MessageDescriptor> = {
    customers: msg`Customers only`,
    groups: msg`Groups only`,
    both: msg`Customers and groups`,
};
