enum class PackageState { ENABLED, DISABLED, UNINSTALLED }

data class PackageRow(
    val pkg: String,
    val name: String,
    val state: PackageState,
    val vetted: Boolean,
    val defaultVisible: Boolean
) {
    fun matches(query: String, showAll: Boolean): Boolean =
        if (query.isBlank()) showAll || defaultVisible
        else name.contains(query, ignoreCase = true) || pkg.contains(query, ignoreCase = true)
}

private val packagePattern = Regex("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*")

fun parsePackages(output: String): Set<String> = output.lineSequence()
    .map { it.trim() }
    .filter { it.startsWith("package:") }
    .map { it.removePrefix("package:").trim() }
    .filter { packagePattern.matches(it) }
    .toSet()

fun parseLauncherPackages(output: String): Set<String> = output.lineSequence()
    .map { it.trim() }
    .filter { '/' in it && it.substringAfter('/').isNotBlank() }
    .map { it.substringBefore('/') }
    .filter { packagePattern.matches(it) }
    .toSet()

fun packageInventory(
    all: Set<String>,
    installed: Set<String>,
    disabled: Set<String>,
    thirdParty: Set<String>,
    launcher: Set<String>,
    labels: Map<String, String>,
    vetted: Set<String>
): List<PackageRow> = (all + installed).map { pkg ->
    PackageRow(
        pkg = pkg,
        name = labels[pkg] ?: pkg,
        state = when {
            pkg !in installed -> PackageState.UNINSTALLED
            pkg in disabled -> PackageState.DISABLED
            else -> PackageState.ENABLED
        },
        vetted = pkg in vetted,
        defaultVisible = pkg in labels || pkg in thirdParty || pkg in launcher
    )
}
