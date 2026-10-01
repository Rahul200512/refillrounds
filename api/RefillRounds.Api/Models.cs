namespace RefillRounds.Api;

// DTOs returned by the API. They mirror src/models.ts in the React Native app
// one-to-one, so the app can switch from its mock to this API without changes.
// Enums are serialized as snake_case strings (e.g. RenewalNeeded -> "renewal_needed").

public enum FillType { Cycle, Prn, Course }
public enum Priority { Routine, Stat }
public enum HoldReason { RenewalNeeded, InsuranceNotCovered }
public enum ApprovalState { Pending, Approved, Denied }
public enum DeliveryItemStatus { Pending, Received, Missing, Damaged }
public enum AuditAction
{
    SignedIn, SignedOut, SessionLocked, RefillRequested, OrderHeld, OrderApproved,
    OrderDenied, HoldResolved, DeliveryItemFlagged, DeliveryConfirmed, DemoReset,
}

public record Unit(string Id, string Name);
public record Facility(string Id, string Name, IReadOnlyList<Unit> Units);

public record Resident(string Id, string FirstName, string LastName, string Room, string UnitId, IReadOnlyList<string> Allergies);

public record Medication(
    string Id,
    string ResidentId,
    string Name,
    string Strength,
    string Form,
    string Directions,
    string Prescriber,
    FillType FillType,
    int DaysSupply,
    DateTimeOffset LastFilledAt,
    decimal CostPerFill);

public record OrderHold(HoldReason Reason, string Detail, DateTimeOffset Since);

public record OrderApproval(
    ApprovalState State,
    decimal EstimatedCost,
    DateTimeOffset? DecidedAt = null,
    string? DecidedBy = null,
    string? DenialReason = null);

public record OrderEvent(DateTimeOffset At, string Label);

public record Order(
    string Id,
    string ResidentId,
    string MedicationId,
    Priority Priority,
    string? Note,
    DateTimeOffset SubmittedAt,
    string SubmittedBy,
    OrderHold? Hold,
    OrderApproval? Approval,
    DateTimeOffset? ProcessingStartedAt,
    IReadOnlyList<OrderEvent> History);

public record DeliveryItem(string Id, string ResidentId, string Description, string Quantity, string? HandlingNote, DeliveryItemStatus Status);

public record Delivery(
    string Id,
    string PackingSlipNumber,
    DateTimeOffset Date,
    string Window,
    string Route,
    IReadOnlyList<DeliveryItem> Items,
    DateTimeOffset? ConfirmedAt = null,
    string? ConfirmedBy = null);

public record AuditEntry(string Id, DateTimeOffset At, string User, AuditAction Action, string Summary);

public record Session(string Username, string DisplayName, string Role, DateTimeOffset SignedInAt, DateTimeOffset LastActiveAt);

// ---- Request bodies ----

public record SignInRequest(string Username, string Password);
public record SignInResponse(string Token, Session Session);
public record SignOutRequest(string Reason);
public record RefillRequest(string ResidentId, IReadOnlyList<string> MedicationIds, Priority Priority, string? Note);
public record DenyRequest(string Reason);
public record ResolveHoldRequest(string Resolution);
public record UpdateDeliveryItemRequest(DeliveryItemStatus Status);
