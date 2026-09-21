using System;
using Avalonia.Controls;
using Avalonia.Interactivity;

namespace bacom.Views;

public partial class DashboardView : UserControl
{
    public DashboardView()
    {
        InitializeComponent();
    }

    private void Logout(object? sender, RoutedEventArgs e)
    {
        var root = VisualRoot as MainWindow ?? TopLevel.GetTopLevel(this) as MainWindow;
        Console.WriteLine($"Resolved root: {root?.GetType().FullName ?? "null"}");
        if (root is MainWindow mainWindow)
        {
            Console.WriteLine("Navigating to LoginView...");
            mainWindow.NavigateTo(new LoginView());
        }
        else
        {
            Console.WriteLine("ERROR: Could not find MainWindow in visual tree");
        }
    }
}
