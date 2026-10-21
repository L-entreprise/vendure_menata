import { Trans, useLingui } from '@lingui/react/macro';
import {
    Card,
    CardContent,
    CardHeader,
    DetailFormGrid,
    FormFieldWrapper,
    Input,
    Switch,
    TranslatableFormFieldWrapper,
} from '@vendure/dashboard';

import { ParentPageSelect } from './cms-parent-page-select';

/**
 * The page's settings (name, slug, key, type switches, parent, site address).
 * Structure, so the page editor shows it in expert mode only.
 */
export function PageSettingsCard({
    form,
    isSuperAdmin,
    pageId,
    childCount,
}: {
    form: any;
    isSuperAdmin: boolean;
    pageId?: string;
    childCount: number;
}) {
    const { t } = useLingui();
    const hasParent = !!form.watch('parentId');
    return (
        <div className="w-full mt-4">
            <Card>
                <CardHeader>
                    <div className="text-lg font-semibold"><Trans>Page Details</Trans></div>
                </CardHeader>
                <CardContent>
                    <DetailFormGrid>
                    <TranslatableFormFieldWrapper
                        control={form.control}
                        name="name"
                        label={t`Name`}
                        render={({ field }) => (
                            <Input {...field} placeholder={t`Page name`} disabled={!isSuperAdmin} />
                        )}
                    />
                    <TranslatableFormFieldWrapper
                        control={form.control}
                        name="slug"
                        label={t`Slug`}
                        render={({ field }) => (
                            <Input {...field} placeholder={t`page-slug`} disabled={!isSuperAdmin} />
                        )}
                    />
                    {isSuperAdmin && (
                    <FormFieldWrapper
                        control={form.control}
                        name="key"
                        label={t`Key`}
                        render={({ field }) => (
                            <Input {...field} placeholder={t`e.g. homepage`} disabled={!isSuperAdmin} />
                        )}
                    />
                    )}
                    <FormFieldWrapper
                        control={form.control}
                        name="enabled"
                        label={t`Enabled`}
                        render={({ field }) => (
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!isSuperAdmin}
                            />
                        )}
                    />
                    <FormFieldWrapper
                        control={form.control}
                        name="acceptsSubmissions"
                        label={t`Accepts Submissions`}
                        render={({ field }) => (
                            <Switch
                                checked={field.value}
                                onCheckedChange={checked => {
                                    field.onChange(checked);
                                    if (checked) (form as any).setValue('isCollection', false, { shouldDirty: true });
                                }}
                                disabled={!isSuperAdmin}
                            />
                        )}
                    />
                    <FormFieldWrapper
                        control={form.control}
                        name={'isCollection' as any}
                        label={t`Collection`}
                        render={({ field }) => (
                            <Switch
                                checked={field.value}
                                onCheckedChange={checked => {
                                    field.onChange(checked);
                                    if (checked) form.setValue('acceptsSubmissions', false, { shouldDirty: true });
                                }}
                                disabled={!isSuperAdmin}
                            />
                        )}
                    />
                    {!hasParent && (
                    <FormFieldWrapper
                        control={form.control}
                        name={'pinnedInSidebar' as any}
                        label={t`Pin to Sidebar`}
                        render={({ field }) => (
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!isSuperAdmin}
                            />
                        )}
                    />
                    )}
                    {(hasParent || form.watch('pinnedInSidebar')) && (
                        <FormFieldWrapper
                            control={form.control}
                            name={'sidebarOrder' as any}
                            label={hasParent ? t`Tab Order` : t`Sidebar Order`}
                            render={({ field }) => (
                                <Input
                                    type="number"
                                    value={field.value ?? 0}
                                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                                    disabled={!isSuperAdmin}
                                    className="w-24"
                                />
                            )}
                        />
                    )}
                    {isSuperAdmin && form.watch('acceptsSubmissions') && (
                        <div>
                            <FormFieldWrapper
                                control={form.control}
                                name={'allowCustomerCreation' as any}
                                label={t`Allow Customer Creation`}
                                render={({ field }) => (
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                <Trans>When enabled, submissions can be converted to customers. Use these block keys:</Trans>{' '}
                                <code>email</code> (<Trans>required</Trans>), <code>firstName</code>, <code>lastName</code>, <code>phone</code>
                            </p>
                        </div>
                    )}
                    {isSuperAdmin && (
                        <div>
                            <FormFieldWrapper
                                control={form.control}
                                name={'parentId' as any}
                                label={t`Parent Page`}
                                render={({ field }) => (
                                    <ParentPageSelect
                                        pageId={pageId}
                                        value={field.value ?? null}
                                        onChange={field.onChange}
                                        disabled={childCount > 0}
                                    />
                                )}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {childCount > 0
                                    ? <Trans>This page has child pages, so it stays at the top level.</Trans>
                                    : <Trans>The page then shows as a tab of its parent. The site address does not change.</Trans>}
                            </p>
                        </div>
                    )}
                    {isSuperAdmin && (
                        <FormFieldWrapper
                            control={form.control}
                            name={'previewUrl' as any}
                            label={t`Address on the Site`}
                            render={({ field }) => (
                                <Input {...field} value={field.value ?? ''} type="url" placeholder="https://" />
                            )}
                        />
                    )}
                    {isSuperAdmin && (
                        <div>
                            <FormFieldWrapper
                                control={form.control}
                                name={'advanced' as any}
                                label={t`Advanced Page`}
                                render={({ field }) => (
                                    <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                                )}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                <Trans>Hidden in simple mode. For pages only the agency edits, such as interface labels.</Trans>
                            </p>
                        </div>
                    )}
                </DetailFormGrid>
                </CardContent>
            </Card>
        </div>
    );
}
