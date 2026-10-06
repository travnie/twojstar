# ADC workflow

This condenses Google's `application-design-center-design-deploy` skill while moving volatile command syntax behind live docs/MCP.

**Local design:** analyze requirements/code, generate modular Terraform, run formatting/validation/plan. No plaintext secrets; no remote backend solely for scratch validation.

**Assessment:** export the current plan in the format ADC requires, run best-practice assessment, resolve high/critical findings or document trade-offs, then re-plan.

**Template import:** discover active ADC space, verify/create template only when authorized, and fetch current parser constraints before altering HCL.

**Deployment:** use the current Design MCP contract, capture operation/resource identifiers, and do not retry a timeout until state proves the first attempt failed.

**Troubleshooting:** separate local Terraform errors from cloud deployment errors. Apply fixes to local HCL, revalidate/reassess/re-import.

**Verification:** fetch deployed state/outputs and test only endpoints/actions requested by the user.
