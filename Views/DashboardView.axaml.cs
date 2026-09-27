using System;
using System.Linq;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Avalonia;
using Avalonia.Animation;
using Avalonia.Animation.Easings;
using Avalonia.Media;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Input;
using Avalonia.Threading;
using Avalonia.VisualTree;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Media.Imaging;
using Avalonia.Platform.Storage;
using bacom.Models;
using bacom.Services;

namespace bacom.Views;

public partial class DashboardView : UserControl
{
    // Demo fixtures are used only by the designer and the headless UI check.
    private readonly List<DashboardEntry> _entries =
    [
        SampleEntry("GitHub", "personal@example.com", "https://github.com"),
        SampleEntry("Google", "personal@example.com", "https://accounts.google.com"),
        SampleEntry("Discord", "Personal", "https://discord.com"),
        SampleEntry("Microsoft", "work@example.com", "https://account.microsoft.com"),
        SampleEntry("GitHub", "work@example.com", "https://github.com"),
        SampleEntry("Dropbox", "Personal", "https://dropbox.com"),
        SampleEntry("Proton", "personal@example.com", "https://account.proton.me"),
        SampleEntry("Bitwarden", "Personal", "https://vault.bitwarden.com"),
    ];

    // Demo accounts have no invented recovery codes or manually assigned counts.
    private static DashboardEntry SampleEntry(string service, string account, string website) => new(new VaultEntry
    {
        ServiceName = service, AccountLabel = account, Website = website,
        Notes = "Demo account. Add your own backup codes using Edit.",
    });

    private readonly ObservableCollection<DashboardEntry> _visibleEntries = [];
    private Button? _openedCard;
    private DashboardEntry? _editingEntry;
    private string _appliedSearch = string.Empty;
    private readonly EntryIconLoader _iconLoader;
    private readonly VaultStore? _store;
    private CancellationTokenSource? _iconRequest;
    private Bitmap? _draftIcon;
    private bool _customIcon;
    private bool _ownsDraftIcon;
    private int _iconSession;
    private string _iconWebsite = string.Empty;

    public DashboardView() : this(new EntryIconLoader()) { }

    public DashboardView(EntryIconLoader iconLoader, VaultStore? store = null, VaultData? data = null)
    {
        _iconLoader = iconLoader;
        _store = store;
        if (store is not null)
        {
            if (data is null) throw new ArgumentNullException(nameof(data));
            LoadEntries(data);
        }
        InitializeComponent();
        EntriesList.ItemsSource = _visibleEntries;
        RefreshEntries();
        SessionNotice.Text = DetailsNotice.Text = store is null
            ? "Demo session. Changes are not saved."
            : "Changes are saved to your encrypted vault automatically.";
    }

    private void LoadEntries(VaultData data)
    {
        var loaded = new List<DashboardEntry>();
        try
        {
            foreach (var entry in data.Entries)
            {
                Bitmap? image = null;
                if (entry.IconPng is not null)
                {
                    using var stream = new MemoryStream(entry.IconPng);
                    image = EntryIconLoader.LoadImageAsync(stream, CancellationToken.None).GetAwaiter().GetResult();
                }
                loaded.Add(new DashboardEntry(entry) { Icon = image });
            }
        }
        catch { foreach (var entry in loaded) entry.Icon?.Dispose(); throw; }
        foreach (var entry in _entries) entry.Icon?.Dispose();
        _entries.Clear(); _entries.AddRange(loaded);
    }

    // Backups: restore is confirmed in the dialog before the store replaces any data.
    private async void OpenBackups(object? sender, RoutedEventArgs e)
    {
        if (_store is null || TopLevel.GetTopLevel(this) is not Window owner) return;
        var dialog = new BackupWindow(() => new VaultData { Entries = _entries.Select(entry => entry.Data).ToList() },
            data => Task.Run(() => _store.Restore(data)), _store.FilePath);
        if (await dialog.ShowDialog<bool>(owner))
        {
            try
            {
                LoadEntries(_store.Load());
                SearchBox.Text = string.Empty;
                RefreshEntries();
                DashboardError.Text = string.Empty;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException
                or System.Security.Cryptography.CryptographicException or System.Text.Json.JsonException)
            {
                // Do not leave old editable accounts visible after a successful replacement.
                if (owner is MainWindow window) window.NavigateTo(new LoginView());
            }
        }
    }

