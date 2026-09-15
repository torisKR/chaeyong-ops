package webui

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateAddrLoopbackOnly(t *testing.T) {
	t.Parallel()
	if err := ValidateAddr(DefaultAddr); err != nil {
		t.Fatalf("default addr: %v", err)
	}
	if err := ValidateAddr("localhost:3847"); err != nil {
		t.Fatalf("localhost: %v", err)
	}
	if err := ValidateAddr("[::1]:3847"); err != nil {
		t.Fatalf("::1: %v", err)
	}
	for _, bad := range []string{"0.0.0.0:3847", ":3847", "192.168.1.5:3847", "example.com:3847"} {
		if err := ValidateAddr(bad); err == nil {
			t.Errorf("expected reject %q", bad)
		}
	}
}

func TestHandlerServesKoreanBoard(t *testing.T) {
	srv := httptest.NewServer(NewHandler(fixtureRoot(t)))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	if ct := res.Header.Get("Content-Type"); !strings.Contains(ct, "text/html") {
		t.Errorf("content-type %q", ct)
	}
	if res.Header.Get("Cache-Control") != "no-store" {
		t.Errorf("missing no-store cache header")
	}
	body, _ := io.ReadAll(res.Body)
	html := string(body)
	for _, want := range []string{"지원 현황", "예시테크", "원티드", "지원완료", "localhost 전용"} {
		if !strings.Contains(html, want) {
			t.Errorf("html missing %q", want)
		}
	}
}

func TestHandlerJSONAndFilters(t *testing.T) {
	srv := httptest.NewServer(NewHandler(fixtureRoot(t)))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/api/applications.json")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var payload jsonBoard
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Total != 6 {
		t.Fatalf("json total = %d", payload.Total)
	}
	if payload.Counts[BucketInterview] != 1 {
		t.Errorf("interview count = %d", payload.Counts[BucketInterview])
	}

	res2, err := http.Get(srv.URL + "/api/applications.json?status=interview&portal=jobkorea")
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	var filtered jsonBoard
	if err := json.NewDecoder(res2.Body).Decode(&filtered); err != nil {
		t.Fatal(err)
	}
	if len(filtered.Rows) != 1 || filtered.Rows[0].Company != "샘플랩" {
		t.Fatalf("filtered rows = %+v", filtered.Rows)
	}

	res3, err := http.Get(srv.URL + "/nope")
	if err != nil {
		t.Fatal(err)
	}
	defer res3.Body.Close()
	if res3.StatusCode != 404 {
		t.Errorf("unknown path status %d", res3.StatusCode)
	}
}

func TestHandlerEmptyTracker(t *testing.T) {
	dir := t.TempDir()
	srv := httptest.NewServer(NewHandler(dir))
	t.Cleanup(srv.Close)
	res, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(body), "아직 지원 기록이 없습니다") {
		t.Errorf("empty state missing, body:\n%s", body)
	}
}
