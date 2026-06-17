import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Permission } from '@vendure/core';

import { DiagnosticsService } from '../services/diagnostics.service';
import { DiagnosticResult } from '../types';

@Resolver()
export class DiagnosticsAdminResolver {
    constructor(private diagnosticsService: DiagnosticsService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async diagnostic(): Promise<DiagnosticResult> {
        return this.diagnosticsService.getDiagnostic();
    }
}
