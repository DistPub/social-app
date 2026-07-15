package main

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"slices"

	appbsky "github.com/bluesky-social/indigo/api/bsky"
	comatprototypes "github.com/bluesky-social/indigo/api/atproto"
	"github.com/bluesky-social/indigo/atproto/syntax"

	"github.com/labstack/echo/v4"
)

// time.RFC822Z, but with four digit year. used for RSS pubData.
var FullYearRFC822Z = "02 Jan 2006 15:04 -0700"

type ItemGUID struct {
	XMLName xml.Name `xml:"guid"`
	Value   string   `xml:",chardata"`
	IsPerma bool     `xml:"isPermaLink,attr"`
}

// We don't actually populate the title for "posts".
// Some background: https://book.micro.blog/rss-for-microblogs/
type Item struct {
	Title       string `xml:"title,omitempty"`
	Link        string `xml:"link,omitempty"`
	Description string `xml:"description,omitempty"`
	PubDate     string `xml:"pubDate,omitempty"`
	GUID        ItemGUID
}

type rss struct {
	Version     string `xml:"version,attr"`
	Description string `xml:"channel>description,omitempty"`
	Link        string `xml:"channel>link"`
	Title       string `xml:"channel>title"`

	Item []Item `xml:"channel>item"`
}

var badLabels = []string{"not-good", "nsfw"}

func hasBadLabel(labels []*comatprototypes.LabelDefs_Label) bool {
	for _, label := range labels {
		if label.Src == "did:web:cgv.hukoubook.com" && slices.Contains(badLabels, label.Val) {
			return true
		}
	}
	return false
}

func (srv *Server) WebProfileRSS(c echo.Context) error {
	ctx := c.Request().Context()
	req := c.Request()

	identParam := c.Param("ident")

	ident, err := syntax.ParseAtIdentifier(identParam)
	if err != nil {
		return echo.NewHTTPError(400, fmt.Sprintf("not a valid handle or DID: %s", identParam))
	}

	pv, err := appbsky.ActorGetProfile(ctx, srv.xrpcc, ident.Normalize().String())
	if err != nil {
		return echo.NewHTTPError(404, fmt.Sprintf("account not found: %s", identParam))
	}
	for _, label := range pv.Labels {
		if label.Src == pv.Did && label.Val == "!no-unauthenticated" {
			return echo.NewHTTPError(403, fmt.Sprintf("account does not allow public views: %s", identParam))
		}
	}

	af, err := appbsky.FeedGetAuthorFeed(ctx, srv.xrpcc, pv.Did, "", "posts_no_replies", false, 30)
	if err != nil {
		log.Warn("failed to fetch author feed", "did", pv.Did, "err", err)
		return err
	}

	posts := []Item{}
	if !hasBadLabel(pv.Labels) {
		for _, p := range af.Feed {
			if p.Post.Author.Did != pv.Did {
				continue
			}
			aturi, err := syntax.ParseATURI(p.Post.Uri)
			if err != nil {
				return err
			}
			rec, ok := p.Post.Record.Val.(*appbsky.FeedPost)
			if !ok {
				continue
			}
			if rec.Reply != nil {
				continue
			}
			pubDate := ""
			createdAt, err := syntax.ParseDatetimeLenient(rec.CreatedAt)
			if nil == err {
				pubDate = createdAt.Time().Format(FullYearRFC822Z)
			}
			posts = append(posts, Item{
				Link:        fmt.Sprintf("https://%s/profile/%s/post/%s", req.Host, pv.Handle, aturi.RecordKey().String()),
				Description: ExpandPostText(rec),
				PubDate:     pubDate,
				GUID: ItemGUID{
					Value:   aturi.String(),
					IsPerma: false,
				},
			})
		}
	}

	title := "@" + pv.Handle
	if pv.DisplayName != nil {
		title = title + " - " + *pv.DisplayName
	}
	desc := ""
	if pv.Description != nil {
		desc = *pv.Description
	}
	feed := &rss{
		Version:     "2.0",
		Description: desc,
		Link:        fmt.Sprintf("https://%s/profile/%s", req.Host, pv.Handle),
		Title:       title,
		Item:        posts,
	}
	return c.XML(http.StatusOK, feed)
}

