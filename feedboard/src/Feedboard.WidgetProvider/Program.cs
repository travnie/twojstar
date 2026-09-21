using Feedboard.Interop;
using Feedboard.Services;
using Microsoft.Windows.Widgets.Providers;
using System.Runtime.InteropServices;

namespace Feedboard;

public static class Program
{
    private const uint AttachParentProcess = 0xFFFFFFFF;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AttachConsole(uint processId);

    [MTAThread]
    public static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "-RegisterProcessAsComServer")
        {
            RunWidgetProvider();
            return;
        }

        AttachParentConsole();

        if (args.Length > 0 && args[0].Equals("feeds", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                RunFeedCommand(args.Skip(1).ToArray()).GetAwaiter().GetResult();
            }
            catch (Exception ex) when (ex is ArgumentException or IOException or InvalidOperationException or OperationCanceledException)
            {
                Console.Error.WriteLine(ex.Message);
                Environment.ExitCode = 1;
            }
            return;
        }

        Console.WriteLine("Feedboard widget provider");
        Console.WriteLine("  feeds list");
        Console.WriteLine("  feeds diagnose");
        Console.WriteLine("  feeds add <url>");
        Console.WriteLine("  feeds import <file.opml>");
        Console.WriteLine("  feeds export <file.opml>");
    }

    private static void RunWidgetProvider()
    {
        WinRT.ComWrappersSupport.InitializeComWrappers();
        using var manager = RegistrationManager<WidgetProvider>.RegisterProvider();

        _ = WidgetManager.GetDefault().GetWidgetIds();
        manager.ExitWaitHandle.WaitOne();
    }

    private static void AttachParentConsole()
    {
        if (!AttachConsole(AttachParentProcess))
        {
            return;
        }

        var stdout = Console.OpenStandardOutput();
        if (stdout != Stream.Null)
        {
            Console.SetOut(new StreamWriter(stdout) { AutoFlush = true });
        }

        var stderr = Console.OpenStandardError();
        if (stderr != Stream.Null)
        {
            Console.SetError(new StreamWriter(stderr) { AutoFlush = true });
        }
    }

    private static async Task RunFeedCommand(string[] args)
    {
        var store = new FeedStore();
        if (args.Length == 0)
            throw new ArgumentException("Missing feed command.");

        switch (args[0].ToLowerInvariant())
        {
            case "list":
                foreach (var source in await store.LoadAsync())
                {
                    Console.WriteLine($"{(source.Enabled ? "[x]" : "[ ]")} {source.Title ?? source.Url}  {source.Url}");
                }
                break;

            case "diagnose":
                var diagnosticSources = (await store.LoadAsync()).Where(source => source.Enabled).ToList();
                if (diagnosticSources.Count == 0)
                {
                    Console.WriteLine("No enabled feeds.");
                    break;
                }

                var client = new FeedClient();
                Console.WriteLine($"Refreshing {diagnosticSources.Count} enabled feed(s)…");
                await client.LoadAsync(diagnosticSources);
                var diagnostics = client.GetDiagnostics(diagnosticSources)
                    .ToDictionary(status => status.FeedUrl, StringComparer.Ordinal);

                foreach (var source in diagnosticSources)
                {
                    if (!diagnostics.TryGetValue(source.Url, out var status)) continue;
                    var health = status.FailureCount > 0
                        ? $"retry x{status.FailureCount}"
                        : status.LastSuccessAt is not null ? "ok" : "no data";
                    var refreshed = status.LastSuccessAt?.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss") ?? "-";
                    var retry = status.RetryAfter?.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss") ?? "-";
                    var validators = $"{(status.HasEntityTag ? "etag" : "-")}/{(status.LastModified is not null ? "last-modified" : "-")}";
                    Console.WriteLine($"{health,-10} cached={status.CachedArticleCount,-2} last={refreshed} retry={retry} http={validators}  {source.Title ?? source.Url}");
                    Console.WriteLine($"           {source.Url}");
                }
                break;

            case "add" when args.Length >= 2:
                await store.AddAsync(args[1]);
                Console.WriteLine("Feed added.");
                break;

            case "import" when args.Length >= 2:
                var imported = Opml.Import(await File.ReadAllTextAsync(args[1]));
                await store.MergeAsync(imported);
                Console.WriteLine($"Imported {imported.Count} feed(s).");
                break;

            case "export" when args.Length >= 2:
                var sources = await store.LoadAsync();
                await File.WriteAllTextAsync(args[1], Opml.Export(sources));
                Console.WriteLine($"Exported {sources.Count} feed(s).");
                break;

            default:
                throw new ArgumentException("Unknown or incomplete feed command.");
        }
    }
}
