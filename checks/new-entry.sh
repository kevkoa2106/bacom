#!/bin/sh
# Runnable UI check without adding a test framework or production dependency.
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
check_dir=$(mktemp -d)
trap 'rm -rf "$check_dir"' EXIT
export BACOM_PROJECT_ROOT="$project_root" CHECK_DIR="$check_dir"
python3 - <<'PY'
import os
from pathlib import Path
from xml.sax.saxutils import escape
root = escape(os.environ['BACOM_PROJECT_ROOT'])
Path(os.environ['CHECK_DIR'], 'check.csproj').write_text(f'''<Project Sdk="Microsoft.NET.Sdk">
<PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable><NuGetAudit>false</NuGetAudit></PropertyGroup>
<ItemGroup><ProjectReference Include="{root}/bacom.csproj" /><PackageReference Include="Avalonia.Headless" Version="12.1.2" /></ItemGroup>
</Project>''')
PY
cat > "$check_dir/Program.cs" <<'CS'
using System;
using System.Linq;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;
using bacom;
using bacom.Models;
using bacom.Views;
using bacom.Services;

AppBuilder.Configure<App>().UseSkia().WithInterFont()
    .UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false }).SetupWithoutStarting();
var iconHandler = new FakeIconHandler();
var iconLoader = new EntryIconLoader(new HttpClient(iconHandler));
using (var image = EntryIconLoader.LoadImageAsync(new MemoryStream(FakeIconHandler.Png), CancellationToken.None).GetAwaiter().GetResult()) { }
var view = new DashboardView(iconLoader);
var window = new MainWindow { Width = 1177, Height = 702 };
window.NavigateTo(view);
window.Show();
T Get<T>(string name) where T : Control => view.FindControl<T>(name)!;
void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
void Layout() { Dispatcher.UIThread.RunJobs(); window.UpdateLayout(); AvaloniaHeadlessPlatform.ForceRenderTimerTick(); }
void Click(string name) { Get<Button>(name).RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Layout(); }
void Set(string name, string text) => Get<TextBox>(name).Text = text;
void Settle()
{
    for (var i = 0; i < 60; i++) { System.Threading.Thread.Sleep(10); Layout(); }
}
void Snapshot(string name)
{
    var output = Environment.GetEnvironmentVariable("BACOM_CHECK_IMAGES");
    if (output is not null) { using var image = window.CaptureRenderedFrame(); image!.Save(System.IO.Path.Combine(output, name + ".png")); }
}
Layout();
var items = Get<ItemsControl>("EntriesList");
var originals = items.Items.Cast<DashboardEntry>().ToArray();
Click("NewEntryButton");
Settle();
Check(Get<Grid>("EntryForm").IsVisible && Get<TextBox>("ServiceInput").IsFocused, "Creation form/focus missing");
Snapshot("new-entry-form");
Click("CreateEntryButton");
Check(items.ItemCount == 8 && Get<TextBlock>("FormError").IsVisible, "Blank fields accepted");
Set("ServiceInput", "  Test service  "); Set("AccountInput", "  work@example.com  ");
foreach (var invalid in new[] { "-1", "1.5", "oops" })
{
    Set("CodeCountInput", invalid); Click("CreateEntryButton");
    Check(items.ItemCount == 8 && Get<Grid>("DetailsOverlay").IsVisible, "Invalid count accepted");
}
Set("CodeCountInput", "8"); Set("WebsiteInput", "javascript:alert(1)"); Click("CreateEntryButton");
Check(items.ItemCount == 8, "Invalid website accepted");
Set("WebsiteInput", "https://example.com"); Set("NotesInput", "Work recovery account");
Click("CreateEntryButton");
Check(items.ItemCount == 9 && !Get<Grid>("DetailsOverlay").IsVisible, "Creation failed");
var added = (DashboardEntry)items.Items[0]!;
Check(added.ServiceName == "Test service" && added.AccountLabel == "work@example.com"
    && added.RemainingCodes == 8 && added.Notes == "Work recovery account", "Details not saved");
