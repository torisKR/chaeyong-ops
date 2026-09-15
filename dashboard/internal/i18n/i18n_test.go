package i18n

import (
	"testing"
	"time"
)

func TestStatusLabel(t *testing.T) {
	tests := []struct {
		norm string
		en   string
		tr   string
		es   string
		ko   string
	}{
		{"interview", "Interview", "Mülakat", "Entrevista", "면접"},
		{"offer", "Offer", "Teklif", "Oferta", "합격"},
		{"hired", "Hired", "İşe Alındı", "Contratada", "입사"},
		{"responded", "Responded", "Yanıt Verildi", "Respondida", "서류통과"},
		{"applied", "Applied", "Başvuruldu", "Aplicada", "지원완료"},
		{"evaluated", "Evaluated", "Değerlendirildi", "Evaluada", "평가완료"},
		{"skip", "SKIP", "Uygun Değil", "OMITIR", "스킵"},
		{"rejected", "Rejected", "Reddedildi", "Rechazada", "불합격"},
		{"discarded", "Discarded", "İptal Edildi", "Descartada", "폐기"},
		{"unknown", "unknown", "unknown", "unknown", "unknown"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.norm, func(t *testing.T) {
			t.Parallel()
			if got := En.StatusLabel(tt.norm); got != tt.en {
				t.Fatalf("En.StatusLabel(%q) = %q, expected %q", tt.norm, got, tt.en)
			}
			if got := Tr.StatusLabel(tt.norm); got != tt.tr {
				t.Fatalf("Tr.StatusLabel(%q) = %q, expected %q", tt.norm, got, tt.tr)
			}
			if got := Es.StatusLabel(tt.norm); got != tt.es {
				t.Fatalf("Es.StatusLabel(%q) = %q, expected %q", tt.norm, got, tt.es)
			}
			if got := Ko.StatusLabel(tt.norm); got != tt.ko {
				t.Fatalf("Ko.StatusLabel(%q) = %q, expected %q", tt.norm, got, tt.ko)
			}
		})
	}
}

func TestFormatTimeAgo(t *testing.T) {
	// Mock time to ensure deterministic tests
	mockNow := time.Date(2023, 10, 27, 12, 0, 0, 0, time.Local)
	originalNowFunc := NowFunc
	NowFunc = func() time.Time { return mockNow }
	defer func() { NowFunc = originalNowFunc }()

	today := mockNow.Format("2006-01-02")
	yesterday := mockNow.AddDate(0, 0, -1).Format("2006-01-02")
	threeDaysAgo := mockNow.AddDate(0, 0, -3).Format("2006-01-02")
	tomorrow := mockNow.AddDate(0, 0, 1).Format("2006-01-02")

	// English tests
	if got := En.FormatTimeAgo(today); got != "today" {
		t.Errorf("En.FormatTimeAgo(today) = %q; want \"today\"", got)
	}
	if got := En.FormatTimeAgo(yesterday); got != "yesterday" {
		t.Errorf("En.FormatTimeAgo(yesterday) = %q; want \"yesterday\"", got)
	}
	if got := En.FormatTimeAgo(threeDaysAgo); got != "3d ago" {
		t.Errorf("En.FormatTimeAgo(3d ago) = %q; want \"3d ago\"", got)
	}
	if got := En.FormatTimeAgo(tomorrow); got != "today" {
		t.Errorf("En.FormatTimeAgo(tomorrow) = %q; want \"today\"", got)
	}
	if got := En.FormatTimeAgo("not-a-date"); got != "not-a-date" {
		t.Errorf("En.FormatTimeAgo(invalid) = %q; want \"not-a-date\"", got)
	}

	// Turkish tests
	if got := Tr.FormatTimeAgo(today); got != "bugün" {
		t.Errorf("Tr.FormatTimeAgo(today) = %q; want \"bugün\"", got)
	}
	if got := Tr.FormatTimeAgo(yesterday); got != "dün" {
		t.Errorf("Tr.FormatTimeAgo(yesterday) = %q; want \"dün\"", got)
	}
	if got := Tr.FormatTimeAgo(threeDaysAgo); got != "3 gün önce" {
		t.Errorf("Tr.FormatTimeAgo(3d ago) = %q; want \"3 gün önce\"", got)
	}
	if got := Tr.FormatTimeAgo(tomorrow); got != "bugün" {
		t.Errorf("Tr.FormatTimeAgo(tomorrow) = %q; want \"bugün\"", got)
	}
	if got := Tr.FormatTimeAgo("not-a-date"); got != "not-a-date" {
		t.Errorf("Tr.FormatTimeAgo(invalid) = %q; want \"not-a-date\"", got)
	}

	// Spanish tests
	if got := Es.FormatTimeAgo(today); got != "hoy" {
		t.Errorf("Es.FormatTimeAgo(today) = %q; want \"hoy\"", got)
	}
	if got := Es.FormatTimeAgo(yesterday); got != "ayer" {
		t.Errorf("Es.FormatTimeAgo(yesterday) = %q; want \"ayer\"", got)
	}
	if got := Es.FormatTimeAgo(threeDaysAgo); got != "hace 3d" {
		t.Errorf("Es.FormatTimeAgo(3d ago) = %q; want \"hace 3d\"", got)
	}
	if got := Es.FormatTimeAgo(tomorrow); got != "hoy" {
		t.Errorf("Es.FormatTimeAgo(tomorrow) = %q; want \"hoy\"", got)
	}
	if got := Es.FormatTimeAgo("not-a-date"); got != "not-a-date" {
		t.Errorf("Es.FormatTimeAgo(invalid) = %q; want \"not-a-date\"", got)
	}

	if got := Ko.FormatTimeAgo(today); got != "오늘" {
		t.Errorf("Ko.FormatTimeAgo(today) = %q; want \"오늘\"", got)
	}
	if got := Ko.FormatTimeAgo(yesterday); got != "어제" {
		t.Errorf("Ko.FormatTimeAgo(yesterday) = %q; want \"어제\"", got)
	}
	if got := Ko.FormatTimeAgo(threeDaysAgo); got != "3일 전" {
		t.Errorf("Ko.FormatTimeAgo(3d ago) = %q; want \"3일 전\"", got)
	}
}

