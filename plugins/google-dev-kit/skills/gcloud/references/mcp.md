# Cloud CLI MCP

Server: `googleCloudCli`.

The MCP request's `project` identifies the project used for Cloud CLI Execution API access; it does not replace the target command's own project or billing flags. Keep both scopes explicit when required.

The executing principal is the Google identity used by the server. Apply least privilege and distinguish tool availability from permission to change a resource.
