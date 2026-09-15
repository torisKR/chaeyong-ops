package webui

import (
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/santifer/career-ops/dashboard/internal/data"
	"github.com/santifer/career-ops/dashboard/internal/model"
)

// Korean display buckets for the 채용옵스 status board.
// Tracker rows keep English canonical states (templates/states.yml);
// these labels are display-only.
const (
	BucketApplied   = "applied"
	BucketScreening = "responded"
	BucketInterview = "interview"
	BucketOffer     = "offer"
	BucketRejected  = "rejected"
	BucketHold      = "hold"
)

// CountTile is one header chip on the status board.
type CountTile struct {
	ID    string
	Label string
	Count int
	Hint  string
}

// Row is one application as shown in the local web table.
type Row struct {
	Number      int
	Company     string
	Role        string
	PortalID    string
	PortalLabel string
	Score       string
	StatusID    string
	StatusLabel string
	Bucket      string
	Date        string
	URL         string
	SearchText  string
}

// Board is the read-only view model for the localhost status page.
type Board struct {
	TrackerPath string
	TrackerRel  string
	Missing     bool
	Total       int
	Tiles       []CountTile
	Portals     []PortalOption
	Rows        []Row
}

// PortalOption is a filter value in the portal dropdown.
type PortalOption struct {
	ID    string
	Label string
}

type portalSpec struct {
	id      string
	label   string
	needles []string
}

var krPortals = []portalSpec{
	{id: "wanted", label: "원티드", needles: []string{"wanted.co.kr", "원티드", "wanted"}},
	{id: "saramin", label: "사람인", needles: []string{"saramin.co.kr", "사람인", "saramin"}},
	{id: "jobkorea", label: "잡코리아", needles: []string{"jobkorea.co.kr", "잡코리아", "jobkorea"}},
	{id: "remember", label: "리멤버", needles: []string{"rememberapp.co.kr", "remember.kr", "리멤버", "remember"}},
}

var bucketOrder = []CountTile{
	{ID: BucketApplied, Label: "지원완료", Hint: "Applied"},
	{ID: BucketScreening, Label: "서류통과", Hint: "Responded"},
	{ID: BucketInterview, Label: "면접", Hint: "Interview"},
	{ID: BucketOffer, Label: "합격", Hint: "Offer / Hired"},
	{ID: BucketRejected, Label: "불합격", Hint: "Rejected"},
	{ID: BucketHold, Label: "보류", Hint: "Evaluated / SKIP / Discarded"},
}

// CanonicalStatus maps a tracker status cell to a states.yml id, with a
// Korean display-layer fallback for rows that were never normalized.
func CanonicalStatus(raw string) string {
	n := data.NormalizeStatus(raw)
	switch n {
	case "applied", "responded", "interview", "offer", "hired", "rejected", "discarded", "skip", "evaluated":
		return n
	}
	s := strings.TrimSpace(n)
	switch {
	case s == "입사" || s == "채용확정" || s == "최종합격":
		return "hired"
	case s == "스킵" || s == "미지원":
		return "skip"
	case s == "면접" || strings.Contains(s, "면접"):
		return "interview"
	case s == "불합격" || s == "탈락":
		return "rejected"
	case s == "합격" || s == "오퍼":
		return "offer"
	case s == "서류통과" || strings.Contains(s, "서류통과"):
		return "responded"
	case s == "지원완료" || s == "지원":
		return "applied"
	case s == "폐기" || s == "지원취소":
		return "discarded"
	case s == "보류" || s == "평가완료" || s == "검토중":
		return "evaluated"
	default:
		return n
	}
}

// StatusBucket groups a canonical status into a Korean header tile.
func StatusBucket(canonical string) string {
	switch canonical {
	case "applied":
		return BucketApplied
	case "responded":
		return BucketScreening
	case "interview":
		return BucketInterview
	case "offer", "hired":
		return BucketOffer
	case "rejected":
		return BucketRejected
	default:
		return BucketHold
	}
}

// StatusLabel is the Korean (or 입사) chip text for a canonical status.
func StatusLabel(canonical string) string {
	switch canonical {
	case "applied":
		return "지원완료"
	case "responded":
		return "서류통과"
	case "interview":
		return "면접"
	case "offer":
		return "합격"
	case "hired":
		return "입사"
	case "rejected":
		return "불합격"
	case "evaluated":
		return "평가완료"
	case "discarded":
		return "폐기"
	case "skip":
		return "스킵"
	default:
		if canonical == "" {
			return "—"
		}
		return canonical
	}
}

// DetectPortal classifies a row as 원티드/사람인/잡코리아/리멤버 or 기타.
// Via column wins, then job URL host, then Korean portal names in notes.
func DetectPortal(via, jobURL, notes string) (id, label string) {
	if id, label, ok := matchKRPortal(via, true); ok {
		return id, label
	}
	if id, label, ok := matchKRPortal(jobURL, true); ok {
		return id, label
	}
	if id, label, ok := matchKRPortal(notes, false); ok {
		return id, label
	}
	via = strings.TrimSpace(via)
	if via != "" {
		return "other", via
	}
	return "other", "기타"
}

