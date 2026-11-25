import Command.prefix
import javafx.collections.ObservableList
import javafx.scene.control.ProgressBar
import javafx.scene.control.ProgressIndicator
import javafx.scene.control.TableView
import javafx.scene.control.TextInputControl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.*


object AppManager {

    lateinit var uninstallerTableView: TableView<App>
    lateinit var reinstallerTableView: TableView<App>
    lateinit var disablerTableView: TableView<App>
    lateinit var enablerTableView: TableView<App>
    lateinit var progress: ProgressBar
    lateinit var progressInd: ProgressIndicator
    lateinit var outputTextArea: TextInputControl
    var user = "0"
    val customApps = File(XiaomiADBFastbootTools.dir, "apps.yml")
    private val potentialApps = mutableMapOf<String, String>()

    // Packages the curated list vouches for. Everything else comes straight off the device and
    // has never been checked by anyone, which is what the Vetted column in the tables says.
    private val vettedApps = mutableSetOf<String>()
    private var inventory = emptyList<PackageRow>()
    private var query = ""
    private var showAll = false

    init {
        if (!customApps.exists())
            customApps.createNewFile()
    }

    suspend fun readPotentialApps() {
        potentialApps.clear()
        vettedApps.clear()
        potentialApps["android.autoinstalls.config.Xiaomi.${Device.codename}"] = "PAI"
        vettedApps += "android.autoinstalls.config.Xiaomi.${Device.codename}"
        withContext(Dispatchers.IO) {
            // This used to fetch apps.yml from Szaki/XiaomiADBFastbootTools, which no longer
            // exists on GitHub, so every run paid for a failing request before falling back.
            // These names are only labels now: the tables themselves come from the device.
            this::class.java.classLoader.getResource("apps.yml")?.readText()?.trim()?.lines()
                ?.forEach {
                    val entry = it.toAppEntry()
                    potentialApps += entry
                    vettedApps += entry.first
                }
        }
        this::class.java.classLoader.getResource("app-labels.yml")?.readText()?.lines()
            ?.forEach { potentialApps += it.toAppEntry() }
        customApps.forEachLine { potentialApps += it.toAppEntry() }
        potentialApps.remove("")
        vettedApps.remove("")
    }

    private fun String.toAppEntry(): Pair<String, String> {
        val app = split(':', limit = 2)
        val pkg = app[0].trim()
        return pkg to if (app.size == 2 && app[1].isNotBlank()) app[1].trim() else pkg
    }

    private suspend fun packageCommand(vararg args: String): String? = withContext(Dispatchers.IO) {
        val process = startProcess(listOf("${prefix}adb", "shell") + args, true)
        val output = process.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        output.takeIf { process.waitFor() == 0 }
    }

    suspend fun createTables() {
        val targetUser = user
        val all = packageCommand("pm", "list", "packages", "-u", "--user", targetUser)
        val installed = packageCommand("pm", "list", "packages", "--user", targetUser)
        val disabled = packageCommand("pm", "list", "packages", "-d", "--user", targetUser)
        val thirdParty = packageCommand("pm", "list", "packages", "-3", "-u", "--user", targetUser)
        val launcher = packageCommand("cmd", "package", "query-activities", "--components",
            "--query-flags", "512", "--user", targetUser, "-a", "android.intent.action.MAIN",
            "-c", "android.intent.category.LAUNCHER")
        val rows = if (all != null && installed != null && disabled != null) {
            packageInventory(parsePackages(all), parsePackages(installed), parsePackages(disabled),
                parsePackages(thirdParty.orEmpty()), parseLauncherPackages(launcher.orEmpty()),
                potentialApps.toMap(), vettedApps.toSet())
        } else emptyList()
        withContext(Dispatchers.Main) {
            if (user != targetUser) return@withContext
            inventory = rows
            if (all == null || installed == null || disabled == null)
                outputTextArea.appendText("\nERROR: Could not read package inventory for user $targetUser.\n")
            else if (thirdParty == null || launcher == null)
                outputTextArea.appendText("\nSome app filters are unavailable on this device. Use Show all packages to see every package.\n")
            renderTables()
        }
    }

    fun filterTables(search: String, all: Boolean) {
        query = search.trim()
        showAll = all
        renderTables()
    }

    private fun renderTables() {
        val visible = inventory.filter { it.matches(query, showAll) }
        fun update(table: TableView<App>, rows: List<PackageRow>) {
            table.items.setAll(rows.groupBy { it.name }.toSortedMap()
                .map { (name, packages) ->
                    App(name, packages.map { it.pkg }.sorted(), isVetted = packages.all { it.vetted })
                })
            table.sort()
        }
        update(uninstallerTableView, visible.filter { it.state != PackageState.UNINSTALLED })
        update(reinstallerTableView, visible.filter { it.state == PackageState.UNINSTALLED })
        update(disablerTableView, visible.filter { it.state == PackageState.ENABLED })
        update(enablerTableView, visible.filter { it.state == PackageState.DISABLED })
    }

