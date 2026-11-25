import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PackageInventoryTest {
    @Test
    fun focusedListAndSearch() {
        val one = "com.google.android.apps.subscriptions.red"
        val auto = "com.google.android.projection.gearhead"
        val system = "com.android.internal.systemui.navbar"
        val user = "org.example.app"
        val launcher = "com.vendor.gallery"
        val known = "com.vendor.bloat"
        val all = setOf(one, auto, system, user, launcher, known)
        val rows = packageInventory(all, all - known, setOf(auto, known), setOf(user),
            setOf(launcher), mapOf(one to "Google One", auto to "Android Auto", known to "Bloat"),
            setOf(known)).associateBy { it.pkg }
        assertEquals(all - system, rows.values.filter { it.matches("", false) }.map { it.pkg }.toSet())
        assertEquals(all, rows.values.filter { it.matches("", true) }.map { it.pkg }.toSet())
        assertTrue(rows.getValue(system).matches("navbar", false))
        assertTrue(rows.getValue(one).matches("google one", false))
        assertFalse(rows.getValue(one).vetted)
        assertFalse(rows.getValue(auto).vetted)
        assertTrue(rows.getValue(known).vetted)
        assertEquals(PackageState.ENABLED, rows.getValue(one).state)
        assertEquals(PackageState.DISABLED, rows.getValue(auto).state)
        assertEquals(PackageState.UNINSTALLED, rows.getValue(known).state)
    }

    @Test
    fun retainsUninstalledLauncherClassification() {
        val gallery = "com.vendor.gallery"
        assertEquals(8704, LAUNCHER_QUERY_FLAGS)
        val rows = packageInventory(setOf(gallery), emptySet(), emptySet(), emptySet(),
            setOf(gallery), emptyMap(), emptySet())
        assertEquals(PackageState.UNINSTALLED, rows.single().state)
        assertTrue(rows.single().matches("", false))
    }

    @Test
    fun selectionRequiresExactVisiblePackageGroup() {
        val rows = listOf(
            PackageRow("org.example.a", "Example", PackageState.ENABLED, true, true),
            PackageRow("org.example.b", "Example", PackageState.ENABLED, true, true),
            PackageRow("org.example.c", "Other", PackageState.ENABLED, false, false)
        )
        fun checkedGroups(groups: List<PackageGroup>) =
            groups.filter { it.checked }.map { packageGroupKey(it.packages) }.toSet()

        val initial = setOf(packageGroupKey(listOf("org.example.a", "org.example.b")))
        val unchanged = visiblePackageGroups(rows, "Example", false, initial)
        assertEquals(initial, checkedGroups(unchanged))
        val narrowed = visiblePackageGroups(rows, "org.example.a", false, initial)
        assertEquals(listOf("org.example.a"), narrowed.single().packages)
        assertFalse(narrowed.single().checked)

        val selectedNarrow = setOf(packageGroupKey(narrowed.single().packages))
        val expanded = visiblePackageGroups(rows, "", true, selectedNarrow)
        assertEquals(2, expanded.size)
        assertTrue(expanded.none { it.checked })
        val hidden = visiblePackageGroups(rows, "Other", false, initial)
        assertFalse(hidden.single().checked)
        val restored = visiblePackageGroups(rows, "", false, checkedGroups(hidden))
        assertTrue(restored.none { it.checked })
    }

    @Test
    fun parsesOnlyPackageAndComponentLines() {
        assertEquals(setOf("android", "com.example.app"),
            parsePackages("package:android\nwarning: ignored\npackage:com.example.app\npackage:bad name\n"))
        assertEquals(setOf("com.example.app"),
            parseLauncherPackages("1 activities found:\n  com.example.app/.Main\nError: /bad\n"))
    }
}
