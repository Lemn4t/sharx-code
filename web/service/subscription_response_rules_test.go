package service

import "testing"

func TestProfileTitleValues(t *testing.T) {
	if got := ProfileTitleHTTPValue("Test"); got != "base64:VGVzdA==" {
		t.Fatalf("HTTP title = %q", got)
	}
	if got := ProfileTitleBodyValue("Test"); got != "Test" {
		t.Fatalf("body title = %q", got)
	}
	if got := ProfileTitleBodyValue("base64:VGVzdA=="); got != "Test" {
		t.Fatalf("decoded body title = %q", got)
	}
}

func TestProfileUpdateIntervalBodyLine(t *testing.T) {
	rr := &SharxSubpageResponseRules{
		ProfileUpdateInterval:         6,
		ProfileUpdateIntervalDelivery: ResponseHeaderDeliveryBoth,
	}
	if got := ProfileUpdateIntervalBodyLine(rr); got != "#profile-update-interval: 6\n" {
		t.Fatalf("interval body line = %q", got)
	}
	rr.ProfileUpdateIntervalDelivery = ResponseHeaderDeliveryHeader
	if got := ProfileUpdateIntervalBodyLine(rr); got != "" {
		t.Fatalf("header-only should skip body: %q", got)
	}
}
