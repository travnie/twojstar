using Feedboard.Services;

var directory = Directory.CreateTempSubdirectory("feedboard-test-");
try
{
    var path = Path.Combine(directory.FullName, "feeds.json");
    var store = new FeedStore(path);
    const string url = "https://example.test/feed.xml";
    await store.AddAsync(url);
    var loaded = await new FeedStore(path).LoadAsync();
    if (loaded.Count != 1 || loaded[0].Url != url || !File.Exists(path))
        throw new InvalidOperationException("FeedStore did not persist to the explicit trusted path.");
}
finally
{
    directory.Delete(recursive: true);
}
