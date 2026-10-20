package webui

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func settingsSecurityFixture(t *testing.T) (string, string) {
	t.Helper()
	dir := t.TempDir()
	portals := "# preserve this config\nblocked_companies:\n  - Original Company\njob_boards: []\n"
	if err := os.WriteFile(filepath.Join(dir, "portals.yml"), []byte(portals), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir, portals
}

func settingsToken(t *testing.T, h http.Handler, target string) string {
	t.Helper()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, target, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET settings status = %d", w.Code)
	}
	return settingsTokenFromHTML(t, w.Body.String())
}

func assertPortalsUnchanged(t *testing.T, dir, original string) {
	t.Helper()
	saved, err := os.ReadFile(filepath.Join(dir, "portals.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(saved) != original {
		t.Fatalf("rejected request changed portals.yml: %q", saved)
	}
}

func TestSettingsRejectsCrossOriginAndMissingTokens(t *testing.T) {
	t.Parallel()
	const target = "http://127.0.0.1:3847/settings"
	tests := []struct {
		name      string
		headers   http.Header
		tokenMode string
		query     bool
	}{
		{name: "hostile origin", headers: http.Header{"Origin": {"https://attacker.example"}}},
		{name: "null origin", headers: http.Header{"Origin": {"null"}}},
		{name: "malformed origin", headers: http.Header{"Origin": {"://127.0.0.1:3847"}}},
		{name: "origin path", headers: http.Header{"Origin": {"http://127.0.0.1:3847/settings"}}},
		{name: "origin query", headers: http.Header{"Origin": {"http://127.0.0.1:3847?x=1"}}},
		{name: "origin userinfo", headers: http.Header{"Origin": {"http://attacker@127.0.0.1:3847"}}},
		{name: "empty origin", headers: http.Header{"Origin": {""}}},
		{name: "duplicate origins", headers: http.Header{"Origin": {"http://127.0.0.1:3847", "http://127.0.0.1:3847"}}},
		{name: "different port", headers: http.Header{"Origin": {"http://127.0.0.1:3848"}}},
		{name: "different scheme", headers: http.Header{"Origin": {"https://127.0.0.1:3847"}}},
		{name: "different loopback host", headers: http.Header{"Origin": {"http://localhost:3847"}}},
		{name: "cross site metadata", headers: http.Header{"Sec-Fetch-Site": {"cross-site"}}},
		{name: "same site is cross origin", headers: http.Header{"Sec-Fetch-Site": {"same-site"}, "Origin": {"http://127.0.0.1:3847"}}},
		{name: "unknown metadata", headers: http.Header{"Sec-Fetch-Site": {"invalid"}}},
		{name: "metadata does not override hostile origin", headers: http.Header{"Sec-Fetch-Site": {"same-origin"}, "Origin": {"https://attacker.example"}}},
		{name: "headerless token missing", tokenMode: "missing"},
		{name: "headerless token wrong", tokenMode: "wrong"},
		{name: "same origin token missing", tokenMode: "missing", headers: http.Header{"Origin": {"http://127.0.0.1:3847"}}},
		{name: "metadata token missing", tokenMode: "missing", headers: http.Header{"Sec-Fetch-Site": {"same-origin"}}},
		{name: "duplicate token", tokenMode: "duplicate"},
		{name: "query token only", tokenMode: "missing", query: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			dir, original := settingsSecurityFixture(t)
			h := NewHandler(dir)
			token := settingsToken(t, h, target)
			form := url.Values{"blocked": {"Injected Company"}, "csrf_token": {token}}
			switch tc.tokenMode {
			case "missing":
				form.Del("csrf_token")
			case "wrong":
				form.Set("csrf_token", "wrong-token")
			case "duplicate":
				form.Add("csrf_token", token)
			}
			requestURL := target
			if tc.query {
				requestURL += "?csrf_token=" + url.QueryEscape(token)
			}
			r := httptest.NewRequest(http.MethodPost, requestURL, strings.NewReader(form.Encode()))
			for key, values := range tc.headers {
				r.Header[key] = values
			}
			r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != http.StatusForbidden || w.Body.String() != "forbidden\n" {
				t.Fatalf("status/body = %d %q, want clean 403", w.Code, w.Body.String())
			}
			assertPortalsUnchanged(t, dir, original)
		})
	}
}

func TestSettingsAcceptsSameOriginFormTokens(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		target  string
		headers http.Header
	}{
		{name: "headerless", target: "http://127.0.0.1:3847/settings"},
		{name: "browser", target: "http://127.0.0.1:3847/settings", headers: http.Header{"Origin": {"http://127.0.0.1:3847"}, "Sec-Fetch-Site": {"same-origin"}}},
		{name: "origin only", target: "http://localhost:5847/settings", headers: http.Header{"Origin": {"http://localhost:5847"}}},
		{name: "fetch metadata only", target: "http://127.0.0.1/settings", headers: http.Header{"Sec-Fetch-Site": {"same-origin"}}},
		{name: "IPv6", target: "http://[::1]:3847/settings", headers: http.Header{"Origin": {"http://[::1]:3847"}}},
		{name: "https", target: "https://localhost/settings", headers: http.Header{"Origin": {"https://localhost"}}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			dir, _ := settingsSecurityFixture(t)
			h := NewHandler(dir)
			form := url.Values{"blocked": {"Allowed Company"}, "csrf_token": {settingsToken(t, h, tc.target)}}
			r := httptest.NewRequest(http.MethodPost, tc.target, strings.NewReader(form.Encode()))
			for key, values := range tc.headers {
				r.Header[key] = values
			}
			r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != http.StatusSeeOther || w.Header().Get("Location") != "/settings?saved=1" {
				t.Fatalf("save status/location = %d %q", w.Code, w.Header().Get("Location"))
			}
			saved, err := os.ReadFile(filepath.Join(dir, "portals.yml"))
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(saved), `- "Allowed Company"`) || !strings.Contains(string(saved), "# preserve this config") {
				t.Fatalf("unexpected saved config: %q", saved)
			}
		})
	}
}

