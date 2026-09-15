package webui

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// DefaultAddr is the loopback listen address for the Korean status board.
const DefaultAddr = "127.0.0.1:3847"

//go:embed template.html
var templateFS embed.FS

var pageTmpl = template.Must(template.ParseFS(templateFS, "template.html"))

type jsonBoard struct {
	TrackerRel string         `json:"tracker"`
	Missing    bool           `json:"missing"`
	Total      int            `json:"total"`
	Counts     map[string]int `json:"counts"`
	Rows       []jsonRow      `json:"applications"`
}

type jsonRow struct {
	Company     string `json:"company"`
	Role        string `json:"role"`
	Portal      string `json:"portal"`
	PortalLabel string `json:"portalLabel"`
	Score       string `json:"score"`
	Status      string `json:"status"`
	StatusLabel string `json:"statusLabel"`
	Date        string `json:"date"`
	URL         string `json:"url"`
}

func boardJSON(b Board) jsonBoard {
	counts := map[string]int{}
	for _, t := range b.Tiles {
		counts[t.ID] = t.Count
	}
	rows := make([]jsonRow, 0, len(b.Rows))
	for _, r := range b.Rows {
		rows = append(rows, jsonRow{
			Company:     r.Company,
			Role:        r.Role,
			Portal:      r.PortalID,
			PortalLabel: r.PortalLabel,
			Score:       r.Score,
			Status:      r.StatusID,
			StatusLabel: r.StatusLabel,
			Date:        r.Date,
			URL:         r.URL,
		})
	}
	return jsonBoard{
		TrackerRel: b.TrackerRel,
		Missing:    b.Missing,
		Total:      b.Total,
		Counts:     counts,
		Rows:       rows,
	}
}

func withSecurityHeaders(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		h.ServeHTTP(w, r)
	})
}

// NewHandler serves the read-only status board for careerOpsPath.
func NewHandler(careerOpsPath string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		board := LoadBoard(careerOpsPath)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := pageTmpl.Execute(w, board); err != nil {
			http.Error(w, "template error", http.StatusInternalServerError)
		}
	})
	mux.HandleFunc("/api/applications.json", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		q := r.URL.Query()
		board := FilterBoard(LoadBoard(careerOpsPath), q.Get("status"), q.Get("portal"), q.Get("q"))
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(boardJSON(board))
	})
	return withSecurityHeaders(mux)
}

// ValidateAddr rejects non-loopback binds so the tracker never leaves this machine.
func ValidateAddr(addr string) error {
	host, port, err := net.SplitHostPort(strings.TrimSpace(addr))
	if err != nil {
		return fmt.Errorf("listen address %q: %w", addr, err)
	}
	if port == "" {
		return fmt.Errorf("listen address %q: missing port", addr)
	}
	if host == "" {
		return fmt.Errorf("web UI binds loopback only (privacy); empty host would listen on all interfaces")
	}
	if strings.EqualFold(host, "localhost") {
		return nil
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return fmt.Errorf("web UI binds loopback only (privacy); refusing %s", host)
	}
	return nil
}

// ListenAndServe starts the status board on addr (loopback only).
func ListenAndServe(addr, careerOpsPath string) error {
	if err := ValidateAddr(addr); err != nil {
		return err
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	board := LoadBoard(careerOpsPath)
	fmt.Fprintf(os.Stderr, "채용옵스 지원 현황 (로컬 전용)\n")
	fmt.Fprintf(os.Stderr, "  http://%s\n", ln.Addr().String())
	fmt.Fprintf(os.Stderr, "  트래커: %s\n", board.TrackerPath)
	if board.Missing {
		fmt.Fprintf(os.Stderr, "  (트래커 파일 없음 — 빈 안내 화면을 띄웁니다)\n")
	} else {
		fmt.Fprintf(os.Stderr, "  %d건\n", board.Total)
	}
	fmt.Fprintf(os.Stderr, "  종료: Ctrl+C\n")
	fmt.Fprintf(os.Stderr, "  터미널 UI: npm run serve:dashboard\n")

	srv := &http.Server{
		Handler:           NewHandler(careerOpsPath),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	return srv.Serve(ln)
}
