/**
 * Multi-Tenant University & Institution Resolver
 * Dynamically resolves tenant identifiers into full institutional names.
 */

export const TENANT_NAME_MAP: Record<string, string> = {
  UTM: 'Universiti Teknologi Malaysia',
  UM: 'Universiti Malaya',
  USM: 'Universiti Sains Malaysia',
  UKM: 'Universiti Kebangsaan Malaysia',
  UPM: 'Universiti Putra Malaysia',
  // UUID tenant/university bindings
  '00000000-0000-0000-0000-000000000001': 'Universiti Teknologi Malaysia',
  '00000000-0000-0000-0000-000000000002': 'Universiti Malaya',
  '00000000-0000-0000-0000-000000000003': 'Universiti Sains Malaysia',
};

export const resolveUniName = (tenantId?: string | null): string => {
  if (!tenantId) return 'Universiti Teknologi Malaysia';
  return TENANT_NAME_MAP[tenantId] || tenantId;
};

export default resolveUniName;