func TestRuntimeLanguageManagement(t *testing.T) {
	// Reset to En initially
	Current = &En

	if got := GetLang(); got != "en" {
		t.Errorf("initial GetLang() = %q; want \"en\"", got)
	}

	SetLang("tr")
	if Current != &Tr || GetLang() != "tr" {
		t.Errorf("after SetLang(\"tr\"), GetLang() = %q; want \"tr\"", GetLang())
	}

	SetLang("tr_TR")
	if Current != &Tr || GetLang() != "tr" {
		t.Errorf("after SetLang(\"tr_TR\"), GetLang() = %q; want \"tr\"", GetLang())
	}

	SetLang("es")
	if Current != &Es || GetLang() != "es" {
		t.Errorf("after SetLang(\"es\"), GetLang() = %q; want \"es\"", GetLang())
	}

	SetLang("es_ES")
	if Current != &Es || GetLang() != "es" {
		t.Errorf("after SetLang(\"es_ES\"), GetLang() = %q; want \"es\"", GetLang())
	}

	SetLang("ko")
	if Current != &Ko || GetLang() != "ko" {
		t.Errorf("after SetLang(\"ko\"), GetLang() = %q; want \"ko\"", GetLang())
	}

	SetLang("ko_KR")
	if Current != &Ko || GetLang() != "ko" {
		t.Errorf("after SetLang(\"ko_KR\"), GetLang() = %q; want \"ko\"", GetLang())
	}

	SetLang("en")
	if Current != &En || GetLang() != "en" {
		t.Errorf("after SetLang(\"en\"), GetLang() = %q; want \"en\"", GetLang())
	}

	SetLang("fr") // unknown language falls back to en
	if Current != &En || GetLang() != "en" {
		t.Errorf("after SetLang(\"fr\"), GetLang() = %q; want \"en\"", GetLang())
	}

	// Test ToggleLang — Korean-first: En <-> Ko
	SetLang("en")
	ToggleLang()
	if Current != &Ko || GetLang() != "ko" {
		t.Errorf("after ToggleLang() from En, GetLang() = %q; want \"ko\"", GetLang())
	}

	ToggleLang()
	if Current != &En || GetLang() != "en" {
		t.Errorf("after ToggleLang() from Ko, GetLang() = %q; want \"en\"", GetLang())
	}
}

