package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestClientMetaTransportSetsForwardingHeaders(t *testing.T) {
	var got http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
	}))
	defer srv.Close()

	tr := &clientMetaTransport{base: http.DefaultTransport}
	ctx := context.WithValue(context.Background(), clientMetaKey{}, clientMeta{
		ip: "203.0.113.7",
		ua: "test-ua/1.0",
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tr.RoundTrip(req); err != nil {
		t.Fatal(err)
	}

	if v := got.Get("X-Forwarded-For"); v != "203.0.113.7" {
		t.Errorf("X-Forwarded-For = %q, want %q", v, "203.0.113.7")
	}
	if v := got.Get("X-Real-IP"); v != "203.0.113.7" {
		t.Errorf("X-Real-IP = %q, want %q", v, "203.0.113.7")
	}
	if v := got.Get("User-Agent"); v != "test-ua/1.0" {
		t.Errorf("User-Agent = %q, want %q", v, "test-ua/1.0")
	}
}

func TestClientMetaTransportPassthroughWithoutMeta(t *testing.T) {
	var got http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
	}))
	defer srv.Close()

	tr := &clientMetaTransport{base: http.DefaultTransport}
	req, err := http.NewRequest(http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("User-Agent", "go-default/ua")
	if _, err := tr.RoundTrip(req); err != nil {
		t.Fatal(err)
	}

	if v := got.Get("X-Forwarded-For"); v != "" {
		t.Errorf("X-Forwarded-For = %q, want unset", v)
	}
	if v := got.Get("X-Real-IP"); v != "" {
		t.Errorf("X-Real-IP = %q, want unset", v)
	}
	if v := got.Get("User-Agent"); v != "go-default/ua" {
		t.Errorf("User-Agent = %q, want %q", v, "go-default/ua")
	}
}

func TestClientMetaMiddlewareStoresIPAndUA(t *testing.T) {
	e := echo.New()
	e.IPExtractor = echo.ExtractIPDirect()
	e.Use(clientMetaMiddleware)

	var cm clientMeta
	ok := false
	e.GET("/", func(c echo.Context) error {
		cm, ok = c.Request().Context().Value(clientMetaKey{}).(clientMeta)
		return c.NoContent(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("User-Agent", "browser-ua/2.0")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if !ok {
		t.Fatal("client meta not found in request context")
	}
	if cm.ip != "192.0.2.1" { // httptest default remote addr
		t.Errorf("ip = %q, want %q", cm.ip, "192.0.2.1")
	}
	if cm.ua != "browser-ua/2.0" {
		t.Errorf("ua = %q, want %q", cm.ua, "browser-ua/2.0")
	}
}
