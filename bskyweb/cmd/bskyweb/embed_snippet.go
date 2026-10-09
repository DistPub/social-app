package main

import (
	"bytes"
	"fmt"
	"html/template"
	"net/http"

	appbsky "github.com/bluesky-social/indigo/api/bsky"
	"github.com/bluesky-social/indigo/atproto/syntax"
	"github.com/bluesky-social/social-app/bskyweb"

	"github.com/labstack/echo/v4"
)

// OEmbedResponse is the oEmbed JSON payload returned by /oembed.
type OEmbedResponse struct {
	Type         string `json:"type"`
	Version      string `json:"version"`
	AuthorName   string `json:"author_name,omitempty"`
	AuthorURL    string `json:"author_url,omitempty"`
	ProviderName string `json:"provider_name,omitempty"`
	ProviderURL  string `json:"provider_url,omitempty"`
	CacheAge     int    `json:"cache_age,omitempty"`
	Width        *int   `json:"width"`
	Height       *int   `json:"height"`
	HTML         string `json:"html,omitempty"`
}

// postEmbedHTML builds the <blockquote> snippet used by the oEmbed response.
func (srv *Server) postEmbedHTML(postView *appbsky.FeedDefs_PostView) (string, error) {
	// ensure that there isn't an injection from the URI
	aturi, err := syntax.ParseATURI(postView.Uri)
	if err != nil {
		log.Error("bad AT-URI in reponse", "aturi", aturi, "err", err)
		return "", err
	}

	post, ok := postView.Record.Val.(*appbsky.FeedPost)
	if !ok {
		log.Error("bad post record value", "err", err)
		return "", err
	}

	const tpl = `<blockquote class="bluesky-embed" data-bluesky-uri="{{ .PostURI }}" data-bluesky-cid="{{ .PostCID }}"><p{{ if .PostLang }} lang="{{ .PostLang }}"{{ end }}>{{ .PostText }}</p>&mdash; <a href="{{ .ProfileURL }}">{{ .PostAuthor }}</a> <a href="{{ .PostURL }}">{{ .PostIndexedAt }}</a></blockquote><script async src="{{ .WidgetURL }}" charset="utf-8"></script>`

	t, err := template.New("snippet").Parse(tpl)
	if err != nil {
		log.Error("template parse error", "err", err)
		return "", err
	}

	sortAt := postView.IndexedAt
	createdAt, err := syntax.ParseDatetime(post.CreatedAt)
	if nil == err && createdAt.String() < sortAt {
		sortAt = createdAt.String()
	}

	var lang string
	if len(post.Langs) > 0 {
		lang = post.Langs[0]
	}
	var authorName string
	if postView.Author.DisplayName != nil {
		authorName = fmt.Sprintf("%s (@%s)", *postView.Author.DisplayName, postView.Author.Handle)
	} else {
		authorName = fmt.Sprintf("@%s", postView.Author.Handle)
	}
	data := struct {
		PostURI       template.URL
		PostCID       string
		PostLang      string
		PostText      string
		PostAuthor    string
		PostIndexedAt string
		ProfileURL    template.URL
		PostURL       template.URL
		WidgetURL     template.URL
	}{
		PostURI:       template.URL(postView.Uri),
		PostCID:       postView.Cid,
		PostLang:      lang,
		PostText:      post.Text,
		PostAuthor:    authorName,
		PostIndexedAt: sortAt,
		ProfileURL:    template.URL(fmt.Sprintf("https://app.hukoubook.com/profile/%s?ref_src=embed", aturi.Authority())),
		PostURL:       template.URL(fmt.Sprintf("https://app.hukoubook.com/profile/%s/post/%s?ref_src=embed", aturi.Authority(), aturi.RecordKey())),
		WidgetURL:     template.URL(EMBED_WIDGET_URL),
	}

	var buf bytes.Buffer
	err = t.Execute(&buf, data)
	if err != nil {
		log.Error("template parse error", "err", err)
		return "", err
	}
	return buf.String(), nil
}

// renderEmbedTemplate renders an embedr-templates/*.html file via html/template,
// independent of the pongo2 renderer used for the main SPA.
func (srv *Server) renderEmbedTemplate(c echo.Context, name string, data interface{}) error {
	tmpl, err := template.ParseFS(bskyweb.EmbedrTemplateFS, "embedr-templates/*.html")
	if err != nil {
		return c.String(http.StatusInternalServerError, "template error")
	}
	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, name, data); err != nil {
		return c.String(http.StatusInternalServerError, "template error")
	}
	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	c.Response().WriteHeader(http.StatusOK)
	_, err = c.Response().Writer.Write(buf.Bytes())
	return err
}
