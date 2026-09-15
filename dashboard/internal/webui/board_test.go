package webui

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/santifer/career-ops/dashboard/internal/model"
)

func fixtureRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	// testdata lives under test-fixtures/ so applications.md is not gitignored.
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "test-fixtures", "dashboard-web"))
}

func TestCanonicalStatusKoreanFallback(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		"Applied": "applied",
		"지원완료":    "applied",
		"서류통과":    "responded",
		"면접":      "interview",
		"합격":      "offer",
		"입사":      "hired",
		"불합격":     "rejected",
		"보류":      "evaluated",
		"스킵":      "skip",
	}
	for in, want := range cases {
		if got := CanonicalStatus(in); got != want {
			t.Errorf("CanonicalStatus(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestStatusBucketOfferAndHiredCountAsPass(t *testing.T) {
	t.Parallel()
	if StatusBucket("offer") != BucketOffer {
		t.Errorf("offer bucket = %q", StatusBucket("offer"))
	}
	if StatusBucket("hired") != BucketOffer {
		t.Errorf("hired bucket = %q", StatusBucket("hired"))
	}
	if StatusLabel("hired") != "입사" {
		t.Errorf("hired label = %q, want 입사", StatusLabel("hired"))
	}
}

func TestDetectPortalFromViaURLAndNotes(t *testing.T) {
	t.Parallel()
	id, label := DetectPortal("원티드", "", "")
	if id != "wanted" || label != "원티드" {
		t.Errorf("via 원티드 -> %s %s", id, label)
	}
	id, label = DetectPortal("", "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1", "")
	if id != "saramin" || label != "사람인" {
		t.Errorf("saramin url -> %s %s", id, label)
	}
	id, label = DetectPortal("", "https://career.rememberapp.co.kr/job/postings/1", "")
	if id != "remember" {
		t.Errorf("remember url -> %s %s", id, label)
	}
	id, label = DetectPortal("", "", "잡코리아 공고")
	if id != "jobkorea" {
		t.Errorf("notes 잡코리아 -> %s %s", id, label)
	}
	id, label = DetectPortal("", "", "I remember talking to the recruiter")
	if id != "other" {
		t.Errorf("English remember in notes should not be 리멤버, got %s %s", id, label)
	}
	id, label = DetectPortal("Hays", "https://example.com/job/1", "")
	if id != "other" || label != "Hays" {
		t.Errorf("agency via -> %s %s", id, label)
	}
}

func TestSafeHTTPURLRejectsJavascript(t *testing.T) {
	t.Parallel()
	if SafeHTTPURL("javascript:alert(1)") != "" {
		t.Fatal("javascript: URL must be dropped")
	}
	if SafeHTTPURL("https://www.wanted.co.kr/wd/1") == "" {
		t.Fatal("https URL should pass")
	}
}

func TestLoadBoardAggregatesKoreanBuckets(t *testing.T) {
	board := LoadBoard(fixtureRoot(t))
	if board.Missing {
		t.Fatal("fixture tracker should exist")
	}
	if board.Total != 6 {
		t.Fatalf("total = %d, want 6", board.Total)
	}
	got := map[string]int{}
	for _, tile := range board.Tiles {
		got[tile.ID] = tile.Count
	}
	want := map[string]int{
		BucketApplied:   1,
		BucketScreening: 1,
		BucketInterview: 1,
		BucketOffer:     1,
		BucketRejected:  1,
		BucketHold:      1,
	}
	for id, n := range want {
		if got[id] != n {
			t.Errorf("count[%s] = %d, want %d", id, got[id], n)
		}
	}

	byCompany := map[string]Row{}
	for _, row := range board.Rows {
		byCompany[row.Company] = row
	}
	if byCompany["예시테크"].PortalID != "wanted" || byCompany["예시테크"].StatusLabel != "지원완료" {
		t.Errorf("예시테크 = %+v", byCompany["예시테크"])
	}
	if byCompany["가상소프트"].PortalLabel != "사람인" || byCompany["가상소프트"].Bucket != BucketScreening {
		t.Errorf("가상소프트 = %+v", byCompany["가상소프트"])
	}
	if byCompany["테스트커머스"].PortalID != "other" {
		t.Errorf("example.com should be 기타, got %+v", byCompany["테스트커머스"])
	}
	if byCompany["데모핀테크"].PortalID != "wanted" {
		t.Errorf("via=원티드 notes should detect 원티드, got %+v", byCompany["데모핀테크"])
	}
}

func TestFilterBoardByStatusPortalAndSearch(t *testing.T) {
	board := LoadBoard(fixtureRoot(t))
	onlyInterview := FilterBoard(board, BucketInterview, "", "")
	if len(onlyInterview.Rows) != 1 || onlyInterview.Rows[0].Company != "샘플랩" {
		t.Fatalf("interview filter: %+v", onlyInterview.Rows)
	}
	onlyWanted := FilterBoard(board, "", "wanted", "")
	if len(onlyWanted.Rows) != 2 {
		t.Fatalf("wanted filter got %d rows", len(onlyWanted.Rows))
	}
	search := FilterBoard(board, "", "", "페이크")
	if len(search.Rows) != 1 || search.Rows[0].PortalID != "remember" {
		t.Fatalf("search 페이크: %+v", search.Rows)
	}
}

func TestRowFromKoreanStatusCell(t *testing.T) {
	t.Parallel()
	row := rowFromApp(model.CareerApplication{
		Company: "예시",
		Role:    "백엔드",
		Status:  "면접",
		Via:     "원티드",
		Score:   4.2,
		Date:    "2026-03-01",
		JobURL:  "https://www.wanted.co.kr/wd/1",
	})
	if row.Bucket != BucketInterview || row.StatusLabel != "면접" {
		t.Errorf("row = %+v", row)
	}
}
