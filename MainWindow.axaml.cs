using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using Avalonia.Controls;
using bacom.Views;

namespace bacom;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        NavigateTo(new LoginView());
    }

    public void NavigateTo(UserControl view)
    {
        ViewHost.Content = view;
    }
}
