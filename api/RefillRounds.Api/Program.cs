using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics;
using RefillRounds.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<PharmacyStore>();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

// JSON shape matches the React Native app: camelCase properties,
// snake_case enum strings, and null properties omitted.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// Local development only: lets the Expo web dev server (another port) call the API.
// Production would restrict this to known origins.
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseExceptionHandler();
app.UseCors();

app.MapGet("/", () => Results.Ok(new { name = "RefillRounds API", status = "ok" }));

// ---- Auth (anonymous) -------------------------------------------------------

var auth = app.MapGroup("/api/auth");

auth.MapPost("/sign-in", (SignInRequest request, PharmacyStore store) => store.SignIn(request));

// ---- Everything else requires a bearer token --------------------------------

var api = app.MapGroup("/api").AddEndpointFilter(async (context, next) =>
{
    var store = context.HttpContext.RequestServices.GetRequiredService<PharmacyStore>();
    context.HttpContext.Items[nameof(Session)] = store.Authenticate(BearerToken(context.HttpContext));
    return await next(context);
});

api.MapGet("/auth/session", (HttpContext http) => CurrentSession(http));
api.MapPost("/auth/keep-alive", () => Results.NoContent());
api.MapPost("/auth/sign-out", (SignOutRequest request, HttpContext http, PharmacyStore store) =>
{
    store.SignOut(BearerToken(http)!, request.Reason);
    return Results.NoContent();
});

api.MapGet("/facility", () => Seed.Facility);
api.MapGet("/residents", () => Seed.Residents);
api.MapGet("/medications", (PharmacyStore store) => store.GetMedications());
api.MapGet("/orders", (PharmacyStore store) => store.GetOrders());
api.MapGet("/deliveries/today", (PharmacyStore store) => store.GetTodaysDelivery());
api.MapGet("/audit-log", (PharmacyStore store) => store.GetAuditLog());

api.MapPost("/orders/refills", (RefillRequest request, HttpContext http, PharmacyStore store) =>
    Results.Created("/api/orders", store.RequestRefill(UserName(http), request)));
api.MapPost("/orders/{id}/approve", (string id, HttpContext http, PharmacyStore store) =>
    store.Approve(UserName(http), id));
api.MapPost("/orders/{id}/deny", (string id, DenyRequest request, HttpContext http, PharmacyStore store) =>
    store.Deny(UserName(http), id, request.Reason));
api.MapPost("/orders/{id}/resolve-hold", (string id, ResolveHoldRequest request, HttpContext http, PharmacyStore store) =>
    store.ResolveHold(UserName(http), id, request.Resolution));

api.MapPatch("/deliveries/today/items/{itemId}", (string itemId, UpdateDeliveryItemRequest request, HttpContext http, PharmacyStore store) =>
    store.UpdateDeliveryItem(UserName(http), itemId, request.Status));
api.MapPost("/deliveries/today/confirm", (HttpContext http, PharmacyStore store) =>
    store.ConfirmDelivery(UserName(http)));

api.MapPost("/demo/reset", (HttpContext http, PharmacyStore store) =>
{
    store.ResetDemoData(UserName(http));
    return Results.NoContent();
});

app.Run();

static string? BearerToken(HttpContext http)
{
    var header = http.Request.Headers.Authorization.ToString();
    return header.StartsWith("Bearer ", StringComparison.Ordinal) ? header["Bearer ".Length..] : null;
}

static Session CurrentSession(HttpContext http) => (Session)http.Items[nameof(Session)]!;

static string UserName(HttpContext http) => CurrentSession(http).DisplayName;

/// <summary>Maps ApiException to an RFC 7807 problem response with the right status code.</summary>
internal sealed class ApiExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not ApiException apiError) return false;
        http.Response.StatusCode = apiError.Status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = { Status = apiError.Status, Title = "Request failed", Detail = apiError.Message },
        });
    }
}

// Exposed so the integration tests can start the app in memory.
public partial class Program;
