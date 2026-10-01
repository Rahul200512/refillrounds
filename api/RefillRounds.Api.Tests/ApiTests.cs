using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace RefillRounds.Api.Tests;

/// <summary>
/// Integration tests: the real API runs in memory and is called over HTTP,
/// with a fake clock so time-based rules can be tested instantly.
/// </summary>
public class ApiTests : IDisposable
{
    private readonly FakeTimeProvider _clock = new(new DateTimeOffset(2026, 10, 1, 15, 0, 0, TimeSpan.Zero));
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public ApiTests()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(_clock)));
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private async Task SignInAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/sign-in", new { username = "nurse.demo", password = "Demo1234" });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
    }

    private async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    [Fact]
    public async Task Wrong_password_returns_401_problem_details()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/sign-in", new { username = "nurse.demo", password = "nope" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Incorrect username or password.", (await JsonAsync(response)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Data_endpoints_require_a_token()
    {
        var response = await _client.GetAsync("/api/orders");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Json_matches_the_app_contract()
    {
        await SignInAsync();
        var orders = await JsonAsync(await _client.GetAsync("/api/orders"));
        var held = orders.EnumerateArray().First(o => o.GetProperty("id").GetString() == "ord-1001");

        Assert.Equal("routine", held.GetProperty("priority").GetString());
        Assert.Equal("renewal_needed", held.GetProperty("hold").GetProperty("reason").GetString());
        Assert.False(held.TryGetProperty("approval", out _)); // nulls are omitted, like `undefined` in TypeScript
    }

    [Fact]
    public async Task Approve_then_approve_again_is_a_conflict()
    {
        await SignInAsync();
        var first = await _client.PostAsync("/api/orders/ord-1004/approve", null);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal("approved", (await JsonAsync(first)).GetProperty("approval").GetProperty("state").GetString());

        var second = await _client.PostAsync("/api/orders/ord-1004/approve", null);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Deny_requires_a_reason_and_is_audited()
    {
        await SignInAsync();
        var noReason = await _client.PostAsJsonAsync("/api/orders/ord-1005/deny", new { reason = "" });
        Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);

        var denied = await _client.PostAsJsonAsync("/api/orders/ord-1005/deny", new { reason = "Formulary alternative" });
        Assert.Equal(HttpStatusCode.OK, denied.StatusCode);

        var audit = await JsonAsync(await _client.GetAsync("/api/audit-log"));
        var latest = audit.EnumerateArray().First();
        Assert.Equal("order_denied", latest.GetProperty("action").GetString());
        Assert.Equal("Jordan Lee, RN", latest.GetProperty("user").GetString());
    }

    [Fact]
    public async Task High_cost_refill_waits_for_approval_and_duplicates_are_rejected()
    {
        await SignInAsync();
        var request = new { residentId = "res-02", medicationIds = new[] { "med-02b" }, priority = "routine", note = "" };

        var created = await _client.PostAsJsonAsync("/api/orders/refills", request);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var order = (await JsonAsync(created))[0];
        Assert.Equal("pending", order.GetProperty("approval").GetProperty("state").GetString());

        var duplicate = await _client.PostAsJsonAsync("/api/orders/refills", request);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Stat_refill_needs_a_clinical_reason()
    {
        await SignInAsync();
        var response = await _client.PostAsJsonAsync("/api/orders/refills",
            new { residentId = "res-07", medicationIds = new[] { "med-07c" }, priority = "stat", note = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Resolving_a_hold_clears_it()
    {
        await SignInAsync();
        var response = await _client.PostAsJsonAsync("/api/orders/ord-1001/resolve-hold",
            new { resolution = "Signed renewal received from prescriber" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await JsonAsync(response)).TryGetProperty("hold", out _));
    }

    [Fact]
    public async Task Delivery_can_only_be_confirmed_after_every_item_is_checked()
    {
        await SignInAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsync("/api/deliveries/today/confirm", null)).StatusCode);

        for (var i = 1; i <= 8; i++)
        {
            var status = i == 4 ? "damaged" : "received";
            var item = await _client.PatchAsJsonAsync($"/api/deliveries/today/items/itm-{i}", new { status });
            Assert.Equal(HttpStatusCode.OK, item.StatusCode);
        }

        var confirmed = await _client.PostAsync("/api/deliveries/today/confirm", null);
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        Assert.True((await JsonAsync(confirmed)).TryGetProperty("confirmedAt", out _));
    }

    [Fact]
    public async Task Server_locks_a_session_after_five_idle_minutes()
    {
        await SignInAsync();
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/orders")).StatusCode);

        _clock.Advance(TimeSpan.FromMinutes(6));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/orders")).StatusCode);
    }
}
