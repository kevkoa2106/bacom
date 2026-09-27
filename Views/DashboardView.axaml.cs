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
    // ponytail: entries live in memory; add encrypted persistence when vault storage is implemented.
    private readonly List<DashboardEntry> _entries =
    [
        new("GitHub", "personal@example.com", 8) { Website = "https://github.com" },
        new("Google", "personal@example.com", 10) { Website = "https://accounts.google.com" },
        new("Discord", "Personal", 2) { Website = "https://discord.com" },
        new("Microsoft", "work@example.com", 1) { Website = "https://account.microsoft.com" },
        new("GitHub", "work@example.com", 5) { Website = "https://github.com" },
        new("Dropbox", "Personal", 0) { Website = "https://dropbox.com" },
        new("Proton", "personal@example.com", 7) { Website = "https://account.proton.me" },
        new("Bitwarden", "Personal", 1) { Website = "https://vault.bitwarden.com" },
    ];

    private readonly ObservableCollection<DashboardEntry> _visibleEntries = [];
    private Button? _openedCard;
    private DashboardEntry? _editingEntry;
    private string _appliedSearch = string.Empty;
    private readonly EntryIconLoader _iconLoader;
    private CancellationTokenSource? _iconRequest;
    private Bitmap? _draftIcon;
    private bool _customIcon;
    private bool _ownsDraftIcon;
    private int _iconSession;
    private string _iconWebsite = string.Empty;

    public DashboardView() : this(new EntryIconLoader()) { }

    public DashboardView(EntryIconLoader iconLoader)
    {
        _iconLoader = iconLoader;
        InitializeComponent();
        EntriesList.ItemsSource = _visibleEntries;
        RefreshEntries();
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
        CodeCountInput.Text = "0";
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
            WebsiteInput.Text = entry.Website == "Not added" ? string.Empty : entry.Website;
            SetDraftIcon(entry.Icon, entry.HasCustomIcon, ownsImage: false);
            _iconWebsite = WebsiteInput.Text ?? string.Empty;
            CodeCountInput.Text = entry.RemainingCodes.ToString();
            NotesInput.Text = entry.Notes == "No notes yet." ? string.Empty : entry.Notes;
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
        var validCount = int.TryParse(CodeCountInput.Text, out var count) && count is >= 0 and <= 9999;
        string? error = null;
        if (service.Length == 0 || account.Length == 0)
            error = "Enter a service name and an account label.";
        else if (!validCount)
            error = "Enter a whole code count from 0 to 9999.";
        else if (website.Length > 0 && !IsWebAddress(website))
            error = "Enter a website starting with https:// or http://.";

        if (error is not null)
        {
            FormError.Text = error;
            FormError.IsVisible = true;
            return;
        }

        var entry = new DashboardEntry(service, account, count)
        {
            Website = website.Length == 0 ? "Not added" : website,
            Notes = notes.Length == 0 ? "No notes yet." : notes,
            Icon = _draftIcon,
            HasCustomIcon = _customIcon,
        };

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
