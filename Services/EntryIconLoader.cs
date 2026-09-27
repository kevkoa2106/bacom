using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Media.Imaging;
using SkiaSharp;

namespace bacom.Services;

public sealed class EntryIconLoader(HttpClient? client = null)
{
    private const int MaxBytes = 2 * 1024 * 1024;
    private static readonly HttpClient SharedClient = new(new HttpClientHandler { UseCookies = false })
    {
        Timeout = TimeSpan.FromSeconds(5),
        MaxResponseContentBufferSize = MaxBytes,
    };
    private readonly HttpClient _client = client ?? SharedClient;

    // Bound both compressed input and decoded dimensions before allocating an image.
    public static async Task<Bitmap> LoadImageAsync(Stream stream, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        var bytes = new byte[8192];
        int count;
        while ((count = await stream.ReadAsync(bytes, cancellationToken)) > 0)
        {
            if (buffer.Length + count > MaxBytes)
                throw new InvalidDataException("Choose an image smaller than 2 MB.");
            buffer.Write(bytes, 0, count);
        }

        using var data = SKData.CreateCopy(buffer.ToArray());
        using var codec = SKCodec.Create(data);
        if (codec is null || codec.Info.Width <= 0 || codec.Info.Height <= 0
            || codec.Info.Width > 4096 || codec.Info.Height > 4096)
            throw new InvalidDataException("Choose a PNG, JPEG, WebP or ICO image up to 4096 pixels wide and tall.");

        buffer.Position = 0;
        // Preserve aspect ratio and keep the longest side at most 128 pixels.
        var width = Math.Max(1, (int)(codec.Info.Width * Math.Min(1d, 128d / Math.Max(codec.Info.Width, codec.Info.Height))));
        return Bitmap.DecodeToWidth(buffer, width);
    }

    public async Task<Bitmap?> FindAsync(Uri website, CancellationToken cancellationToken)
    {
        // Request only the site's public root, never an account path/query or a third-party icon service.
        var root = new Uri(website.GetLeftPart(UriPartial.Authority) + "/");
        var candidates = new System.Collections.Generic.List<Uri>();
        try
        {
            var html = await _client.GetStringAsync(root, cancellationToken);
            foreach (Match link in Regex.Matches(html, @"<link\b[^>]*>", RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(100)))
            {
                var attributes = Regex.Matches(link.Value, "([\\w-]+)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))",
                    RegexOptions.None, TimeSpan.FromMilliseconds(100));
                string? rel = null, href = null;
                foreach (Match attribute in attributes)
                {
                    var value = WebUtility.HtmlDecode(attribute.Groups[2].Success ? attribute.Groups[2].Value
                        : attribute.Groups[3].Success ? attribute.Groups[3].Value : attribute.Groups[4].Value);
                    if (attribute.Groups[1].Value.Equals("rel", StringComparison.OrdinalIgnoreCase)) rel = value;
                    if (attribute.Groups[1].Value.Equals("href", StringComparison.OrdinalIgnoreCase)) href = value;
                }
                if (rel is not null && (rel.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
                        .Any(token => token.Equals("icon", StringComparison.OrdinalIgnoreCase))
                        || rel.Equals("apple-touch-icon", StringComparison.OrdinalIgnoreCase))
                    && Uri.TryCreate(root, href, out var icon) && icon.Scheme is "https" or "http"
                    && !icon.AbsolutePath.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
                    candidates.Add(icon);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or RegexMatchTimeoutException)
        {
            // Many sites block their home page but still expose a conventional favicon.
        }

        candidates.Add(new Uri(root, "favicon.ico"));
        candidates.Add(new Uri(root, "apple-touch-icon.png"));
        foreach (var candidate in candidates.Distinct().Take(8))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var response = await _client.GetAsync(candidate, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                response.EnsureSuccessStatusCode();
                if (response.Content.Headers.ContentLength > MaxBytes) continue;
                using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                return await LoadImageAsync(stream, cancellationToken);
            }
            catch (Exception ex) when (ex is HttpRequestException or IOException or ArgumentException or NotSupportedException)
            {
                // Try the next declared icon or a conventional fallback.
            }
        }
        return null;
    }
}