func matchKRPortal(s string, allowEnglishID bool) (id, label string, ok bool) {
	low := strings.ToLower(s)
	if strings.TrimSpace(low) == "" {
		return "", "", false
	}
	for _, p := range krPortals {
		for _, n := range p.needles {
			if !allowEnglishID && (n == "wanted" || n == "saramin" || n == "jobkorea" || n == "remember") {
				continue
			}
			if strings.Contains(low, strings.ToLower(n)) {
				return p.id, p.label, true
			}
		}
	}
	return "", "", false
}

// SafeHTTPURL returns the URL only when it is http(s). Empty otherwise.
func SafeHTTPURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}
	if u.Host == "" {
		return ""
	}
	return raw
}

func formatScore(app model.CareerApplication) string {
	if app.Score > 0 {
		if app.Score == float64(int(app.Score)) {
			return strconv.Itoa(int(app.Score))
		}
		return strconv.FormatFloat(app.Score, 'f', 1, 64)
	}
	raw := strings.TrimSpace(app.ScoreRaw)
	if raw == "" || raw == "—" || raw == "-" || strings.EqualFold(raw, "n/a") {
		return "—"
	}
	return raw
}

func rowFromApp(app model.CareerApplication) Row {
	canon := CanonicalStatus(app.Status)
	portalID, portalLabel := DetectPortal(app.Via, app.JobURL, app.Notes)
	score := formatScore(app)
	date := strings.TrimSpace(app.Date)
	if date == "" {
		date = "—"
	}
	company := strings.TrimSpace(app.Company)
	role := strings.TrimSpace(app.Role)
	search := strings.ToLower(strings.Join([]string{
		company, role, portalLabel, portalID, score, StatusLabel(canon), canon, date, app.Via,
	}, " "))
	return Row{
		Number:      app.Number,
		Company:     company,
		Role:        role,
		PortalID:    portalID,
		PortalLabel: portalLabel,
		Score:       score,
		StatusID:    canon,
		StatusLabel: StatusLabel(canon),
		Bucket:      StatusBucket(canon),
		Date:        date,
		URL:         SafeHTTPURL(app.JobURL),
		SearchText:  search,
	}
}

// LoadBoard parses the tracker at careerOpsPath into a Korean status board.
func LoadBoard(careerOpsPath string) Board {
	tracker := data.TrackerPath(careerOpsPath)
	apps := data.ParseApplications(careerOpsPath)
	missing := apps == nil
	if apps == nil {
		apps = []model.CareerApplication{}
	}

	counts := map[string]int{
		BucketApplied:   0,
		BucketScreening: 0,
		BucketInterview: 0,
		BucketOffer:     0,
		BucketRejected:  0,
		BucketHold:      0,
	}
	rows := make([]Row, 0, len(apps))
	for _, app := range apps {
		row := rowFromApp(app)
		rows = append(rows, row)
		counts[row.Bucket]++
	}

	tiles := make([]CountTile, len(bucketOrder))
	for i, t := range bucketOrder {
		t.Count = counts[t.ID]
		tiles[i] = t
	}

	portals := []PortalOption{
		{ID: "", Label: "모든 포털"},
		{ID: "wanted", Label: "원티드"},
		{ID: "saramin", Label: "사람인"},
		{ID: "jobkorea", Label: "잡코리아"},
		{ID: "remember", Label: "리멤버"},
		{ID: "other", Label: "기타"},
	}

	rel := tracker
	if careerOpsPath != "" {
		if strings.HasPrefix(tracker, careerOpsPath) {
			rel = strings.TrimPrefix(tracker, careerOpsPath)
			rel = strings.TrimPrefix(rel, string(os.PathSeparator))
		}
	}

	return Board{
		TrackerPath: tracker,
		TrackerRel:  rel,
		Missing:     missing && len(rows) == 0,
		Total:       len(rows),
		Tiles:       tiles,
		Portals:     portals,
		Rows:        rows,
	}
}

// FilterBoard returns a copy of board with rows matching status/portal/query.
// Empty filters mean "all". Status filter is a bucket id.
func FilterBoard(board Board, status, portal, query string) Board {
	status = strings.TrimSpace(status)
	portal = strings.TrimSpace(portal)
	query = strings.ToLower(strings.TrimSpace(query))
	if status == "" && portal == "" && query == "" {
		return board
	}
	out := board
	filtered := make([]Row, 0, len(board.Rows))
	for _, row := range board.Rows {
		if status != "" && row.Bucket != status {
			continue
		}
		if portal != "" && row.PortalID != portal {
			continue
		}
		if query != "" && !strings.Contains(row.SearchText, query) {
			continue
		}
		filtered = append(filtered, row)
	}
	out.Rows = filtered
	return out
}
