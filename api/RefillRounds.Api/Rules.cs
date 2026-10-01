namespace RefillRounds.Api;

/// <summary>
/// Business rules shared with the app (see src/config.ts, src/domain/orderStatus.ts
/// and src/domain/validation.ts). The server is the source of truth; the app
/// runs the same checks only to give instant feedback.
/// </summary>
public static class Rules
{
    public static readonly TimeSpan SessionTimeout = TimeSpan.FromMinutes(5);
    public const decimal HighCostThresholdUsd = 500m;
    public const int NoteMaxLength = 200;
    public const int ReasonMinLength = 5;
    private const int ProgressSteps = 4; // submitted -> verified -> filled -> out for delivery -> delivered

    public static TimeSpan StepLength(Priority priority) =>
        priority == Priority.Stat ? TimeSpan.FromSeconds(30) : TimeSpan.FromSeconds(60);

    public static bool NeedsFacilityApproval(Medication med) => med.CostPerFill >= HighCostThresholdUsd;

    /// <summary>Open = not yet delivered and not denied.</summary>
    public static bool IsOpen(Order order, DateTimeOffset now)
    {
        if (order.Approval?.State == ApprovalState.Denied) return false;
        if (order.Hold is not null || order.Approval?.State == ApprovalState.Pending) return true;
        if (order.ProcessingStartedAt is null) return true;
        var deliveredAt = order.ProcessingStartedAt.Value + StepLength(order.Priority) * ProgressSteps;
        return now < deliveredAt;
    }

    /// <summary>Returns an error message, or null when the request is valid.</summary>
    public static string? ValidateRefill(RefillRequest request)
    {
        var note = request.Note?.Trim() ?? "";
        if (request.MedicationIds.Count == 0) return "Select at least one medication.";
        if (request.Priority == Priority.Stat && note.Length < ReasonMinLength)
            return "STAT requests need a short clinical reason for the pharmacist.";
        if (note.Length > NoteMaxLength) return $"Keep the note under {NoteMaxLength} characters.";
        return null;
    }

    public static string? ValidateReason(string? reason) =>
        (reason?.Trim().Length ?? 0) < ReasonMinLength
            ? $"Enter a reason (at least {ReasonMinLength} characters)."
            : null;
}
