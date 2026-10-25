package main

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
)

// clientMeta carries per-request client metadata (IP + User-Agent) through the
// inbound request context, so that outgoing appview (xrpc) requests made on
// behalf of that client can forward it via standard forwarding headers.
//
// Without this, the backend only ever sees the SSR service's own IP and a
// static Go HTTP client User-Agent, which breaks per-client analytics.
type clientMeta struct {
	ip string
	ua string
}

type clientMetaKey struct{}

// clientMetaMiddleware records the real client IP (as extracted by
// e.IPExtractor) and the client's User-Agent into the request context.
//
// The IP is derived from what this server sees (c.RealIP()), never from a
// client-supplied header echoed back, so the value we forward downstream is
// the same one the rate limiter uses.
func clientMetaMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := c.Request()
		cm := clientMeta{
			ip: c.RealIP(),
			ua: req.UserAgent(),
		}
		c.SetRequest(req.WithContext(context.WithValue(req.Context(), clientMetaKey{}, cm)))
		return next(c)
	}
}

// clientMetaTransport wraps the xrpc HTTP transport and injects client
// forwarding headers (X-Forwarded-For, X-Real-IP, User-Agent) from the request
// context, if present. Requests without client metadata in their context
// (e.g. background sitemap fetches) pass through untouched.
type clientMetaTransport struct {
	base http.RoundTripper
}

func (t *clientMetaTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if cm, ok := req.Context().Value(clientMetaKey{}).(clientMeta); ok {
		// RoundTrippers must not mutate the incoming request; clone first.
		req = req.Clone(req.Context())
		// The SSR service is the authoritative origin of these values: set
		// (not append) so we never trust or propagate a client-supplied chain.
		req.Header.Set("X-Forwarded-For", cm.ip)
		req.Header.Set("X-Real-IP", cm.ip)
		if cm.ua != "" {
			req.Header.Set("User-Agent", cm.ua)
		}
	}
	base := t.base
	if base == nil {
		base = http.DefaultTransport
	}
	return base.RoundTrip(req)
}
