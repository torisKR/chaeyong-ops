package webui

import (
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Binding to loopback is not enough: a rebinding hostname can resolve to it.
// Accept only explicit loopback authorities, without resolving DNS names.
func isLoopbackHost(authority string) bool {
	u, err := url.Parse("//" + authority)
	if err != nil || u.Host != authority || u.User != nil || authority == "" {
		return false
	}
	host := u.Hostname()
	if strings.Contains(host, ":") && !strings.HasPrefix(authority, "[") {
		return false
	}
	if port := u.Port(); port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return false
		}
	} else if strings.HasSuffix(authority, ":") {
		return false
	}
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func withLoopbackHost(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isLoopbackHost(r.Host) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// Check both browser headers when present. In particular, same-site is still
// cross-origin, and a valid form token must not override a hostile Origin.
// Headerless clients must still provide the unpredictable form token.
func isSameOriginRequest(r *http.Request) bool {
	if sites, ok := r.Header["Sec-Fetch-Site"]; ok {
		if len(sites) != 1 || (sites[0] != "same-origin" && sites[0] != "none") {
			return false
		}
	}
	if origins, ok := r.Header["Origin"]; ok {
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		if len(origins) != 1 || origins[0] != scheme+"://"+r.Host {
			return false
		}
	}
	return true
}
