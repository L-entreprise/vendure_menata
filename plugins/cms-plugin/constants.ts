import { CrudPermissionDefinition } from '@vendure/core';

export const contentBlockPermission = new CrudPermissionDefinition('ContentBlock');
export const cmsPagePermission = new CrudPermissionDefinition('CmsPage');

export enum ContentBlockType {
    IMAGE = 'IMAGE',
    TEXT = 'TEXT',
    RICH_TEXT = 'RICH_TEXT',
    DATE = 'DATE',
    NUMBER = 'NUMBER',
}
