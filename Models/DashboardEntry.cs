namespace bacom.Models;

// Display data only; backup codes belong in the vault, not on dashboard cards.
public sealed record DashboardEntry(string ServiceName, string AccountLabel, int RemainingCodes)
{
    public string Website { get; init; } = "Not added";
    public string Notes { get; init; } = "No notes yet.";

    public bool IsLow => RemainingCodes is > 0 and <= 2;
    public bool IsEmpty => RemainingCodes == 0;

    public string RemainingLabel => RemainingCodes switch
    {
        0 => "No codes remaining",
        1 => "1 code remaining",
        _ => $"{RemainingCodes} codes remaining",
    };
}
