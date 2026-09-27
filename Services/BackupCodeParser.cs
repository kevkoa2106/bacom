using System;
using System.Collections.Generic;
using System.Linq;
using bacom.Models;

namespace bacom.Services;

public static class BackupCodeParser
{
    // One code per line. Preserve internal separators and leading zeros, ignore blank lines.
    // Reusing matching codes preserves identity and usage even when the list is reordered.
    public static List<BackupCode> Parse(string? text, IReadOnlyList<BackupCode>? previous = null)
    {
        var values = (text ?? string.Empty).Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Select(value => value.Trim()).Where(value => value.Length > 0).ToArray();
        if (values.Length > 1000 || values.Any(value => value.Length > 256))
            throw new ArgumentException("Use at most 1,000 codes, with up to 256 characters per code.");
        if (values.Distinct(StringComparer.Ordinal).Count() != values.Length)
            throw new ArgumentException("Each backup code must be unique. Remove duplicate lines.");

        return values.Select(value => previous?.FirstOrDefault(code => code.Value == value)
            ?? new BackupCode { Value = value }).ToList();
    }
}
