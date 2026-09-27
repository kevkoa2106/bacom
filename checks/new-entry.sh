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
foreach (var invalid in new[] { "same\nsame", new string('x', 257), string.Join('\n', Enumerable.Range(0, 1001)) })
{
    Set("BackupCodesInput", invalid); Click("CreateEntryButton");
    Check(items.ItemCount == 8 && Get<Grid>("DetailsOverlay").IsVisible, "Invalid codes accepted");
}
var pastedCodes = "  0012-3456  \r\n\r\n00000002\r003 004\nDemo-4\nDemo-5\nDemo-6\nDemo-7\nDemo-8\n";
Set("BackupCodesInput", pastedCodes); Set("WebsiteInput", "javascript:alert(1)"); Click("CreateEntryButton");
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
    && Get<TextBox>("BackupCodesInput").Text == string.Join(Environment.NewLine, added.BackupCodes.Select(c => c.Value))
    && Get<TextBox>("NotesInput").Text == "Work recovery account", "Edit fields were not prefilled");
Set("ServiceInput", "Unsaved"); Set("BackupCodesInput", "discard-me"); Click("CloseDetailsButton");
Check(((DashboardEntry)items.Items[1]!).ServiceName == "Test service", "Edit cancellation mutated data");
Check(added.BackupCodes.Count == 8 && added.BackupCodes[0].Value == "0012-3456"
    && added.BackupCodes[2].Value == "003 004", "Code parsing or cancellation damaged codes");

// Real pointer toggles must update the open details and the card, including undo.
var card = items.GetVisualDescendants().OfType<Button>()
    .First(b => b.Classes.Contains("entry-card") && ReferenceEquals(b.DataContext, added));
card.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Layout(); Settle();
var codeList = Get<ItemsControl>("BackupCodesList");
void ToggleCode(int index)
{
    var toggle = codeList.GetVisualDescendants().OfType<CheckBox>().ElementAt(index);
    toggle.BringIntoView(); Layout();
    var point = toggle.TranslatePoint(new Point(toggle.Bounds.Width / 2, toggle.Bounds.Height / 2), window)!.Value;
    window.MouseDown(point, MouseButton.Left, RawInputModifiers.None);
    window.MouseUp(point, MouseButton.Left, RawInputModifiers.None); Layout();
}
ToggleCode(0);
Check(added.RemainingCodes == 7 && added.BackupCodes[0].IsUsed, "Usage toggle did not update count");
Check(card.GetVisualAncestors().OfType<Viewbox>().First().GetVisualDescendants().OfType<TextBlock>()
    .Any(t => t.Text == "7 codes remaining"), "Card count binding stayed stale");
