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
    fun parsesOnlyPackageAndComponentLines() {
        assertEquals(setOf("android", "com.example.app"),
            parsePackages("package:android\nwarning: ignored\npackage:com.example.app\npackage:bad name\n"))
        assertEquals(setOf("com.example.app"),
            parseLauncherPackages("1 activities found:\n  com.example.app/.Main\nError: /bad\n"))
    }
}
