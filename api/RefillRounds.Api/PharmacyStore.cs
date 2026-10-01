using System.Security.Cryptography;

namespace RefillRounds.Api;

/// <summary>An error the API turns into an RFC 7807 problem response.</summary>
public class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

/// <summary>
/// In-memory data store with the business rules. Registered as a singleton;
/// a lock keeps concurrent requests consistent. A production version would
/// replace this with EF Core + SQL Server behind the same methods.
/// </summary>
public class PharmacyStore(TimeProvider time)
{
    private const string DemoUsername = "nurse.demo";
    private const string DemoPassword = "Demo1234"; // demo only; real auth would use an identity provider
    private const string DemoDisplayName = "Jordan Lee, RN";

    private readonly Lock _gate = new();
    private readonly Dictionary<string, Session> _sessions = new();
    private PharmacyData? _data;

    private DateTimeOffset Now => time.GetUtcNow();

    // ---- Auth ---------------------------------------------------------------

    public SignInResponse SignIn(SignInRequest request)
    {
        lock (_gate)
        {
            if (!string.Equals(request.Username?.Trim(), DemoUsername, StringComparison.OrdinalIgnoreCase) ||
                request.Password != DemoPassword)
            {
                throw new ApiException(401, "Incorrect username or password.");
            }

            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var session = new Session(DemoUsername, DemoDisplayName, "Charge Nurse", Now, Now);
            _sessions[token] = session;
            AddAudit(session.DisplayName, AuditAction.SignedIn, "Signed in");
            return new SignInResponse(token, session);
        }
    }

    /// <summary>Validates a token, enforcing the inactivity timeout on the server too.</summary>
    public Session Authenticate(string? token)
    {
        lock (_gate)
        {
            if (token is null || !_sessions.TryGetValue(token, out var session))
                throw new ApiException(401, "Your session has ended. Please sign in again.");

            if (Now - session.LastActiveAt >= Rules.SessionTimeout)
            {
                _sessions.Remove(token);
                AddAudit(session.DisplayName, AuditAction.SessionLocked, "Session locked after inactivity");
                throw new ApiException(401, "Your session has ended. Please sign in again.");
            }

            var refreshed = session with { LastActiveAt = Now };
            _sessions[token] = refreshed;
            return refreshed;
        }
    }

    public void SignOut(string token, string reason)
    {
        lock (_gate)
        {
            if (!_sessions.Remove(token, out var session)) return;
            if (reason == "inactivity")
                AddAudit(session.DisplayName, AuditAction.SessionLocked, "Session locked after inactivity");
            else
                AddAudit(session.DisplayName, AuditAction.SignedOut, "Signed out");
        }
    }

    // ---- Reads --------------------------------------------------------------

    public IReadOnlyList<Medication> GetMedications() { lock (_gate) return Data.Medications.ToList(); }
    public IReadOnlyList<Order> GetOrders() { lock (_gate) return Data.Orders.ToList(); }
    public Delivery GetTodaysDelivery() { lock (_gate) return Data.Delivery; }
    public IReadOnlyList<AuditEntry> GetAuditLog() { lock (_gate) return Data.Audit.ToList(); }

    // ---- Orders -------------------------------------------------------------

    public IReadOnlyList<Order> RequestRefill(string user, RefillRequest request)
    {
        lock (_gate)
        {
            var error = Rules.ValidateRefill(request);
            if (error is not null) throw new ApiException(400, error);

            var resident = Seed.Residents.FirstOrDefault(r => r.Id == request.ResidentId)
                ?? throw new ApiException(404, "Resident not found.");

            // Validate every medication first so the request is all-or-nothing.
            var meds = request.MedicationIds.Select(id =>
            {
                var med = Data.Medications.FirstOrDefault(m => m.Id == id && m.ResidentId == resident.Id)
                    ?? throw new ApiException(404, "Medication not found for this resident.");
                if (Data.Orders.Any(o => o.MedicationId == med.Id && Rules.IsOpen(o, Now)))
                    throw new ApiException(409, $"{med.Name} already has an open order.");
                return med;
            }).ToList();

            var isStat = request.Priority == Priority.Stat;
            var created = meds.Select(med =>
            {
                var needsApproval = Rules.NeedsFacilityApproval(med);
                List<OrderEvent> history = [new(Now, isStat ? "Submitted (STAT)" : "Submitted")];
                if (needsApproval) history.Add(new(Now, "Sent for facility approval: high-cost medication"));

                AddAudit(user, AuditAction.RefillRequested,
                    $"Requested {med.Name} {med.Strength} for {resident.FirstName} {resident.LastName}{(isStat ? " (STAT)" : "")}" +
                    (needsApproval ? $" — needs facility approval (${med.CostPerFill:N0})" : ""));

                return new Order(
                    Id: $"ord-{Guid.NewGuid():N}"[..16],
                    ResidentId: resident.Id,
                    MedicationId: med.Id,
                    Priority: request.Priority,
                    Note: string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                    SubmittedAt: Now,
                    SubmittedBy: user,
                    Hold: null,
                    Approval: needsApproval ? new OrderApproval(ApprovalState.Pending, med.CostPerFill) : null,
                    ProcessingStartedAt: needsApproval ? null : Now,
                    History: history);
            }).ToList();

            Data.Orders.InsertRange(0, created);
            return created;
        }
    }