func TestSortModeLabel(t *testing.T) {
	type sortTestCase struct {
		name string
		mode string
		want string
	}

	enCases := []sortTestCase{
		{name: "score", mode: "score", want: "score"},
		{name: "date", mode: "date", want: "date"},
		{name: "company", mode: "company", want: "company"},
		{name: "status", mode: "status", want: "status"},
		{name: "location", mode: "location", want: "location"},
		{name: "pay", mode: "pay", want: "pay"},
		{name: "last", mode: "last", want: "last"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range enCases {
		t.Run("En/"+tc.name, func(t *testing.T) {
			if got := En.SortModeLabel(tc.mode); got != tc.want {
				t.Errorf("En.SortModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}

	trCases := []sortTestCase{
		{name: "score", mode: "score", want: "puan"},
		{name: "date", mode: "date", want: "tarih"},
		{name: "company", mode: "company", want: "şirket"},
		{name: "status", mode: "status", want: "durum"},
		{name: "location", mode: "location", want: "konum"},
		{name: "pay", mode: "pay", want: "ücret"},
		{name: "last", mode: "last", want: "son"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range trCases {
		t.Run("Tr/"+tc.name, func(t *testing.T) {
			if got := Tr.SortModeLabel(tc.mode); got != tc.want {
				t.Errorf("Tr.SortModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}

	esCases := []sortTestCase{
		{name: "score", mode: "score", want: "puntuación"},
		{name: "date", mode: "date", want: "fecha"},
		{name: "company", mode: "company", want: "empresa"},
		{name: "status", mode: "status", want: "estado"},
		{name: "location", mode: "location", want: "ubicación"},
		{name: "pay", mode: "pay", want: "salario"},
		{name: "last", mode: "last", want: "último"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range esCases {
		t.Run("Es/"+tc.name, func(t *testing.T) {
			if got := Es.SortModeLabel(tc.mode); got != tc.want {
				t.Errorf("Es.SortModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}

	koCases := []sortTestCase{
		{name: "score", mode: "score", want: "점수"},
		{name: "date", mode: "date", want: "날짜"},
		{name: "company", mode: "company", want: "회사"},
		{name: "status", mode: "status", want: "상태"},
		{name: "location", mode: "location", want: "지역"},
		{name: "pay", mode: "pay", want: "연봉"},
		{name: "last", mode: "last", want: "최근"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range koCases {
		t.Run("Ko/"+tc.name, func(t *testing.T) {
			if got := Ko.SortModeLabel(tc.mode); got != tc.want {
				t.Errorf("Ko.SortModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}
}

func TestKoreanStatusTabs(t *testing.T) {
	if Ko.TabApplied != "지원완료" || Ko.TabResponded != "서류통과" || Ko.TabInterview != "면접" {
		t.Errorf("Korean status tabs = %q / %q / %q", Ko.TabApplied, Ko.TabResponded, Ko.TabInterview)
	}
	if Ko.TabEvaluated != "평가완료" || Ko.TabRejected != "불합격" || Ko.TabSkip != "스킵" || Ko.TabDiscarded != "폐기" {
		t.Errorf("Korean hold/reject tabs missing")
	}
}

func TestViewModeLabel(t *testing.T) {
	type viewTestCase struct {
		name string
		mode string
		want string
	}

	enCases := []viewTestCase{
		{name: "grouped", mode: "grouped", want: "grouped"},
		{name: "flat", mode: "flat", want: "flat"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range enCases {
		t.Run("En/"+tc.name, func(t *testing.T) {
			if got := En.ViewModeLabel(tc.mode); got != tc.want {
				t.Errorf("En.ViewModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}

	trCases := []viewTestCase{
		{name: "grouped", mode: "grouped", want: "gruplu"},
		{name: "flat", mode: "flat", want: "düz"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range trCases {
		t.Run("Tr/"+tc.name, func(t *testing.T) {
			if got := Tr.ViewModeLabel(tc.mode); got != tc.want {
				t.Errorf("Tr.ViewModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}

	esCases := []viewTestCase{
		{name: "grouped", mode: "grouped", want: "agrupado"},
		{name: "flat", mode: "flat", want: "plano"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range esCases {
		t.Run("Es/"+tc.name, func(t *testing.T) {
			if got := Es.ViewModeLabel(tc.mode); got != tc.want {
				t.Errorf("Es.ViewModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}

	koCases := []viewTestCase{
		{name: "grouped", mode: "grouped", want: "그룹"},
		{name: "flat", mode: "flat", want: "목록"},
		{name: "unknown", mode: "unknown", want: "unknown"},
	}

	for _, tc := range koCases {
		t.Run("Ko/"+tc.name, func(t *testing.T) {
			if got := Ko.ViewModeLabel(tc.mode); got != tc.want {
				t.Errorf("Ko.ViewModeLabel(%q) = %q; want %q", tc.mode, got, tc.want)
			}
		})
	}
}
