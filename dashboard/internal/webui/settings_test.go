package webui

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseBlockedForm(t *testing.T) {
	t.Parallel()
	names, err := ParseBlockedForm("ExampleCorp, Example Agency\nExampleCorp")
	if err != nil {
		t.Fatal(err)
	}
	if len(names) != 2 || names[0] != "ExampleCorp" || names[1] != "Example Agency" {
		t.Fatalf("names = %#v", names)
	}
	if _, err := ParseBlockedForm("hr@example.com"); err == nil {
		t.Fatal("expected email reject")
	}
}

func TestPatchBlockedCompaniesReplacesList(t *testing.T) {
	t.Parallel()
	src := "# comment\nblocked_companies:\n  - ExampleCorp\n  - \"Example Agency\"\n\njob_boards:\n  - name: Wanted\n"
	next := PatchBlockedCompanies(src, []string{"Acme Labs"})
	if !strings.Contains(next, `- "Acme Labs"`) {
		t.Fatalf("missing new name:\n%s", next)
	}
	if strings.Contains(next, "ExampleCorp") {
		t.Fatalf("old name leaked:\n%s", next)
	}
	if !strings.Contains(next, "job_boards:") {
		t.Fatal("job_boards dropped")
	}
	empty := PatchBlockedCompanies(next, nil)
	if !strings.Contains(empty, "blocked_companies: []") {
		t.Fatalf("empty list:\n%s", empty)
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "config"), 0o755); err != nil {
		t.Fatal(err)
	}
	profile := []byte("target_roles:\n  primary:\n    - \"백엔드 개발자\"\nexperience:\n  years: 1.7\n")
	if err := os.WriteFile(filepath.Join(dir, "config", "profile.yml"), profile, 0o644); err != nil {
		t.Fatal(err)
	}
	portals := []byte("blocked_companies:\n  - ExampleCorp\njob_boards: []\n")
	if err := os.WriteFile(filepath.Join(dir, "portals.yml"), portals, 0o644); err != nil {
		t.Fatal(err)
	}

	view := LoadSettings(dir)
	if view.Years != "1.7" {
		t.Errorf("years = %q", view.Years)
	}
	if len(view.Roles) != 1 || view.Roles[0] != "백엔드 개발자" {
		t.Errorf("roles = %#v", view.Roles)
	}

	srv := httptest.NewServer(NewHandler(dir))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/settings")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	html := string(body)
	for _, want := range []string{"블랙리스트", "1.7", "백엔드 개발자", "ExampleCorp"} {
		if !strings.Contains(html, want) {
			t.Errorf("settings html missing %q", want)
		}
	}

	form := url.Values{}
	form.Set("blocked", "ExampleCorp, Sample Labs")
	post, err := http.PostForm(srv.URL+"/settings", form)
	if err != nil {
		t.Fatal(err)
	}
	defer post.Body.Close()
	if post.StatusCode != http.StatusOK && post.Request.URL.Query().Get("saved") != "1" {
		t.Fatalf("post status %d url %s", post.StatusCode, post.Request.URL)
	}
	saved, err := os.ReadFile(filepath.Join(dir, "portals.yml"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(saved)
	if !strings.Contains(text, "Sample Labs") || !strings.Contains(text, "ExampleCorp") {
		t.Fatalf("portals.yml after save:\n%s", text)
	}
}

func TestHandlerBoardLinksSettings(t *testing.T) {
	srv := httptest.NewServer(NewHandler(fixtureRoot(t)))
	t.Cleanup(srv.Close)
	res, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(body), `href="/settings"`) {
		t.Errorf("board missing settings link")
	}
}
