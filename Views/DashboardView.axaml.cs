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
using bacom.Models;

namespace bacom.Views;

public partial class DashboardView : UserControl
{
    // Layout samples only. Replace with vault entries once storage is implemented.
    private readonly List<DashboardEntry> _sampleEntries =
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

    public DashboardView()
    {
        InitializeComponent();
        EntriesList.ItemsSource = _visibleEntries;
        RefreshEntries();
    }

    private void SearchEntries(object? sender, TextChangedEventArgs e)
    {
        // TextChanged can fire while InitializeComponent is still building the view.
        if (EntriesList is null || EmptySearch is null)
            return;

        RefreshEntries();
    }

    private void RefreshEntries()
    {
        var query = SearchBox.Text?.Trim() ?? string.Empty;
        var matches = _sampleEntries
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
        EmptySearch.Text = _sampleEntries.Count == 0 ? "No entries yet." : "No entries found.";
    }

    private void DeleteEntry(object? sender, RoutedEventArgs e)
    {
        if (sender is not MenuItem { DataContext: DashboardEntry entry })
            return;

        // Use identity so two accounts with identical display details remain independent.
        var sourceIndex = _sampleEntries.FindIndex(item => ReferenceEquals(item, entry));
        var visibleIndex = Enumerable.Range(0, _visibleEntries.Count)
            .FirstOrDefault(index => ReferenceEquals(_visibleEntries[index], entry), -1);
        if (sourceIndex < 0 || visibleIndex < 0)
            return;

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

        _sampleEntries.RemoveAt(sourceIndex);
        _visibleEntries.RemoveAt(visibleIndex);
        UpdateEmptyState();
        EntriesList.UpdateLayout();

        // Layout closes the gap immediately; a temporary offset slides each card into place.
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

    private void OpenEntry(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { DataContext: DashboardEntry entry } card)
            return;

        _openedCard = card;
        DetailsPanel.DataContext = entry;
        DashboardContent.IsEnabled = false;
        DetailsOverlay.IsVisible = true;
        DetailsOverlay.Classes.Add("details-opening");
        DetailsPanel.Classes.Add("details-opening");
        CloseDetailsButton.Focus();
        e.Handled = true;
    }

    private void CloseEntry(object? sender, RoutedEventArgs e)
    {
        DetailsOverlay.IsVisible = false;
        DetailsOverlay.Classes.Remove("details-opening");
        DetailsPanel.Classes.Remove("details-opening");
        DetailsPanel.DataContext = null;
        DashboardContent.IsEnabled = true;
        _openedCard?.Focus();
        _openedCard = null;
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
