using Feedboard.Models;

namespace Feedboard.Services;

public sealed record FeedErrorStatus(string FeedUrl, DateTimeOffset? RetryAfter);

public sealed record FeedDiagnosticStatus(
    string FeedUrl,
    int CachedArticleCount,
    int FailureCount,
    DateTimeOffset? LastSuccessAt,
    DateTimeOffset? RetryAfter,
    bool HasEntityTag,
    DateTimeOffset? LastModified);

public sealed partial class FeedClient
{
    public IReadOnlyList<FeedErrorStatus> GetErrorStatuses(IEnumerable<FeedSource> sources)
    {
        var statuses = new List<FeedErrorStatus>();
        foreach (var source in sources.Where(source => source.Enabled))
        {
            if (FeedCache.TryGetValue(source.Url, out var cached) && cached.FailureCount > 0)
            {
                statuses.Add(new FeedErrorStatus(source.Url, cached.RetryAfter));
            }
        }

        return statuses;
    }

    public IReadOnlyList<FeedDiagnosticStatus> GetDiagnostics(IEnumerable<FeedSource> sources)
    {
        return sources
            .Where(source => source.Enabled)
            .Select(source =>
            {
                FeedCache.TryGetValue(source.Url, out var cached);
                return new FeedDiagnosticStatus(
                    source.Url,
                    cached?.Articles.Count ?? 0,
                    cached?.FailureCount ?? 0,
                    cached?.LastSuccessAt,
                    cached?.RetryAfter,
                    !string.IsNullOrWhiteSpace(cached?.ETag),
                    cached?.LastModified);
            })
            .ToList();
    }
}