    public Order Approve(string user, string orderId)
    {
        lock (_gate)
        {
            var order = FindOrder(orderId);
            if (order.Approval?.State != ApprovalState.Pending)
                throw new ApiException(409, "This order is not waiting for approval.");

            var updated = order with
            {
                Approval = order.Approval with { State = ApprovalState.Approved, DecidedAt = Now, DecidedBy = user },
                ProcessingStartedAt = order.Hold is null ? Now : null,
                History = [.. order.History, new(Now, $"Approved by {user}")],
            };
            AddAudit(user, AuditAction.OrderApproved, $"Approved {Describe(order)} (${order.Approval.EstimatedCost:N0})");
            return Replace(updated);
        }
    }

    public Order Deny(string user, string orderId, string? reason)
    {
        lock (_gate)
        {
            var order = FindOrder(orderId);
            if (order.Approval?.State != ApprovalState.Pending)
                throw new ApiException(409, "This order is not waiting for approval.");
            var error = Rules.ValidateReason(reason);
            if (error is not null) throw new ApiException(400, error);

            var trimmed = reason!.Trim();
            var updated = order with
            {
                Approval = order.Approval with
                {
                    State = ApprovalState.Denied, DecidedAt = Now, DecidedBy = user, DenialReason = trimmed,
                },
                ProcessingStartedAt = null,
                History = [.. order.History, new(Now, $"Denied by {user}: {trimmed}")],
            };
            AddAudit(user, AuditAction.OrderDenied, $"Denied {Describe(order)}: {trimmed}");
            return Replace(updated);
        }
    }

    public Order ResolveHold(string user, string orderId, string? resolution)
    {
        lock (_gate)
        {
            var order = FindOrder(orderId);
            if (order.Hold is null) throw new ApiException(409, "This order is not on hold.");
            if (string.IsNullOrWhiteSpace(resolution)) throw new ApiException(400, "Choose how the hold was resolved.");

            var updated = order with
            {
                Hold = null,
                ProcessingStartedAt = order.Approval?.State == ApprovalState.Pending ? null : Now,
                History = [.. order.History, new(Now, $"Hold resolved: {resolution}")],
            };
            AddAudit(user, AuditAction.HoldResolved, $"Resolved hold on {Describe(order)}: {resolution}");
            return Replace(updated);
        }
    }

    // ---- Delivery -----------------------------------------------------------

    public Delivery UpdateDeliveryItem(string user, string itemId, DeliveryItemStatus status)
    {
        lock (_gate)
        {
            var delivery = Data.Delivery;
            if (delivery.ConfirmedAt is not null) throw new ApiException(409, "This delivery is already confirmed.");
            var item = delivery.Items.FirstOrDefault(i => i.Id == itemId)
                ?? throw new ApiException(404, "Item not found on this packing slip.");

            var updated = delivery with
            {
                Items = delivery.Items.Select(i => i.Id == itemId ? i with { Status = status } : i).ToList(),
            };
            _data = Data with { Delivery = updated };

            if (status is DeliveryItemStatus.Missing or DeliveryItemStatus.Damaged)
            {
                AddAudit(user, AuditAction.DeliveryItemFlagged,
                    $"Flagged {item.Description} as {status.ToString().ToLowerInvariant()} on {delivery.PackingSlipNumber}");
            }
            return updated;
        }
    }

    public Delivery ConfirmDelivery(string user)
    {
        lock (_gate)
        {
            var delivery = Data.Delivery;
            if (delivery.ConfirmedAt is not null) throw new ApiException(409, "This delivery is already confirmed.");
            if (delivery.Items.Any(i => i.Status == DeliveryItemStatus.Pending))
                throw new ApiException(400, "Check every item before confirming the delivery.");

            var received = delivery.Items.Count(i => i.Status == DeliveryItemStatus.Received);
            var flagged = delivery.Items.Count - received;
            var updated = delivery with { ConfirmedAt = Now, ConfirmedBy = user };
            _data = Data with { Delivery = updated };

            AddAudit(user, AuditAction.DeliveryConfirmed,
                $"Confirmed delivery {delivery.PackingSlipNumber}: {received} received" +
                (flagged > 0 ? $", {flagged} flagged for the pharmacy" : ", no issues"));
            return updated;
        }
    }

    // ---- Demo ---------------------------------------------------------------

    public void ResetDemoData(string user)
    {
        lock (_gate)
        {
            _data = Seed.Create(Now);
            AddAudit(user, AuditAction.DemoReset, "Reset demo data");
        }
    }

    // ---- Internals ----------------------------------------------------------

    /// <summary>Current data, regenerated when missing or from a previous day.</summary>
    private PharmacyData Data
    {
        get
        {
            var today = DateOnly.FromDateTime(Now.LocalDateTime);
            if (_data is null || _data.SeededOn != today) _data = Seed.Create(Now);
            return _data;
        }
    }

    private Order FindOrder(string orderId) =>
        Data.Orders.FirstOrDefault(o => o.Id == orderId) ?? throw new ApiException(404, "Order not found.");

    private Order Replace(Order updated)
    {
        var index = Data.Orders.FindIndex(o => o.Id == updated.Id);
        Data.Orders[index] = updated;
        return updated;
    }

    private string Describe(Order order)
    {
        var med = Data.Medications.FirstOrDefault(m => m.Id == order.MedicationId);
        var resident = Seed.Residents.FirstOrDefault(r => r.Id == order.ResidentId);
        var medText = med is null ? "medication" : $"{med.Name} {med.Strength}";
        return resident is null ? medText : $"{medText} for {resident.FirstName} {resident.LastName}";
    }

    private void AddAudit(string user, AuditAction action, string summary) =>
        Data.Audit.Insert(0, new AuditEntry($"aud-{Guid.NewGuid():N}"[..16], Now, user, action, summary));
}
