// PackageManager.MATCH_DISABLED_COMPONENTS | MATCH_UNINSTALLED_PACKAGES.
const val LAUNCHER_QUERY_FLAGS = 512 or 8192

fun packageGroupKey(packages: List<String>): Set<String> = packages.toSet()

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

data class PackageGroup(
    val name: String,
    val packages: List<String>,
    val checked: Boolean,
    val vetted: Boolean
)

fun visiblePackageGroups(
    rows: List<PackageRow>,
    query: String,
    showAll: Boolean,
    checked: Set<Set<String>>
): List<PackageGroup> = rows.filter { it.matches(query, showAll) }
    .groupBy { it.name }.toSortedMap()
    .map { (name, packages) ->
        val ids = packages.map { it.pkg }.sorted()
        PackageGroup(name, ids, packageGroupKey(ids) in checked, packages.all { it.vetted })
    }
