import { gql } from 'graphql-tag';

import { createPluginTestEnvironment } from '../../../deploy/e2e/test-environment';

/** Typed from the shared harness so the type comes from deploy/node_modules, like at runtime. */
type AdminClient = ReturnType<typeof createPluginTestEnvironment>['adminClient'];

export const COMMERCIAL_PASSWORD = 'commercial-test-password';

/** Permissions of a sales rep: everything on customers and groups, nothing on admins or settings. */
export const COMMERCIAL_PERMISSIONS = [
    'ReadCustomer',
    'CreateCustomer',
    'UpdateCustomer',
    'ReadCustomerGroup',
    'CreateCustomerGroup',
    'UpdateCustomerGroup',
    'ReadOrder',
    'CreateOrder',
    'UpdateOrder',
];

const CREATE_ROLE = gql`
    mutation CreateRole($input: CreateRoleInput!) {
        createRole(input: $input) {
            id
        }
    }
`;

const CREATE_ADMINISTRATOR = gql`
    mutation CreateAdministrator($input: CreateAdministratorInput!) {
        createAdministrator(input: $input) {
            id
        }
    }
`;

export const CREATE_CUSTOMER = gql`
    mutation CreateCustomer($input: CreateCustomerInput!) {
        createCustomer(input: $input) {
            ... on Customer {
                id
            }
        }
    }
`;

export const CREATE_CUSTOMER_GROUP = gql`
    mutation CreateCustomerGroup($input: CreateCustomerGroupInput!) {
        createCustomerGroup(input: $input) {
            id
            customFields {
                groupType
                memberScope
            }
        }
    }
`;

export const ADD_CUSTOMERS_TO_GROUP = gql`
    mutation AddCustomersToGroup($customerGroupId: ID!, $customerIds: [ID!]!) {
        addCustomersToGroup(customerGroupId: $customerGroupId, customerIds: $customerIds) {
            id
        }
    }
`;

export const ADD_NOTE_TO_CUSTOMER = gql`
    mutation AddNoteToCustomer($input: AddNoteToCustomerInput!) {
        addNoteToCustomer(input: $input) {
            id
        }
    }
`;

export const UPDATE_CUSTOMER_NOTE = gql`
    mutation UpdateCustomerNote($input: UpdateCustomerNoteInput!) {
        updateCustomerNote(input: $input) {
            id
            data
        }
    }
`;

export const DELETE_CUSTOMER_NOTE = gql`
    mutation DeleteCustomerNote($id: ID!) {
        deleteCustomerNote(id: $id) {
            result
        }
    }
`;

export const CUSTOMER_HISTORY = gql`
    query CustomerHistory($id: ID!) {
        customer(id: $id) {
            history {
                items {
                    id
                    type
                    data
                    administrator {
                        id
                        firstName
                        lastName
                    }
                }
            }
        }
    }
`;

export interface Commercial {
    id: string;
    username: string;
}

/** Creates the "Commercial" role once, then returns a factory for sales rep accounts. */
export async function createCommercialFactory(superAdmin: AdminClient) {
    const { createRole } = await superAdmin.query(CREATE_ROLE, {
        input: {
            code: 'commercial',
            description: 'Commercial',
            permissions: COMMERCIAL_PERMISSIONS,
        },
    });
    return async (firstName: string, lastName: string): Promise<Commercial> => {
        const username = `${firstName.toLowerCase()}@crm.test`;
        const { createAdministrator } = await superAdmin.query(CREATE_ADMINISTRATOR, {
            input: {
                firstName,
                lastName,
                emailAddress: username,
                password: COMMERCIAL_PASSWORD,
                roleIds: [createRole.id],
            },
        });
        return { id: createAdministrator.id, username };
    };
}

export async function createCustomer(client: AdminClient, emailAddress: string): Promise<string> {
    const { createCustomer } = await client.query(CREATE_CUSTOMER, {
        input: { emailAddress, firstName: 'Test', lastName: emailAddress.split('@')[0] },
    });
    return createCustomer.id;
}

export const CRM_GROUP_FIELDS = gql`
    query CrmGroupFields($options: CustomerGroupListOptions) {
        customerGroups(options: $options) {
            items {
                id
                crmGroupType
                crmMemberScope
            }
        }
    }
`;
