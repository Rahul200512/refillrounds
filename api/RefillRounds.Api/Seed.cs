namespace RefillRounds.Api;

/// <summary>
/// Fictional demo data, identical to src/api/seed.ts in the app. Every
/// timestamp is relative to "now" so the demo always looks current.
/// </summary>
public static class Seed
{
    private const string Hart = "Dr. Amelia Hart, MD";
    private const string Reyes = "Dr. Marcus Reyes, DO";
    private const string Nair = "Dr. Priya Nair, MD";
    private const string NightNurse = "Avery Brooks, RN";
    private const string Pharmacist = "Pharmacy — D. Whitfield, PharmD";

    public static readonly Facility Facility = new("fac-1", "Willow Creek Care Center",
    [
        new Unit("unit-magnolia", "Magnolia Wing"),
        new Unit("unit-cedar", "Cedar Wing"),
    ]);

    public static readonly IReadOnlyList<Resident> Residents =
    [
        new("res-01", "Eleanor", "Whitcombe", "M-101", "unit-magnolia", ["Penicillin", "Sulfa drugs"]),
        new("res-02", "Harold", "Brennan", "M-103", "unit-magnolia", []),
        new("res-03", "Dorothy", "Kessler", "M-105", "unit-magnolia", ["Codeine"]),
        new("res-04", "Walter", "Okafor", "M-108", "unit-magnolia", ["Aspirin"]),
        new("res-05", "Margaret", "Lindqvist", "M-110", "unit-magnolia", []),
        new("res-06", "Franklin", "DeLuca", "C-201", "unit-cedar", ["Morphine"]),
        new("res-07", "Ruth", "Abernathy", "C-204", "unit-cedar", ["Penicillin"]),
        new("res-08", "George", "Tanaka", "C-206", "unit-cedar", []),
        new("res-09", "Irene", "Castellano", "C-209", "unit-cedar", ["Lisinopril (angioedema)"]),
        new("res-10", "Samuel", "Whitaker", "C-212", "unit-cedar", ["Ciprofloxacin"]),
    ];

