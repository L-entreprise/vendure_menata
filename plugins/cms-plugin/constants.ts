import { CrudPermissionDefinition } from '@vendure/core';

export const contentBlockPermission = new CrudPermissionDefinition('ContentBlock');

export enum ContentBlockType {
    IMAGE = 'IMAGE',
    TEXT = 'TEXT',
}