Check(items.Items.Cast<DashboardEntry>().Skip(1).SequenceEqual(originals), "Existing order changed");
var moving = items.GetRealizedContainers().Select(c => c.RenderTransform).OfType<TranslateTransform>().ToArray();
Check(moving.Length == 8 && moving.Any(t => Math.Abs(t.X) > 1) && moving.Any(t => Math.Abs(t.Y) > 1), "Insertion did not slide across rows");
Settle();
Check(moving.All(t => Math.Abs(t.X) < .01 && Math.Abs(t.Y) < .01), "Slide did not settle");
Snapshot("new-entry-created");
Click("CreateEntryButton"); Check(items.ItemCount == 9, "Repeated submit duplicated entry");
Set("SearchBox", "GitHub"); Layout();
Click("NewEntryButton"); Set("ServiceInput", "Another"); Set("AccountInput", "Personal"); Click("CreateEntryButton");
Check(items.ItemCount == 10 && Get<TextBox>("SearchBox").Text == ""
    && ((DashboardEntry)items.Items[0]!).ServiceName == "Another", "Filtered creation hidden or misplaced");
Settle();
Click("NewEntryButton"); Set("ServiceInput", "Cancelled"); Click("CloseDetailsButton");
Check(items.ItemCount == 10 && Get<Button>("NewEntryButton").IsFocused, "Cancellation changed entries/focus");
void EditAt(int index)
{
    var source = items.GetVisualDescendants().OfType<Button>().Where(b => b.Flyout is MenuFlyout).ElementAt(index);
    var flyout = (MenuFlyout)source.Flyout!;
    flyout.ShowAt(source); Layout(); Settle();
    var edit = flyout.Items.OfType<MenuItem>().First(m => m.Header?.ToString() == "Edit");
    var point = edit.TranslatePoint(new Point(edit.Bounds.Width / 2, edit.Bounds.Height / 2), window)!.Value;
    window.MouseDown(point, MouseButton.Left, RawInputModifiers.None);
    window.MouseUp(point, MouseButton.Left, RawInputModifiers.None);
    Layout(); Settle();
    Check(!flyout.IsOpen && Get<TextBox>("ServiceInput").IsFocused, "Edit menu did not dismiss/focus form");
}
EditAt(1);
Check(Get<Button>("CreateEntryButton").Content?.ToString() == "Apply"
    && Get<TextBox>("ServiceInput").Text == "Test service"
    && Get<TextBox>("AccountInput").Text == "work@example.com"
    && Get<TextBox>("WebsiteInput").Text == "https://example.com"
    && Get<TextBox>("CodeCountInput").Text == "8"
    && Get<TextBox>("NotesInput").Text == "Work recovery account", "Edit fields were not prefilled");
Set("ServiceInput", "Unsaved"); Click("CloseDetailsButton");
Check(((DashboardEntry)items.Items[1]!).ServiceName == "Test service", "Edit cancellation mutated data");
EditAt(1);
Settle();
Check(Get<Image>("IconPreview").Source is not null, "Website icon was not detected: " + Get<TextBlock>("IconStatus").Text);
Set("ServiceInput", "Updated service");
Snapshot("edit-entry-form"); Click("CreateEntryButton");
Check(items.ItemCount == 10 && ((DashboardEntry)items.Items[1]!).ServiceName == "Updated service"
    && ((DashboardEntry)items.Items[1]!).Icon is not null, "Apply changed order/count or lost favicon");