ToggleCode(0); Check(added.RemainingCodes == 8, "Undo usage failed");
for (var i = 0; i < 8; i++) ToggleCode(i);
Check(added.IsEmpty && added.RemainingLabel == "No codes remaining", "All-used state is wrong");
ToggleCode(0);
Check(added.IsLow && added.RemainingCodes == 1, "Low-code state is wrong");
for (var i = 1; i < 8; i++) ToggleCode(i);
ToggleCode(0); Click("CloseDetailsButton");
EditAt(1);
Set("BackupCodesInput", string.Join('\n', added.BackupCodes.Reverse().Select(c => c.Value)) + "\nNew-code");
Click("CreateEntryButton");
var revised = (DashboardEntry)items.Items[1]!;
Check(revised.Id == added.Id && revised.RemainingCodes == 8 && revised.BackupCodes.Count == 9
    && revised.BackupCodes.Single(c => c.Value == "0012-3456").Id == added.BackupCodes[0].Id
    && revised.BackupCodes.Single(c => c.Value == "0012-3456").IsUsed,
    "Editing reset account/code identity or usage");
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
var png = ((DashboardEntry)items.Items[1]!).Data.IconPng;
Check(png is { Length: > 8 } && png.Take(8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }), "Image not stored as PNG data");
EditAt(1);
Check(ReferenceEquals(Get<Image>("IconPreview").Source, custom), "Custom image missing on edit");
Click("CloseDetailsButton");
Set("SearchBox", "Updated service"); Layout(); EditAt(0);
Set("ServiceInput", "Renamed"); Click("CreateEntryButton");
Check(items.ItemCount == 0 && Get<TextBlock>("EmptySearch").IsVisible, "Edited filter result stayed stale");
Set("SearchBox", ""); Layout(); Check(items.ItemCount == 10, "Edit lost an entry");
EditAt(1); Set("BackupCodesInput", "\n  \n"); Click("CreateEntryButton");
Check(((DashboardEntry)items.Items[1]!).BackupCodes.Count == 0
    && ((DashboardEntry)items.Items[1]!).IsEmpty, "Removing all codes left stale counts");
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
// Persisted sessions exercise the same UI against an isolated encrypted vault.
window.Width = 1177; window.Height = 702;
var vaultPath = Path.Combine(Environment.GetEnvironmentVariable("CHECK_DIR")!, "ui-vault.bacom");
var vaultKey = System.Security.Cryptography.RandomNumberGenerator.GetBytes(32);
var store = new VaultStore(vaultPath, vaultKey);
store.Save(new VaultData());
view = new DashboardView(iconLoader, store, store.Load()); window.NavigateTo(view); Layout();
items = Get<ItemsControl>("EntriesList");
Check(items.ItemCount == 0, "Real vault contains demo entries");
Click("NewEntryButton"); Set("ServiceInput", "Saved account"); Set("AccountInput", "Test");
Set("BackupCodesInput", "001-abc\n002-def"); Click("CreateEntryButton");
Check(store.Load().Entries.Single().RemainingCodes == 2, "Create was not saved");
Settle(); EditAt(0); Set("NotesInput", "Saved notes"); Click("CreateEntryButton");
Check(store.Load().Entries.Single().Notes == "Saved notes", "Edit was not saved");
var savedEntry = (DashboardEntry)items.Items[0]!;
var savedCard = items.GetVisualDescendants().OfType<Button>().First(b => b.Classes.Contains("entry-card"));
savedCard.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Layout(); Settle();
codeList = Get<ItemsControl>("BackupCodesList"); ToggleCode(0);
Check(store.Load().Entries.Single().BackupCodes[0].IsUsed, "Usage was not saved");
Click("CloseDetailsButton");
// Block the backup target to simulate a write failure without changing permissions.
File.Delete(vaultPath + ".previous"); Directory.CreateDirectory(vaultPath + ".previous");
Click("NewEntryButton"); Set("ServiceInput", "Must not appear"); Set("AccountInput", "Test"); Click("CreateEntryButton");
Check(items.ItemCount == 1 && Get<Grid>("DetailsOverlay").IsVisible
    && Get<TextBox>("ServiceInput").Text == "Must not appear"
    && !string.IsNullOrEmpty(Get<TextBlock>("DetailsError").Text), "Failed save was not retained/reported");
Click("CloseDetailsButton");
savedCard.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Layout(); Settle();
codeList = Get<ItemsControl>("BackupCodesList"); ToggleCode(0);
Check(savedEntry.BackupCodes[0].IsUsed && store.Load().Entries.Single().BackupCodes[0].IsUsed,
    "Failed usage save changed memory or disk");
Click("CloseDetailsButton"); Directory.Delete(vaultPath + ".previous");
window.NavigateTo(new bacom.Views.LoginView()); Layout();
var reopenedStore = new VaultStore(vaultPath, vaultKey);
view = new DashboardView(iconLoader, reopenedStore, reopenedStore.Load()); window.NavigateTo(view); Layout();
items = Get<ItemsControl>("EntriesList");
Check(items.ItemCount == 1 && ((DashboardEntry)items.Items[0]!).RemainingCodes == 1, "Unlock/reopen lost saved state");
typeof(DashboardView).GetMethod("DeleteEntry", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
    .Invoke(view, [new MenuItem { DataContext = items.Items[0] }, new RoutedEventArgs()]);
Check(items.ItemCount == 0 && reopenedStore.Load().Entries.Count == 0, "Delete was not saved");
Console.WriteLine("PASS: code entry/usage, images, animations, layout, encrypted create/edit/delete, failed saves, lock/reopen");
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