func (srv *Server) WebFeedRSS(c echo.Context) error {
	ctx := c.Request().Context()
	req := c.Request()

	handleOrDIDParam := c.Param("handleOrDID")
	handleOrDID, err := syntax.ParseAtIdentifier(handleOrDIDParam)
	if err != nil {
		return echo.NewHTTPError(400, fmt.Sprintf("not a valid handle or DID: %s", handleOrDIDParam))
	}

	rkeyParam := c.Param("rkey")
	rkey, err := syntax.ParseRecordKey(rkeyParam)
	if err != nil {
		return echo.NewHTTPError(400, fmt.Sprintf("not a valid record key: %s", rkeyParam))
	}

	identifier := handleOrDID.Normalize().String()

	pv, err := appbsky.ActorGetProfile(ctx, srv.xrpcc, identifier)
	if err != nil {
		return echo.NewHTTPError(404, fmt.Sprintf("account not found: %s", identifier))
	}

	for _, label := range pv.Labels {
		if label.Src == pv.Did && label.Val == "!no-unauthenticated" {
			return echo.NewHTTPError(403, fmt.Sprintf("account does not allow public views: %s", identifier))
		}
	}

	did := pv.Did
	feedURI := fmt.Sprintf("at://%s/app.bsky.feed.generator/%s", did, rkey.String())

	fgv, err := appbsky.FeedGetFeedGenerator(ctx, srv.xrpcc, feedURI)
	if err != nil {
		return echo.NewHTTPError(404, fmt.Sprintf("feed generator not found: %s", feedURI))
	}

	feedOutput, err := appbsky.FeedGetFeed(ctx, srv.xrpcc, "", feedURI, 30)
	if err != nil {
		log.Warn("failed to fetch feed", "feed", feedURI, "err", err)
		return echo.NewHTTPError(500, fmt.Sprintf("failed to fetch feed: %v", err))
	}

	posts := []Item{}
	for _, p := range feedOutput.Feed {
		aturi, err := syntax.ParseATURI(p.Post.Uri)
		if err != nil {
			continue
		}

		rec, ok := p.Post.Record.Val.(*appbsky.FeedPost)
		if !ok {
			continue
		}

		if rec.Reply != nil {
			continue
		}

		if hasBadLabel(p.Post.Author.Labels) {
			continue
		}

		pubDate := ""
		createdAt, err := syntax.ParseDatetimeLenient(rec.CreatedAt)
		if nil == err {
			pubDate = createdAt.Time().Format(FullYearRFC822Z)
		}

		authorHandle := p.Post.Author.Handle
		if authorHandle == "" {
			authorHandle = p.Post.Author.Did
		}

		posts = append(posts, Item{
			Link:        fmt.Sprintf("https://%s/profile/%s/post/%s", req.Host, authorHandle, aturi.RecordKey().String()),
			Description: ExpandPostText(rec),
			PubDate:     pubDate,
			GUID: ItemGUID{
				Value:   aturi.String(),
				IsPerma: false,
			},
		})
	}

	title := "@" + pv.Handle
	if pv.DisplayName != nil {
		title = title + " - " + *pv.DisplayName
	}
	if fgv.View != nil && fgv.View.DisplayName != "" {
		title = title + " - " + fgv.View.DisplayName
	}

	desc := ""
	if fgv.View != nil && fgv.View.Description != nil {
		desc = *fgv.View.Description
	}

	feed := &rss{
		Version:     "2.0",
		Description: desc,
		Link:        fmt.Sprintf("https://%s/profile/%s/feed/%s", req.Host, pv.Handle, rkey.String()),
		Title:       title,
		Item:        posts,
	}
	return c.XML(http.StatusOK, feed)
}
