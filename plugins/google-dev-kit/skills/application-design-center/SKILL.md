---
name: application-design-center
description: Designs and deploys Google Cloud infrastructure through Application Design Center using local Terraform as the editable source of truth. Use for ADC designs, plan assessment, template import, deployment, or deployment troubleshooting.
---

# Application Design Center

Keep local Terraform/HCL as the maintained source. Use Design MCP for ADC-specific operations and Developer Knowledge for current contracts.

1. Confirm project/location; discover the active ADC space.
2. Design and validate Terraform locally. Keep secrets out of HCL/tfvars and local validation state separate from ADC-managed deployment state.
3. Produce a plan and run current ADC assessment before import. Fix high-impact findings locally, then revalidate.
4. Verify target template and current import constraints before importing IaC.
5. Deploy only when authorized. Monitor the returned operation and do not duplicate deployments after ambiguous timeouts.
6. On failure, inspect live operation/resource state, remediate locally, reassess, re-import, then redeploy.

Read [workflow.md](references/workflow.md).