    suspend fun uninstall(selected: ObservableList<App>, n: Int) {
        withContext(Dispatchers.Main) {
            outputTextArea.text = ""
            progress.progress = 0.0
            progressInd.isVisible = true
        }
        selected.forEach {
            it.packagenameProperty().get().trim().lines().forEach { pkg ->
                val sb = StringBuilder()
                withContext(Dispatchers.IO) {
                    Scanner(
                        startProcess(
                            mutableListOf(
                                "${prefix}adb",
                                "shell",
                                "pm",
                                "uninstall",
                                "--user",
                                user,
                                pkg.trim()
                            )
                        ).inputStream, "UTF-8"
                    ).useDelimiter("").use { scanner ->
                        while (scanner.hasNextLine())
                            sb.append(scanner.nextLine() + '\n')
                    }
                }
                withContext(Dispatchers.Main) {
                    outputTextArea.apply {
                        appendText("App: ${it.appnameProperty().get()}\n")
                        appendText("Package: $pkg\n")
                        appendText("Result: $sb\n")
                    }
                    progress.progress += 1.0 / n
                }
            }
        }
        withContext(Dispatchers.Main) {
            outputTextArea.appendText("Done!")
            progress.progress = 0.0
            progressInd.isVisible = false
            createTables()
        }
    }

    suspend fun reinstall(selected: ObservableList<App>, n: Int) {
        withContext(Dispatchers.Main) {
            outputTextArea.text = ""
            progress.progress = 0.0
            progressInd.isVisible = true
        }
        selected.forEach {
            it.packagenameProperty().get().trim().lines().forEach { pkg ->
                val sb = StringBuilder()
                withContext(Dispatchers.IO) {
                    Scanner(
                        startProcess(
                            mutableListOf(
                                "${prefix}adb",
                                "shell",
                                "cmd",
                                "package",
                                "install-existing",
                                "--user",
                                user,
                                pkg.trim()
                            )
                        ).inputStream, "UTF-8"
                    ).useDelimiter("").use { scanner ->
                        while (scanner.hasNextLine())
                            sb.append(scanner.nextLine() + '\n')
                    }
                }
                var output = sb.toString()
                output = if ("installed for user" in output)
                    "Success\n"
                else "Failure [${output.substringAfter(pkg).trim()}]\n"
                withContext(Dispatchers.Main) {
                    outputTextArea.apply {
                        appendText("App: ${it.appnameProperty().get()}\n")
                        appendText("Package: $pkg\n")
                        appendText("Result: $output\n")
                    }
                    progress.progress += 1.0 / n
                }
            }
        }
        withContext(Dispatchers.Main) {
            outputTextArea.appendText("Done!")
            progress.progress = 0.0
            progressInd.isVisible = false
            createTables()
        }
    }

    suspend fun disable(selected: ObservableList<App>, n: Int) {
        withContext(Dispatchers.Main) {
            outputTextArea.text = ""
            progress.progress = 0.0
            progressInd.isVisible = true
        }
        selected.forEach {
            it.packagenameProperty().get().trim().lines().forEach { pkg ->
                val sb = StringBuilder()
                withContext(Dispatchers.IO) {
                    Scanner(
                        startProcess(
                            mutableListOf(
                                "${prefix}adb",
                                "shell",
                                "pm",
                                "disable-user",
                                "--user",
                                user,
                                pkg.trim()
                            )
                        ).inputStream, "UTF-8"
                    ).useDelimiter("").use { scanner ->
                        while (scanner.hasNextLine())
                            sb.append(scanner.nextLine() + '\n')
                    }
                }
                val output = if ("disabled-user" in sb.toString())
                    "Success\n"
                else "Failure\n"
                withContext(Dispatchers.Main) {
                    outputTextArea.apply {
                        appendText("App: ${it.appnameProperty().get()}\n")
                        appendText("Package: $pkg\n")
                        appendText("Result: $output\n")
                    }
                    progress.progress += 1.0 / n
                }
            }
        }
        withContext(Dispatchers.Main) {
            outputTextArea.appendText("Done!")
            progress.progress = 0.0
            progressInd.isVisible = false
            createTables()
        }
    }

    suspend fun enable(selected: ObservableList<App>, n: Int) {
        withContext(Dispatchers.Main) {
            outputTextArea.text = ""
            progress.progress = 0.0
            progressInd.isVisible = true
        }
        selected.forEach {
            it.packagenameProperty().get().trim().lines().forEach { pkg ->
                val sb = StringBuilder()
                withContext(Dispatchers.IO) {
                    Scanner(
                        startProcess(mutableListOf("${prefix}adb", "shell", "pm", "enable", "--user", user, pkg.trim()))
                            .inputStream, "UTF-8"
                    ).useDelimiter("").use { scanner ->
                        while (scanner.hasNextLine())
                            sb.append(scanner.nextLine() + '\n')
                    }
                }
                val output = if ("enabled" in sb.toString())
                    "Success\n"
                else "Failure\n"
                withContext(Dispatchers.Main) {
                    outputTextArea.apply {
                        appendText("App: ${it.appnameProperty().get()}\n")
                        appendText("Package: $pkg\n")
                        appendText("Result: $output\n")
                    }
                    progress.progress += 1.0 / n
                }
            }
        }
        withContext(Dispatchers.Main) {
            outputTextArea.appendText("Done!")
            progress.progress = 0.0
            progressInd.isVisible = false
            createTables()
        }
    }
}