    // Persistence: commit to disk before changing the visible cards. Failed writes keep the form open.
    private bool TryPersist(IEnumerable<DashboardEntry> entries)
    {
        DashboardError.Text = DetailsError.Text = string.Empty;
        try { _store?.Save(new VaultData { Entries = entries.Select(entry => entry.Data).ToList() }); return true; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException
            or System.Security.Cryptography.CryptographicException or System.Text.Json.JsonException)
        {
            const string message = "Could not save. The change was not applied. Check disk space and file access, then try again.";
            DashboardError.Text = DetailsError.Text = message;
            return false;
        }
    }

    // Search and empty states
    private void SearchEntries(object? sender, TextChangedEventArgs e)
    {
        // TextChanged can fire while InitializeComponent is still building the view.
        if (EntriesList is null || EmptySearch is null)
            return;

        if ((SearchBox.Text?.Trim() ?? string.Empty) != _appliedSearch)
            RefreshEntries();
    }

    private void RefreshEntries()
    {
        var query = SearchBox.Text?.Trim() ?? string.Empty;
        _appliedSearch = query;
        var matches = _entries
            .Where(entry => entry.ServiceName.Contains(query, StringComparison.OrdinalIgnoreCase)
                || entry.AccountLabel.Contains(query, StringComparison.OrdinalIgnoreCase))
            .ToArray();

        _visibleEntries.Clear();
        foreach (var entry in matches)
            _visibleEntries.Add(entry);
        UpdateEmptyState();
    }

    private void UpdateEmptyState()
    {
        EmptySearch.IsVisible = _visibleEntries.Count == 0;
        EmptySearch.Text = _entries.Count == 0 ? "No entries yet." : "No entries found.";
    }

    // Entry deletion
    private void DeleteEntry(object? sender, RoutedEventArgs e)
    {
        if (sender is not MenuItem { DataContext: DashboardEntry entry })
            return;

        // Use identity so two accounts with identical display details remain independent.
        var sourceIndex = _entries.FindIndex(item => ReferenceEquals(item, entry));
        var visibleIndex = Enumerable.Range(0, _visibleEntries.Count)
            .FirstOrDefault(index => ReferenceEquals(_visibleEntries[index], entry), -1);
        if (sourceIndex < 0 || visibleIndex < 0)
            return;

        if (!TryPersist(_entries.Where(item => !ReferenceEquals(item, entry)))) return;

        var positions = CaptureCardPositions();
        _entries.RemoveAt(sourceIndex);
        _visibleEntries.RemoveAt(visibleIndex);
        AnimateCardPositions(positions);
        entry.Icon?.Dispose();
    }

    // Animations: shared by insertion and deletion, including interrupted slides.
    private Dictionary<DashboardEntry, Point> CaptureCardPositions()
    {
        // Capture visual positions, including any slide that is still in progress.
        var positions = new Dictionary<DashboardEntry, Point>(ReferenceEqualityComparer.Instance);
        foreach (var container in EntriesList.GetRealizedContainers())
        {
            if (container.DataContext is DashboardEntry item
                && container.TranslatePoint(default, EntriesList) is { } position)
                positions[item] = position;
        }
        foreach (var container in EntriesList.GetRealizedContainers())
            container.RenderTransform = null;

        return positions;
    }

    private void AnimateCardPositions(Dictionary<DashboardEntry, Point> positions)
    {
        UpdateEmptyState();
        EntriesList.UpdateLayout();

        // Layout assigns the new slots; a temporary offset slides each card into place.
        foreach (var container in EntriesList.GetRealizedContainers())
        {
            if (container.DataContext is not DashboardEntry item
                || !positions.TryGetValue(item, out var previous)
                || container.TranslatePoint(default, EntriesList) is not { } current)
                continue;

            var delta = previous - current;
            if (Math.Abs(delta.X) < 0.1 && Math.Abs(delta.Y) < 0.1)
                continue;

            var offset = new TranslateTransform(delta.X, delta.Y);
            container.RenderTransform = offset;
            offset.Transitions =
            [
                new DoubleTransition
                {
                    Property = TranslateTransform.XProperty,
                    Duration = TimeSpan.FromMilliseconds(260),
                    Easing = new CubicEaseOut(),
                },
                new DoubleTransition
                {
                    Property = TranslateTransform.YProperty,
                    Duration = TimeSpan.FromMilliseconds(260),
                    Easing = new CubicEaseOut(),
                },
            ];
            offset.X = 0;
            offset.Y = 0;
        }
    }