    public static PharmacyData Create(DateTimeOffset now)
    {
        Medication Med(string id, string residentId, string name, string strength, string form, string directions,
            string prescriber, FillType fillType, int daysSupply, int daysRemaining, decimal cost) =>
            // Back-date the last fill so exactly `daysRemaining` days are left today.
            new(id, residentId, name, strength, form, directions, prescriber, fillType, daysSupply,
                now - TimeSpan.FromDays(daysSupply - daysRemaining) - TimeSpan.FromHours(1), cost);

        DateTimeOffset Ago(TimeSpan span) => now - span;
        var m = TimeSpan.FromMinutes(1);
        var h = TimeSpan.FromHours(1);
        var d = TimeSpan.FromDays(1);

        List<Medication> medications =
        [
        Med("med-01a", "res-01", "Donepezil", "10 mg", "Tablet", "1 tablet by mouth at bedtime", Hart, FillType.Cycle, 30, 1, 14m),
        Med("med-01b", "res-01", "Metoprolol tartrate", "25 mg", "Tablet", "1 tablet by mouth twice daily. Hold if heart rate below 55.", Hart, FillType.Cycle, 30, 1, 9m),
        Med("med-01c", "res-01", "Acetaminophen", "500 mg", "Tablet", "1–2 tablets by mouth every 6 hours as needed for pain. Max 3 g/day.", Hart, FillType.Prn, 30, 3, 6m),
        Med("med-01d", "res-01", "Senna", "8.6 mg", "Tablet", "2 tablets by mouth at bedtime as needed for constipation", Hart, FillType.Prn, 30, 16, 5m),
        Med("med-02a", "res-02", "Atorvastatin", "40 mg", "Tablet", "1 tablet by mouth at bedtime", Reyes, FillType.Cycle, 30, 1, 11m),
        Med("med-02b", "res-02", "Apixaban", "5 mg", "Tablet", "1 tablet by mouth twice daily", Reyes, FillType.Cycle, 30, 14, 545m),
        Med("med-02c", "res-02", "Ondansetron ODT", "4 mg", "Orally disintegrating tablet", "Dissolve 1 tablet on tongue every 8 hours as needed for nausea", Reyes, FillType.Prn, 10, 0, 18m),
        Med("med-02d", "res-02", "Fidaxomicin", "200 mg", "Tablet", "1 tablet by mouth twice daily for 10 days", Reyes, FillType.Course, 10, 0, 4200m),
        Med("med-03a", "res-03", "Levothyroxine", "50 mcg", "Tablet", "1 tablet by mouth every morning on an empty stomach", Nair, FillType.Cycle, 30, 11, 7m),
        Med("med-03b", "res-03", "Sertraline", "50 mg", "Tablet", "1 tablet by mouth once daily", Nair, FillType.Cycle, 30, 2, 10m),
        Med("med-03c", "res-03", "Polyethylene glycol 3350", "17 g", "Powder packet", "Mix 1 packet in 8 oz water once daily as needed for constipation", Nair, FillType.Prn, 14, 5, 12m),
        Med("med-04a", "res-04", "Furosemide", "20 mg", "Tablet", "1 tablet by mouth every morning", Hart, FillType.Cycle, 30, 9, 6m),
        Med("med-04b", "res-04", "Insulin glargine", "100 units/mL", "Prefilled pen", "Inject 18 units under the skin at bedtime", Hart, FillType.Cycle, 28, 1, 310m),
        Med("med-04c", "res-04", "Glucose", "4 g", "Chewable tablet", "Chew 4 tablets if blood sugar below 70; recheck in 15 minutes", Hart, FillType.Prn, 30, 6, 8m),
        Med("med-05a", "res-05", "Memantine", "10 mg", "Tablet", "1 tablet by mouth twice daily", Nair, FillType.Cycle, 30, 1, 22m),
        Med("med-05b", "res-05", "Quetiapine", "25 mg", "Tablet", "1 tablet by mouth at bedtime", Nair, FillType.Cycle, 30, 17, 9m),
        Med("med-05c", "res-05", "Linezolid", "600 mg", "Tablet", "1 tablet by mouth every 12 hours for 14 days", Nair, FillType.Course, 14, 0, 1850m),
        Med("med-05d", "res-05", "Acetaminophen", "325 mg", "Tablet", "2 tablets by mouth every 6 hours as needed for pain or fever", Nair, FillType.Prn, 30, 21, 5m),
        Med("med-06a", "res-06", "Tamsulosin", "0.4 mg", "Capsule", "1 capsule by mouth 30 minutes after the same meal daily", Reyes, FillType.Cycle, 30, 12, 13m),
        Med("med-06b", "res-06", "Lidocaine", "5%", "Topical patch", "Apply 1 patch to lower back for 12 hours, then remove for 12 hours", Reyes, FillType.Prn, 30, 0, 260m),
        Med("med-06c", "res-06", "Guaifenesin", "100 mg/5 mL", "Oral liquid", "10 mL by mouth every 4 hours as needed for cough", Reyes, FillType.Prn, 10, 2, 7m),
        Med("med-07a", "res-07", "Amlodipine", "5 mg", "Tablet", "1 tablet by mouth once daily", Hart, FillType.Cycle, 30, 1, 6m),
        Med("med-07b", "res-07", "Calcium carbonate + vitamin D3", "600 mg / 400 IU", "Tablet", "1 tablet by mouth twice daily with meals", Hart, FillType.Cycle, 30, 19, 4m),
        Med("med-07c", "res-07", "Ipratropium-albuterol", "0.5 mg / 2.5 mg per 3 mL", "Nebulizer vial", "1 vial via nebulizer every 6 hours as needed for wheezing", Hart, FillType.Prn, 15, 1, 38m),
        Med("med-08a", "res-08", "Metformin", "500 mg", "Tablet", "1 tablet by mouth twice daily with meals", Reyes, FillType.Cycle, 30, 1, 5m),
        Med("med-08b", "res-08", "Lisinopril", "10 mg", "Tablet", "1 tablet by mouth once daily. Hold if systolic BP below 100.", Reyes, FillType.Cycle, 30, 15, 5m),
        Med("med-08c", "res-08", "Docusate sodium", "100 mg", "Capsule", "1 capsule by mouth twice daily as needed for constipation", Reyes, FillType.Prn, 30, 30, 5m),
        Med("med-09a", "res-09", "Losartan", "50 mg", "Tablet", "1 tablet by mouth once daily", Nair, FillType.Cycle, 30, 13, 8m),
        Med("med-09b", "res-09", "Warfarin", "2.5 mg", "Tablet", "1 tablet by mouth daily at 5 PM. Dose per INR.", Nair, FillType.Cycle, 30, 2, 9m),
        Med("med-09c", "res-09", "Docusate sodium", "100 mg", "Capsule", "1 capsule by mouth daily as needed for constipation", Nair, FillType.Prn, 30, 24, 5m),
        Med("med-10a", "res-10", "Carbidopa-levodopa", "25 mg / 100 mg", "Tablet", "1 tablet by mouth three times daily", Hart, FillType.Cycle, 30, 1, 28m),
        Med("med-10b", "res-10", "Mirtazapine", "15 mg", "Tablet", "1 tablet by mouth at bedtime", Hart, FillType.Cycle, 30, 10, 9m),
        Med("med-10c", "res-10", "Melatonin", "3 mg", "Tablet", "1 tablet by mouth at bedtime as needed for sleep", Hart, FillType.Prn, 30, 4, 4m),
        ];

        List<Order> orders =
        [
            new("ord-1003", "res-09", "med-09b", Priority.Stat, "INR 3.4 this morning. Prescriber reduced dose by phone.",
                Ago(55 * m), NightNurse,
                new OrderHold(HoldReason.RenewalNeeded, "Dose change needs a signed prescriber order", Ago(48 * m)),
                null, null,
                [new(Ago(55 * m), "Submitted (STAT)"), new(Ago(48 * m), "On hold: dose change needs a signed prescriber order")]),
            new("ord-1004", "res-02", "med-02d", Priority.Stat, "C. diff positive. Start therapy as soon as possible.",
                Ago(35 * m), NightNurse, null, new OrderApproval(ApprovalState.Pending, 4200m), null,
                [new(Ago(35 * m), "Submitted (STAT)"), new(Ago(34 * m), "Sent for facility approval: high-cost medication")]),
            new("ord-1001", "res-03", "med-03b", Priority.Routine, null, Ago(5 * h), NightNurse,
                new OrderHold(HoldReason.RenewalNeeded, "Prescription expired — needs prescriber renewal", Ago(4 * h + 40 * m)),
                null, null,
                [new(Ago(5 * h), "Submitted"), new(Ago(4 * h + 40 * m), "On hold: prescription expired — needs prescriber renewal")]),
            new("ord-1002", "res-06", "med-06b", Priority.Routine, null, Ago(d + 2 * h), NightNurse,
                new OrderHold(HoldReason.InsuranceNotCovered, "Not covered by resident's Part D plan", Ago(d + h)),
                null, null,
                [new(Ago(d + 2 * h), "Submitted"), new(Ago(d + h), "On hold: not covered by resident's Part D plan")]),
            new("ord-1005", "res-05", "med-05c", Priority.Routine, "New order after wound culture; infectious disease consult agrees.",
                Ago(2 * h), NightNurse, null, new OrderApproval(ApprovalState.Pending, 1850m), null,
                [new(Ago(2 * h), "Submitted"), new(Ago(2 * h - m), "Sent for facility approval: high-cost medication")]),
            new("ord-0991", "res-08", "med-08c", Priority.Routine, null, Ago(d + 3 * h), NightNurse, null, null, Ago(d + 3 * h),
                [new(Ago(d + 3 * h), "Submitted")]),
            new("ord-0990", "res-04", "med-04c", Priority.Stat, "Two hypoglycemic episodes overnight; supply running low.",
                Ago(d + 5 * h), NightNurse, null, null, Ago(d + 5 * h),
                [new(Ago(d + 5 * h), "Submitted (STAT)")]),
        ];

        var dateKey = now.ToLocalTime().ToString("yyyyMMdd");
        DeliveryItem Item(string id, string residentId, string description, string quantity, string? note = null) =>
            new(id, residentId, description, quantity, note, DeliveryItemStatus.Pending);

        var delivery = new Delivery($"dlv-{dateKey}", $"PS-{dateKey}-014", now, "2:00–4:00 PM", "Route 4 · Willow Creek",
        [
            Item("itm-1", "res-01", "Donepezil 10 mg tablet", "30 tablets (blister card)"),
            Item("itm-2", "res-01", "Metoprolol tartrate 25 mg tablet", "60 tablets (blister card)"),
            Item("itm-3", "res-02", "Atorvastatin 40 mg tablet", "30 tablets (blister card)"),
            Item("itm-4", "res-04", "Insulin glargine 100 units/mL pen", "5 pens", "Refrigerate on arrival"),
            Item("itm-5", "res-05", "Memantine 10 mg tablet", "60 tablets (blister card)"),
            Item("itm-6", "res-07", "Amlodipine 5 mg tablet", "30 tablets (blister card)"),
            Item("itm-7", "res-08", "Metformin 500 mg tablet", "60 tablets (blister card)"),
            Item("itm-8", "res-10", "Carbidopa-levodopa 25/100 mg tablet", "90 tablets (blister card)"),
        ]);

        List<AuditEntry> audit =
        [
            new("aud-007", Ago(48 * m), Pharmacist, AuditAction.OrderHeld, "Held Warfarin 2.5 mg for Irene Castellano: dose change needs a signed prescriber order"),
            new("aud-006", Ago(55 * m), NightNurse, AuditAction.RefillRequested, "Requested Warfarin 2.5 mg for Irene Castellano (STAT)"),
            new("aud-005", Ago(35 * m + TimeSpan.FromSeconds(30)), NightNurse, AuditAction.RefillRequested, "Requested Fidaxomicin 200 mg for Harold Brennan (STAT) — needs facility approval"),
            new("aud-004", Ago(2 * h), NightNurse, AuditAction.RefillRequested, "Requested Linezolid 600 mg for Margaret Lindqvist — needs facility approval"),
            new("aud-003", Ago(4 * h + 40 * m), Pharmacist, AuditAction.OrderHeld, "Held Sertraline 50 mg for Dorothy Kessler: prescription expired"),
            new("aud-002", Ago(d + h), Pharmacist, AuditAction.OrderHeld, "Held Lidocaine 5% for Franklin DeLuca: not covered by Part D plan"),
            new("aud-001", Ago(d - 3 * h), NightNurse, AuditAction.DeliveryConfirmed, "Confirmed delivery PS-013: 9 items received, no issues"),
        ];

        return new PharmacyData(DateOnly.FromDateTime(now.LocalDateTime), medications, orders, delivery,
            audit.OrderByDescending(a => a.At).ToList());
    }
}

/// <summary>The in-memory "database".</summary>
public record PharmacyData(
    DateOnly SeededOn,
    List<Medication> Medications,
    List<Order> Orders,
    Delivery Delivery,
    List<AuditEntry> Audit);
