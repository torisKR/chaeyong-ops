package webui

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	maxBlockedCompanies = 50
	maxBlockedNameRunes = 80
)

// SettingsView is the localhost targeting page (직종 / 연차 / 블랙리스트).
type SettingsView struct {
	Years           string
	Roles           []string
	Blocked         []string
	BlockedText     string
	Message         string
	Error           string
	ProfileMissing  bool
	PortalsMissing  bool
	ProfileRel      string
	PortalsRel      string
}

var (
	reYears        = regexp.MustCompile(`(?m)^  years:\s*([^\n#]+)`)
	rePrimaryBlock = regexp.MustCompile(`(?m)^  primary:\n((?:    - [^\n]+\n)+)`)
	reListItem     = regexp.MustCompile(`(?m)^[ ]+- (.+)$`)
	reBlockedBlock = regexp.MustCompile(`(?m)^blocked_companies:\n(?:  - [^\n]+\n)+`)
	reBlockedEmpty = regexp.MustCompile(`(?m)^blocked_companies:\s*\[\s*\]\s*\n`)
)

func yamlQuote(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		return `""`
	}
	return string(b)
}

func unquoteYAMLScalar(raw string) string {
	v := strings.TrimSpace(raw)
	if len(v) >= 2 && ((v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'')) {
		var out string
		if json.Unmarshal([]byte(v), &out) == nil {
			return out
		}
		return strings.Trim(v, `"'`)
	}
	if i := strings.Index(v, " #"); i >= 0 {
		v = strings.TrimSpace(v[:i])
	}
	return v
}

func listItems(block string) []string {
	var out []string
	for _, m := range reListItem.FindAllStringSubmatch(block, -1) {
		name := unquoteYAMLScalar(m[1])
		if name != "" && name != "[]" {
			out = append(out, name)
		}
	}
	return out
}

func LoadSettings(careerOpsPath string) SettingsView {
	view := SettingsView{
		ProfileRel: "config/profile.yml",
		PortalsRel: "portals.yml",
		Roles:      []string{},
		Blocked:    []string{},
	}
	profile := filepath.Join(careerOpsPath, "config", "profile.yml")
	portals := filepath.Join(careerOpsPath, "portals.yml")

	if raw, err := os.ReadFile(profile); err != nil {
		view.ProfileMissing = true
	} else {
		text := string(raw)
		if m := reYears.FindStringSubmatch(text); len(m) == 2 {
			view.Years = unquoteYAMLScalar(m[1])
		}
		if m := rePrimaryBlock.FindStringSubmatch(text); len(m) == 2 {
			view.Roles = listItems(m[1])
		}
	}

	if raw, err := os.ReadFile(portals); err != nil {
		view.PortalsMissing = true
	} else {
		view.Blocked = parseBlockedList(string(raw))
		view.BlockedText = strings.Join(view.Blocked, "\n")
	}
	return view
}

func parseBlockedList(text string) []string {
	if m := reBlockedBlock.FindString(text); m != "" {
		return listItems(m)
	}
	return []string{}
}

func ParseBlockedForm(raw string) ([]string, error) {
	seen := map[string]struct{}{}
	var out []string
	for _, line := range strings.FieldsFunc(raw, func(r rune) bool {
		return r == '\n' || r == ',' || r == '，' || r == ';'
	}) {
		name := strings.TrimSpace(line)
		if name == "" {
			continue
		}
		if strings.Contains(name, "@") {
			return nil, fmt.Errorf("이메일은 블랙리스트에 넣지 마세요")
		}
		if utf8.RuneCountInString(name) > maxBlockedNameRunes {
			return nil, fmt.Errorf("회사 이름이 너무 깁니다")
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, name)
		if len(out) > maxBlockedCompanies {
			return nil, fmt.Errorf("회사는 최대 %d곳까지", maxBlockedCompanies)
		}
	}
	return out, nil
}

func blockedYAML(names []string) string {
	if len(names) == 0 {
		return "blocked_companies: []\n"
	}
	var b strings.Builder
	b.WriteString("blocked_companies:\n")
	for _, n := range names {
		b.WriteString("  - ")
		b.WriteString(yamlQuote(n))
		b.WriteString("\n")
	}
	return b.String()
}

func PatchBlockedCompanies(text string, names []string) string {
	block := blockedYAML(names)
	if reBlockedBlock.MatchString(text) {
		return reBlockedBlock.ReplaceAllString(text, block)
	}
	if reBlockedEmpty.MatchString(text) {
		return reBlockedEmpty.ReplaceAllString(text, block)
	}
	if strings.Contains(text, "\njob_boards:") {
		return strings.Replace(text, "\njob_boards:", "\n"+block+"\njob_boards:", 1)
	}
	if strings.HasPrefix(strings.TrimSpace(text), "job_boards:") {
		return block + "\n" + text
	}
	if !strings.HasSuffix(text, "\n") {
		text += "\n"
	}
	return text + "\n" + block
}

func SaveBlockedCompanies(careerOpsPath string, names []string) error {
	path := filepath.Join(careerOpsPath, "portals.yml")
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("portals.yml 없음: node setup.mjs --defaults")
	}
	next := PatchBlockedCompanies(string(raw), names)
	return os.WriteFile(path, []byte(next), 0o644)
}
