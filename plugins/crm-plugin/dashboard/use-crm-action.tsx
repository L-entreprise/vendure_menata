import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from './use-crm-settings';

/**
 * Runs a CRM mutation with one pending flag, a success toast, the server's own error
 * message on failure (our rules explain themselves), then refreshes every query.
 */
export function useCrmAction() {
    const queryClient = useQueryClient();
    const [pending, setPending] = useState(false);

    const run = async (action: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
        setPending(true);
        try {
            await action();
            await queryClient.invalidateQueries();
            if (successMessage) {
                toast.success(successMessage);
            }
            return true;
        } catch (error) {
            toast.error(errorMessage(error));
            return false;
        } finally {
            setPending(false);
        }
    };

    return { run, pending };
}
