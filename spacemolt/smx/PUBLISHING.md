# Publishing SMX on PyPI

Project: `spacemolt-smx`. CLI: `smx`. Source: `spacemolt/smx/` in the existing monorepo. Do not fork the client stack or move its authoritative implementation.

## Build/check

Run the [Publish SMX to PyPI](../../.github/workflows/publish-smx-pypi.yml) workflow with **publish = false**. It produces a wheel and source distribution, then smoke-tests the wheel and tests.

## First release

1. Create or sign in to a PyPI account. Register a **pending Trusted Publisher** at https://pypi.org/manage/account/publishing/ with project `spacemolt-smx`, owner `travnie`, repository `twojstar`, workflow `publish-smx-pypi.yml`, environment `pypi`.
2. Configure the GitHub environment `pypi` with appropriate approval protection, or review the release workflow trigger carefully. It does not store an API token.
3. Merge the reviewed workflow; run it on `main` with **publish = true** only after checking the version and distribution files. Each new release requires a version bump (PyPI versions are immutable).

After the first successful publish, users can run:

```sh
uv tool install spacemolt-smx
smx backend update
```

The official SpaceMolt v2 binary stays the backend; SMX manages verified updates separately. Installs from the Git checkout remain supported.
