# Read-only computer health check

Check the connected device's OS via `get_config`. Collect bounded, read-only measurements: OS/uptime; free storage; disk health if available without elevation; installed/available memory and swap; current CPU/memory-heavy processes; laptop battery **wear** if exposed; startup load; optional updates/network when relevant. Keep commands OS-specific and verify what each metric measures.

- **Windows PowerShell:** `Get-CimInstance Win32_OperatingSystem`, `Get-CimInstance Win32_LogicalDisk`, `Get-PhysicalDisk`, `Get-Process`, `Get-CimInstance Win32_StartupCommand`. `Get-Process CPU` is accumulated CPU time, not current utilization. `Win32_Battery.EstimatedChargeRemaining` is charge, not battery wear; `powercfg /batteryreport` writes a file and is an optional deeper check.
- **macOS:** `sw_vers`, `df -h`, `vm_stat`, `memory_pressure`, `ps`, `pmset -g batt`, `system_profiler SPPowerDataType` as available. Full disk traversal and update checks can be slow.
- **Linux:** `/etc/os-release`, `uptime`, `df -h`, `free -h`, `ps`, `/sys/class/power_supply/`, `lsblk` or `smartctl` when present and permitted. `smartctl` may require privileges; skip instead of escalating just for a routine check.

Report each measured area as Good / Watch / Act with the supporting number and its limits. Avoid a precise composite score if categories are missing or metrics are proxies. Suggest only the highest-value actions with estimated benefit based on observed data. A battery percentage is not battery health; a cumulative CPU time is not a live hog; an empty SMART field is unknown, not a failing disk.

The diagnostic pass makes no changes. If the user asks for cleanup, inspect the exact target and size, preserve personal files and project state, then follow their authorization and any applicable approval requirements. Do not turn a health check into a broad cache purge or system reconfiguration.