func TestSettingsTokensAreHandlerScoped(t *testing.T) {
	t.Parallel()
	dir, original := settingsSecurityFixture(t)
	h := NewHandler(dir)
	const target = "http://localhost:3847/settings"
	firstToken := settingsToken(t, h, target)
	otherHandler := NewHandler(dir)
	secondToken := settingsToken(t, otherHandler, target)
	if len(firstToken) < 26 || firstToken == secondToken {
		t.Fatal("tokens must be unpredictable and specific to a handler instance")
	}
	form := url.Values{"blocked": {"Injected Company"}, "csrf_token": {firstToken}}
	r := httptest.NewRequest(http.MethodPost, target, strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	otherHandler.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("token from other handler status = %d", w.Code)
	}
	assertPortalsUnchanged(t, dir, original)
}

func TestSettingsValidationPreservesFormTokenAndCompanyLimit(t *testing.T) {
	t.Parallel()
	dir, original := settingsSecurityFixture(t)
	h := NewHandler(dir)
	const target = "http://localhost:3847/settings"
	token := settingsToken(t, h, target)
	names := make([]string, maxBlockedCompanies+1)
	for i := range names {
		names[i] = fmt.Sprintf("Company %d", i)
	}
	form := url.Values{"blocked": {strings.Join(names, "\n")}, "csrf_token": {token}}
	r := httptest.NewRequest(http.MethodPost, target, strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "회사는 최대 50곳까지") {
		t.Fatalf("invalid form status/body = %d %q", w.Code, w.Body.String())
	}
	if settingsTokenFromHTML(t, w.Body.String()) != token {
		t.Fatal("validation error lost form token")
	}
	assertPortalsUnchanged(t, dir, original)
	form.Set("blocked", strings.Join(names[:maxBlockedCompanies], "\n"))
	r = httptest.NewRequest(http.MethodPost, target, strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("50-company save status = %d", w.Code)
	}
	if got := len(LoadSettings(dir).Blocked); got != maxBlockedCompanies {
		t.Fatalf("saved company count = %d", got)
	}
}

func TestHandlerRejectsRebindingHostsOnAllRoutes(t *testing.T) {
	t.Parallel()
	dir, original := settingsSecurityFixture(t)
	h := NewHandler(dir)
	for _, host := range []string{"attacker.example:3847", "127.0.0.1.attacker.example:3847", "localhost.attacker.example", "192.168.1.1:3847", "0.0.0.0:3847", "localhost.:3847", "localhost:0", "localhost:65536", "localhost:", "localhost:abc", "", "localhost:3847@attacker.example", "::1:3847"} {
		for _, path := range []string{"/", "/settings", "/api/applications.json", "/favicon.ico"} {
			t.Run(host+path, func(t *testing.T) {
				r := httptest.NewRequest(http.MethodGet, "http://localhost:3847"+path, nil)
				r.Host = host
				w := httptest.NewRecorder()
				h.ServeHTTP(w, r)
				if w.Code != http.StatusForbidden || w.Body.String() != "forbidden\n" {
					t.Fatalf("host %q status/body = %d %q", host, w.Code, w.Body.String())
				}
			})
		}
	}
	// Even a valid form token must not permit writes through a rebinding host.
	form := url.Values{"blocked": {"Injected Company"}, "csrf_token": {settingsToken(t, h, "http://localhost:3847/settings")}}
	r := httptest.NewRequest(http.MethodPost, "http://attacker.example:3847/settings", strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("rebound POST status = %d", w.Code)
	}
	assertPortalsUnchanged(t, dir, original)
}

func TestHandlerAllowsExplicitLoopbackHosts(t *testing.T) {
	t.Parallel()
	h := NewHandler(t.TempDir())
	for _, host := range []string{"localhost", "localhost:3847", "LOCALHOST:3847", "127.0.0.1", "127.0.0.1:5847", "127.1.2.3:3847", "[::1]", "[::1]:3847", "[::ffff:127.0.0.1]:3847"} {
		t.Run(host, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "http://localhost/settings", nil)
			r.Host = host
			// Safe reads remain available even when followed from an external site.
			r.Header.Set("Origin", "https://attacker.example")
			r.Header.Set("Sec-Fetch-Site", "cross-site")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != http.StatusOK {
				t.Fatalf("loopback host %q status = %d", host, w.Code)
			}
		})
	}
}
