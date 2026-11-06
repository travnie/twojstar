# Architecture, patterns, testing

The code below is **shape, not gospel**. Match names and signatures to whatever the repo already does.

## Principles

1. **Offline-first.** Room is the source of truth; the network refreshes the cache. The repository exposes cached data as a `Flow` and triggers refresh separately, so the UI never waits on the network to render something.
2. **Unidirectional data flow.** Events down (`onAction`), state up (`StateFlow<UiState>`).
3. **Reactive streams.** Expose data as `Flow`; collect with `collectAsStateWithLifecycle()`.
4. **Source isolation.** When fanning out to several remote sources, run each under its own `runCatching` so one failure can't sink the rest.
5. **Pure model layer.** Keep the model/util package plain Kotlin with no Android dependencies — calculators, value objects, and math stay unit-testable without Robolectric. This is the cheapest, highest-value test surface in most apps.

## UiState (sealed interface)

```kotlin
sealed interface ListingsUiState {
    data object Loading : ListingsUiState
    data class Success(val items: List<Item>) : ListingsUiState
    data class Error(val message: String) : ListingsUiState
}
```

## ViewModel (Hilt, StateFlow from a Flow)

```kotlin
@HiltViewModel
class ListingsViewModel @Inject constructor(
    private val repository: ItemRepository,
) : ViewModel() {

    val uiState: StateFlow<ListingsUiState> = repository.observeItems()
        .map<List<Item>, ListingsUiState>(ListingsUiState::Success)
        .catch { emit(ListingsUiState.Error(it.message ?: "Unknown error")) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = ListingsUiState.Loading,
        )

    fun onAction(action: ListingsAction) { /* ... */ }
}
```

`SharingStarted.WhileSubscribed(5_000)` is the default for screen-scoped state: it survives a configuration change but stops collecting when the app is backgrounded.

## Screen (stateful Route + stateless Screen)

```kotlin
@Composable
internal fun ListingsRoute(
    onItemClick: (String) -> Unit,
    viewModel: ListingsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    ListingsScreen(uiState = uiState, onAction = viewModel::onAction, onItemClick = onItemClick)
}

@Composable
internal fun ListingsScreen(
    uiState: ListingsUiState,
    onAction: (ListingsAction) -> Unit,
    onItemClick: (String) -> Unit,
) {
    when (uiState) {
        ListingsUiState.Loading -> LoadingIndicator()
        is ListingsUiState.Success -> ItemList(uiState.items, onItemClick)
        is ListingsUiState.Error -> ErrorMessage(uiState.message)
    }
}
```

Keep the stateless `Screen` free of ViewModel/Hilt references. That is what makes it previewable **and** testable with `createComposeRule()` — the two benefits are the same benefit.

## Offline-first repository

```kotlin
interface ItemRepository {
    fun observeItems(): Flow<List<Item>>
    suspend fun refresh(filter: Filter)
}

internal class OfflineFirstItemRepository @Inject constructor(
    private val dao: ItemDao,
    private val sources: Set<@JvmSuppressWildcards ItemSource>,
) : ItemRepository {

    override fun observeItems(): Flow<List<Item>> =
        dao.observeAll().map { entities -> entities.map(ItemEntity::toModel) }

    override suspend fun refresh(filter: Filter) {
        sources.map { source ->
            runCatching { source.fetch(filter) }.getOrElse { emptyList() } // isolate failures
        }.flatten().let { dao.upsertAll(it.map(Item::toEntity)) }
    }
}
```

The `Set<@JvmSuppressWildcards T>` is the Hilt multibinding shape (`@Binds @IntoSet`); the `@JvmSuppressWildcards` is required or the injected type won't match.

## Details that bite

- `collectAsStateWithLifecycle()`, not `collectAsState()`. The latter keeps collecting while backgrounded.
- **Preferences DataStore, not SharedPreferences,** for persistent non-Room state. Keys in a `companion`, decode defensively with `runCatching{}.getOrNull()`. Provide one app-wide `DataStore<Preferences>` and namespace keys into it rather than minting a new store per feature.
- **Money across currencies:** convert to a single display currency before filtering or sorting. Comparing raw amounts across currencies ranks results wrongly and the bug looks like a sort bug, not a currency bug.
- **No hardcoded user-facing strings.** `res/values/strings.xml` plus the locale variants the app actually targets (`res/values-pl/` and so on).
- **Secrets** belong in `local.properties` (gitignored) or server-side env secrets — never in committed code, never in a `buildConfigField` that ships.

## Testing

Many repos ship **no test dependencies at all** — check the catalog before assuming JUnit or Turbine are available. Adding tests often means adding catalog entries first.

- **Catalog entries:** `junit`, `kotlinx-coroutines-test`, `turbine` (Flow/StateFlow assertions), an assertion lib (`truth` or `assertk`). Instrumented: `androidx.test.ext:junit`, `espresso`, `androidx-compose-ui-test-junit4` plus the `debugImplementation` manifest helper.
- **Test the pure model layer as plain JVM unit tests.** No Android deps means no Robolectric. Start here.
- **Prefer fakes over mocks.** A `FakeDao` returning a `MutableStateFlow` is clearer than a mock and exercises the real `Flow` wiring.
- **ViewModels:** assert `StateFlow` emissions with Turbine, and install a `MainDispatcherRule` — a `TestWatcher` swapping `Dispatchers.Main` for a `StandardTestDispatcher` — or `viewModelScope`/`stateIn` won't run under test.
- **Compose:** test the stateless `Screen` with `createComposeRule()`.

Write them; the Android CI workflow runs them. Read its run, don't run Gradle locally.

Which layer to test (JVM vs Robolectric vs device), Room/SQL engine checks, screenshot and adaptive-window coverage: `references/testing.md`.
