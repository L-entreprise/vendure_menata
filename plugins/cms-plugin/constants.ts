import { CrudPermissionDefinition } from '@vendure/core';

export const contentBlockPermission = new CrudPermissionDefinition('ContentBlock');
export const cmsPagePermission = new CrudPermissionDefinition('CmsPage');

export enum ContentBlockType {
    TEXT_SHORT = 'TEXT_SHORT',
    TEXT_LONG = 'TEXT_LONG',
    RICH_TEXT = 'RICH_TEXT',
    BOOLEAN = 'BOOLEAN',
    ENUM = 'ENUM',
    IMAGE = 'IMAGE',
    IMAGE_GALLERY = 'IMAGE_GALLERY',
    DATE = 'DATE',
    NUMBER = 'NUMBER',
}