EditAt(1);
Check(ReferenceEquals(Get<Image>("IconPreview").Source, ((DashboardEntry)items.Items[1]!).Icon), "Saved icon not prefilled");
// Exercise the same decoded-image path used by the native file picker.
var custom = EntryIconLoader.LoadImageAsync(new MemoryStream(FakeIconHandler.Png), CancellationToken.None).GetAwaiter().GetResult();
typeof(DashboardView).GetMethod("SetDraftIcon", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
    .Invoke(view, [custom, true, true]);
Set("WebsiteInput", "https://changed.example"); Layout(); Settle();
Check(ReferenceEquals(Get<Image>("IconPreview").Source, custom), "Auto-detection overwrote a custom image");
Click("CreateEntryButton");
Check(((DashboardEntry)items.Items[1]!).HasCustomIcon && ReferenceEquals(((DashboardEntry)items.Items[1]!).Icon, custom), "Custom image not saved");
EditAt(1);
Check(ReferenceEquals(Get<Image>("IconPreview").Source, custom), "Custom image missing on edit");
Click("CloseDetailsButton");
Set("SearchBox", "Updated service"); Layout(); EditAt(0);
Set("ServiceInput", "Renamed"); Click("CreateEntryButton");
Check(items.ItemCount == 0 && Get<TextBlock>("EmptySearch").IsVisible, "Edited filter result stayed stale");
Set("SearchBox", ""); Layout(); Check(items.ItemCount == 10, "Edit lost an entry");
window.Width = 360; window.Height = 450; Layout();
Click("NewEntryButton"); Settle(); Snapshot("new-entry-narrow");
var buttonPoint = Get<Button>("CreateEntryButton").TranslatePoint(default, window)!.Value;
Check(buttonPoint.Y >= 0 && buttonPoint.Y + 42 <= 450, "Create is clipped on small windows");
window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null); Layout();
Check(!Get<Grid>("DetailsOverlay").IsVisible && items.ItemCount == 10, "Escape failed");
// Missing icons, cancel/reopen, conventional ICO fallback, and malformed uploads.
Click("NewEntryButton"); Set("WebsiteInput", "https://missing.example"); Layout(); Settle(); Settle();
Check(Get<Image>("IconPreview").Source is null && Get<PathIcon>("IconPlaceholder").IsVisible, "Missing icon has no placeholder");
Set("WebsiteInput", "https://example.com"); Layout(); Click("CloseDetailsButton");
Click("NewEntryButton"); Settle();
Check(Get<Image>("IconPreview").Source is null, "Cancelled lookup leaked into a new form");
Click("CloseDetailsButton");
using (var fallback = iconLoader.FindAsync(new Uri("https://fallback.example/private?token=example"), CancellationToken.None).GetAwaiter().GetResult())
    Check(fallback is not null, "Conventional ICO fallback failed");
try { EntryIconLoader.LoadImageAsync(new MemoryStream(new byte[2 * 1024 * 1024 + 1]), CancellationToken.None).GetAwaiter().GetResult(); throw new Exception("Oversized file accepted"); }
catch (InvalidDataException) { }
try { EntryIconLoader.LoadImageAsync(new MemoryStream([1, 2, 3]), CancellationToken.None).GetAwaiter().GetResult(); throw new Exception("Invalid image accepted"); }
catch (InvalidDataException) { }
Console.WriteLine("PASS: create/edit validation, prefill, prepend/sliding, Apply preserves order, favicon, filtering, cancellation, narrow layout");
window.Close();

sealed class FakeIconHandler : HttpMessageHandler
{
    public static readonly byte[] Png = CreatePng();
    private static byte[] CreatePng()
    {
        using var bitmap = new SkiaSharp.SKBitmap(32, 32);
        bitmap.Erase(SkiaSharp.SKColors.CornflowerBlue);
        using var image = SkiaSharp.SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        var uri = request.RequestUri!;
        if (uri.Query.Contains("token") || uri.AbsolutePath.Contains("private")) throw new Exception("Account URL was requested");
        var response = new HttpResponseMessage(HttpStatusCode.OK);
        if (uri.Host == "missing.example") response.StatusCode = HttpStatusCode.NotFound;
        else if (uri.AbsolutePath == "/") response.Content = new StringContent(uri.Host == "fallback.example" ? "<html></html>" : "<link href='/image.png' rel='shortcut icon'>");
        else if (uri.AbsolutePath == "/favicon.ico")
        {
            using var stream = new MemoryStream();
            using var writer = new BinaryWriter(stream);
            writer.Write((ushort)0); writer.Write((ushort)1); writer.Write((ushort)1);
            writer.Write((byte)32); writer.Write((byte)32); writer.Write((byte)0); writer.Write((byte)0);
            writer.Write((ushort)1); writer.Write((ushort)32); writer.Write(Png.Length); writer.Write(22); writer.Write(Png);
            response.Content = new ByteArrayContent(stream.ToArray());
        }
        else response.Content = new ByteArrayContent(Png);
        return Task.FromResult(response);
    }
}
CS
dotnet run --project "$check_dir/check.csproj" -p:UsedAvaloniaProducts= -p:UseSharedCompilation=false
