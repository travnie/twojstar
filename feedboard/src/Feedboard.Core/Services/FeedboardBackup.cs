using Feedboard.Models;
using System.Text.Json;

namespace Feedboard.Services;

public sealed record FeedboardBackupDocument(
    int Version,
    DateTimeOffset ExportedAt,
    List<FeedSource> Feeds,
    AppSettings Settings);

public static class FeedboardBackup
{
    public const int CurrentVersion = 1;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public static string Export(IEnumerable<FeedSource> feeds, AppSettings settings)
    {
        ArgumentNullException.ThrowIfNull(feeds);
        ArgumentNullException.ThrowIfNull(settings);
        var document = new FeedboardBackupDocument(
            CurrentVersion,
            DateTimeOffset.UtcNow,
            feeds.ToList(),
            settings);
        return JsonSerializer.Serialize(document, JsonOptions);
    }

    public static FeedboardBackupDocument Import(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            throw new InvalidOperationException("The selected Feedboard backup is empty.");

        FeedboardBackupDocument document;
        try
        {
            document = JsonSerializer.Deserialize<FeedboardBackupDocument>(json, JsonOptions)
                ?? throw new InvalidOperationException("The selected Feedboard backup is empty.");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException("The selected Feedboard backup is malformed.", ex);
        }
        catch (NotSupportedException ex)
        {
            throw new InvalidOperationException("The selected Feedboard backup uses unsupported data.", ex);
        }

        if (document.Version != CurrentVersion)
            throw new InvalidOperationException($"Unsupported Feedboard backup version: {document.Version}.");
        if (document.Settings is null ||
            !AppSettingsStore.SupportedRefreshIntervals.Contains(document.Settings.RefreshIntervalMinutes))
            throw new InvalidOperationException("The backup contains an unsupported refresh interval.");
        if (document.Feeds is null)
            throw new InvalidOperationException("The backup does not contain a feed list.");

        var normalizedFeeds = new List<FeedSource>(document.Feeds.Count);
        var seenUrls = new HashSet<string>(StringComparer.Ordinal);
        var seenIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var source in document.Feeds)
        {
            if (source is null || !FeedUrl.TryNormalize(source.Url, out var normalizedUrl))
                throw new InvalidOperationException("The backup contains an invalid feed URL.");

            var title = string.IsNullOrWhiteSpace(source.Title) ? null : source.Title.Trim();
            if (title?.Length > 120)
                throw new InvalidOperationException("The backup contains a feed name longer than 120 characters.");

            var id = string.IsNullOrWhiteSpace(source.Id) ? FeedIdentity.FromUrl(source.Url) : source.Id.Trim();
            if (id.Length > 256)
                throw new InvalidOperationException("The backup contains an invalid feed identifier.");
            if (!seenUrls.Add(normalizedUrl))
                throw new InvalidOperationException("The backup contains a duplicate feed URL.");
            if (!seenIds.Add(id))
                throw new InvalidOperationException("The backup contains duplicate feed identifiers.");

            normalizedFeeds.Add(source with
            {
                Url = normalizedUrl,
                Title = title,
                Id = id
            });
        }

        return document with
        {
            Feeds = normalizedFeeds,
            Settings = new AppSettings(document.Settings.RefreshIntervalMinutes)
        };
    }
}