    // Responsive card sizing
    private void ResizeCards(object? sender, SizeChangedEventArgs e)
    {
        const double minimumCardWidth = 180;
        const double gap = 56;
        var availableWidth = e.NewSize.Width;
        if (availableWidth <= 0)
            return;

        var columns = Math.Clamp((int)((availableWidth + gap) / (minimumCardWidth + gap)), 1, 4);
        var cardWidth = Math.Min(280, (availableWidth - (columns - 1) * gap) / columns);

        // Scale the entire 220 × 200 card, so text, spacing, badges and hit targets agree.
        Resources["DashboardCardWidth"] = cardWidth;
        Resources["DashboardCardHeight"] = cardWidth * 200 / 220;
        EntriesList.Width = columns * cardWidth + (columns - 1) * gap;
    }

    // Entry details, creation and editing share one modal and opening animation.
    private void OpenEntry(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { DataContext: DashboardEntry entry } card)
            return;

        DetailsPanel.DataContext = entry;
        ShowEntryPopup(card, showForm: false);
        e.Handled = true;
    }

    private void OpenNewEntry(object? sender, RoutedEventArgs e)
    {
        _editingEntry = null;
        ResetIconEditor();
        ServiceInput.Text = AccountInput.Text = WebsiteInput.Text = NotesInput.Text = string.Empty;
        BackupCodesInput.Text = string.Empty;
        FormError.IsVisible = false;
        DetailsPanel.DataContext = null;
        ShowEntryPopup(sender as Button, showForm: true);
        e.Handled = true;
    }

    private void EditEntry(object? sender, RoutedEventArgs e)
    {
        if (sender is not MenuItem { DataContext: DashboardEntry entry })
            return;

        // Let the flyout dismiss before moving keyboard focus into the form.
        Dispatcher.UIThread.Post(() =>
        {
            ResetIconEditor();
            _editingEntry = entry;
            ServiceInput.Text = entry.ServiceName;
            AccountInput.Text = entry.AccountLabel;
            WebsiteInput.Text = entry.Data.Website ?? string.Empty;
            SetDraftIcon(entry.Icon, entry.HasCustomIcon, ownsImage: false);
            _iconWebsite = WebsiteInput.Text ?? string.Empty;
            BackupCodesInput.Text = string.Join(Environment.NewLine, entry.BackupCodes.Select(code => code.Value));
            NotesInput.Text = entry.Data.Notes;
            FormError.IsVisible = false;
            DetailsPanel.DataContext = null;
            var source = EntriesList.GetVisualDescendants().OfType<Button>()
                .FirstOrDefault(button => button.Classes.Contains("entry-card") && ReferenceEquals(button.DataContext, entry));
            ShowEntryPopup(source, showForm: true);
            if (entry.Icon is null) DetectWebsiteIcon();
        });
    }

    private void ShowEntryPopup(Button? source, bool showForm)
    {
        DetailsError.Text = string.Empty;
        _openedCard = source;
        DetailsContent.IsVisible = DetailsTitle.IsVisible = !showForm;
        EntryForm.IsVisible = NewEntryTitle.IsVisible = showForm;
        ModalLabel.Text = !showForm ? "ENTRY DETAILS" : _editingEntry is null ? "NEW ENTRY" : "EDIT ENTRY";
        NewEntryTitle.Text = _editingEntry is null ? "Add an account" : "Edit account";
        CreateEntryButton.Content = _editingEntry is null ? "Create" : "Apply";
        FormScroll.Offset = default;
        DashboardContent.IsEnabled = false;
        DetailsOverlay.IsVisible = true;
        DetailsOverlay.Classes.Add("details-opening");
        DetailsPanel.Classes.Add("details-opening");
        DetailsOverlay.UpdateLayout();
        if (showForm)
            ServiceInput.Focus();
        else
            CloseDetailsButton.Focus();
    }

    private void SaveEntry(object? sender, RoutedEventArgs e)
    {
        if (!DetailsOverlay.IsVisible || !EntryForm.IsVisible)
            return;

        var service = ServiceInput.Text?.Trim() ?? string.Empty;
        var account = AccountInput.Text?.Trim() ?? string.Empty;
        var website = WebsiteInput.Text?.Trim() ?? string.Empty;
        var notes = NotesInput.Text?.Trim() ?? string.Empty;
        string? error = null;
        if (service.Length == 0 || account.Length == 0)
            error = "Enter a service name and an account label.";
        else if (website.Length > 0 && !IsWebAddress(website))
            error = "Enter a website starting with https:// or http://.";

        List<BackupCode> codes = [];
        if (error is null)
        {
            try { codes = BackupCodeParser.Parse(BackupCodesInput.Text, _editingEntry?.BackupCodes); }
            catch (ArgumentException exception) { error = exception.Message; }
        }

        if (error is not null)
        {
            FormError.Text = error;
            FormError.IsVisible = true;
            return;
        }

        // Store portable image bytes alongside account data; the UI retains its bitmap.
        byte[]? iconPng = null;
        if (_draftIcon is not null)
        {
            using var imageStream = new MemoryStream();
            _draftIcon.Save(imageStream, PngBitmapEncoderOptions.Default);
            iconPng = imageStream.ToArray();
        }
        var entry = new DashboardEntry(new VaultEntry
        {
            Id = _editingEntry?.Id ?? Guid.NewGuid(),
            ServiceName = service,
            AccountLabel = account,
            Website = website.Length == 0 ? null : website,
            Notes = notes,
            BackupCodes = codes,
            IconPng = iconPng,
            HasCustomIcon = _customIcon,
        })
        {
            Icon = _draftIcon,
        };

        var pending = _entries.ToList();
        if (_editingEntry is { } editing)
        {
            var index = pending.FindIndex(item => ReferenceEquals(item, editing));
            if (index < 0) return;
            pending[index] = entry;
        }
        else pending.Insert(0, entry);
        if (!TryPersist(pending)) return;

        var positions = CaptureCardPositions();
        if (_editingEntry is { } original)
        {
            var index = _entries.FindIndex(item => ReferenceEquals(item, original));
            if (index < 0)
                return;
            _entries[index] = entry;
            RefreshEntries();
            if (!ReferenceEquals(original.Icon, entry.Icon)) original.Icon?.Dispose();
        }
        else
        {
            // Clear filtering so the newly created card is always visible in the first position.
            SearchBox.Text = string.Empty;
            RefreshEntries();
            _entries.Insert(0, entry);
            _visibleEntries.Insert(0, entry);
            CardsScroll.Offset = default;
        }
        AnimateCardPositions(positions);
        _ownsDraftIcon = false; // The saved entry now owns this image.
        CloseEntry(sender, e);
    }

    // Code usage: an explicit toggle updates both the details panel and dashboard badge.
    private void ChangeCodeUsage(object? sender, RoutedEventArgs e)
    {
        if (sender is CheckBox { DataContext: BackupCode code } checkBox
            && DetailsPanel.DataContext is DashboardEntry entry)
        {
            var original = code.IsUsed;
            var next = checkBox.IsChecked == true;
            code.IsUsed = next;
            var saved = TryPersist(_entries);
            code.IsUsed = original;
            if (saved) entry.SetCodeUsed(code, next);
            else checkBox.IsChecked = original;
        }
    }

    // Account images: custom uploads win over cancellable, debounced website lookup.
    private void WebsiteChanged(object? sender, TextChangedEventArgs e)
    {
        if (_iconWebsite == WebsiteInput.Text?.Trim() && (_draftIcon is not null || _iconRequest is not null)) return;
        if (DetailsOverlay?.IsVisible == true && EntryForm?.IsVisible == true && !_customIcon)
            DetectWebsiteIcon();
    }

    private void SetDraftIcon(Bitmap? icon, bool custom, bool ownsImage)
    {
        if (_ownsDraftIcon && !ReferenceEquals(_draftIcon, icon)) _draftIcon?.Dispose();
        _draftIcon = icon;
        _customIcon = custom;
        _ownsDraftIcon = ownsImage;
        IconPreview.Source = icon;
        IconPlaceholder.IsVisible = icon is null;
        IconStatus.Text = icon is null ? "Choose an image or enter a website." : custom ? "Custom image" : "Website icon";
    }

    private void CancelIconRequest()
    {
        _iconRequest?.Cancel();
        _iconRequest?.Dispose();
        _iconRequest = null;
    }

    private void ResetIconEditor()
    {
        ++_iconSession;
        _iconWebsite = string.Empty;
        CancelIconRequest();
        SetDraftIcon(null, custom: false, ownsImage: false);
    }

    private async void DetectWebsiteIcon()
    {
        CancelIconRequest();
        if (_customIcon) return;
        SetDraftIcon(null, custom: false, ownsImage: false);
        var website = WebsiteInput.Text?.Trim() ?? string.Empty;
        _iconWebsite = website;
        if (!IsWebAddress(website)) return;

        var request = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        _iconRequest = request;
        var token = request.Token;
        IconStatus.Text = "Finding website icon…";
        try
        {
            await Task.Delay(500, token);
            var icon = await _iconLoader.FindAsync(new Uri(website), token);
            if (!ReferenceEquals(_iconRequest, request) || _customIcon || !DetailsOverlay.IsVisible)
            {
                icon?.Dispose();
                return;
            }
            SetDraftIcon(icon, custom: false, ownsImage: icon is not null);
            if (icon is null) IconStatus.Text = "No icon found. Choose a custom image.";
        }
        catch (OperationCanceledException)
        {
            if (ReferenceEquals(_iconRequest, request)) IconStatus.Text = "Couldn't load an icon. Choose an image or try again.";
        }
        catch (Exception ex) when (ex is System.Net.Http.HttpRequestException or IOException or ArgumentException or NotSupportedException)
        {
            if (ReferenceEquals(_iconRequest, request)) IconStatus.Text = "Couldn't load an icon. Choose an image or try again.";
        }
        finally
        {
            if (ReferenceEquals(_iconRequest, request)) _iconRequest = null;
            request.Dispose();
        }
    }

    private void UseWebsiteIcon(object? sender, RoutedEventArgs e)
    {
        _customIcon = false;
        DetectWebsiteIcon();
    }

    private async void ChooseIcon(object? sender, RoutedEventArgs e)
    {
        var storage = TopLevel.GetTopLevel(this)?.StorageProvider;
        if (storage?.CanOpen != true)
        {
            IconStatus.Text = "The file picker isn't available here.";
            return;
        }
        CancelIconRequest();
        SetDraftIcon(_draftIcon, _customIcon, _ownsDraftIcon);
        var session = _iconSession;
        try
        {
            var files = await storage.OpenFilePickerAsync(new FilePickerOpenOptions
            {
                Title = "Choose account image",
                AllowMultiple = false,
                FileTypeFilter = [new FilePickerFileType("Images") { Patterns = ["*.png", "*.jpg", "*.jpeg", "*.webp", "*.ico"] }],
            });
            if (session != _iconSession || files.Count == 0) return;
            using var file = files[0];
            using var stream = await file.OpenReadAsync();
            var icon = await EntryIconLoader.LoadImageAsync(stream, CancellationToken.None);
            if (session != _iconSession) { icon.Dispose(); return; }
            CancelIconRequest();
            SetDraftIcon(icon, custom: true, ownsImage: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException or InvalidOperationException)
        {
            if (session == _iconSession) IconStatus.Text = "Choose a PNG, JPEG, WebP or ICO under 2 MB and 4096 × 4096 pixels.";
        }
    }

    protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
    {
        ResetIconEditor();
        _store?.Dispose();
        foreach (var entry in _entries) entry.Icon?.Dispose();
        _visibleEntries.Clear();
        _entries.Clear();
        DetailsPanel.DataContext = null;
        BackupCodesInput.Text = NotesInput.Text = string.Empty;
        base.OnDetachedFromVisualTree(e);
    }

    private static bool IsWebAddress(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

    private void CloseEntry(object? sender, RoutedEventArgs e)
    {
        ResetIconEditor();
        DetailsOverlay.IsVisible = false;
        DetailsOverlay.Classes.Remove("details-opening");
        DetailsPanel.Classes.Remove("details-opening");
        DetailsPanel.DataContext = null;
        DashboardContent.IsEnabled = true;
        if (_openedCard?.Focus() != true)
            NewEntryButton.Focus();
        _openedCard = null;
        _editingEntry = null;
        e.Handled = true;
    }

    private void DetailsKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
            CloseEntry(sender, e);
    }

    private void Logout(object? sender, RoutedEventArgs e)
    {
        if (TopLevel.GetTopLevel(this) is MainWindow mainWindow)
            mainWindow.NavigateTo(new LoginView());
    }
}
